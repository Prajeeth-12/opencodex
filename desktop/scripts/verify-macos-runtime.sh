#!/usr/bin/env bash
set -euo pipefail

app="${1:?usage: verify-macos-runtime.sh /path/to/OpenCodex.app}"
[[ "$(uname -s)" == Darwin ]] || { echo 'macOS bundle verification requires macOS' >&2; exit 1; }
executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app/Contents/Info.plist")"
[[ -n "$executable" && "$executable" != */* ]] || { echo 'Invalid app executable name' >&2; exit 1; }
scratch="$(mktemp -d "${TMPDIR:-/tmp}/opencodex-bundle-check.XXXXXX")"
proxy_pid=""
cleanup() {
  if [[ -n "$proxy_pid" ]]; then
    kill "$proxy_pid" 2>/dev/null || true
    wait "$proxy_pid" 2>/dev/null || true
  fi
  rm -rf "$scratch"
}
trap cleanup EXIT

codesign --verify --strict --deep "$app"
verify_member() {
  local role="$1" member="$2"
  codesign --display --entitlements - --xml "$member" > "$scratch/$role.plist" 2> "$scratch/$role-entitlements.log"
  codesign --display --verbose=4 "$member" > "$scratch/$role-signature.log" 2>&1
  python3 - "$role" "$scratch/$role.plist" "$scratch/$role-signature.log" <<'PY'
import pathlib, plistlib, re, sys
role, entitlements, signature = sys.argv[1:]
actual = plistlib.loads(pathlib.Path(entitlements).read_bytes())
expected = {"com.apple.security.app-sandbox": True} if role == "widget" else {"com.apple.security.cs.allow-jit": True}
if actual != expected:
    raise SystemExit(f"Unexpected {role} entitlement dictionary")
text = pathlib.Path(signature).read_text()
if not re.search(r"flags=.*\bruntime\b", text):
    raise SystemExit(f"Missing hardened runtime on {role}")
PY
}
verify_member app "$app"
verify_member ocx "$app/Contents/MacOS/ocx"
verify_member widget "$app/Contents/PlugIns/OpenCodexWidget.appex"
# Release stripping removes the nlist symbol table; inspect the loader's bindings.
xcrun llvm-objdump --macho --dyld-info "$app/Contents/MacOS/$executable" > "$scratch/native-symbols.txt"
grep -q NSGlassEffectView "$scratch/native-symbols.txt" || { echo 'Native Liquid Glass code is absent' >&2; exit 1; }
mkdir "$scratch/home"
OPENCODEX_HOME="$scratch/home" "$app/Contents/MacOS/ocx" resolve --json > "$scratch/resolve.json"
python3 - "$scratch/resolve.json" <<'PY'
import json, pathlib, sys
value = json.loads(pathlib.Path(sys.argv[1]).read_text())
assert value.get("schema") == "ocx-resolve/1", "Unexpected resolve schema"
assert value.get("liveness", {}).get("status") in ("live", "absent-proven"), "Unusable resolve result"
PY

# Reproduce the packaged-keyring boundary from an unrelated cwd. Source-tree smoke tests prove the
# OS store, but they do not prove that Bun can find the N-API addon outside its virtual `$bunfs`.
mkdir -p "$scratch/home" "$scratch/work"
(
  cd "$scratch/work"
  HOME="$scratch/home" OPENCODEX_HOME="$scratch/home/.opencodex" \
    "$app/Contents/MacOS/ocx" start --port 10179 > "$scratch/proxy.log" 2>&1
) &
proxy_pid=$!
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:10179/healthz >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS http://127.0.0.1:10179/healthz >/dev/null
(
  cd "$scratch/work"
  HOME="$scratch/home" OPENCODEX_HOME="$scratch/home/.opencodex" \
    "$app/Contents/MacOS/ocx" provider keychain openai status --json > "$scratch/keyring.json"
)
python3 - "$scratch/keyring.json" <<'PY'
import json, pathlib, sys
value = json.loads(pathlib.Path(sys.argv[1]).read_text())
assert value.get("keychainAvailable") is True, "Packaged keyring binding is unavailable"
PY
kill "$proxy_pid" 2>/dev/null || true
wait "$proxy_pid" 2>/dev/null || true
proxy_pid=""
printf '%s\n' 'PASS: macOS signatures, entitlements, hardened runtime, Liquid Glass, bundled CLI resolve and packaged keyring'
