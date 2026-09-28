import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

export interface KeyringBinding {
  Entry: new (service: string, account: string) => unknown;
  AsyncEntry: new (service: string, account: string) => unknown;
}

export interface KeyringNativeAsset {
  packageName: string;
  filename: string;
}

const ASSET_BY_TARGET: Readonly<Record<string, KeyringNativeAsset>> = {
  "bun-darwin-arm64": {
    packageName: "@napi-rs/keyring-darwin-arm64",
    filename: "keyring.darwin-arm64.node",
  },
  "bun-darwin-x64": {
    packageName: "@napi-rs/keyring-darwin-x64",
    filename: "keyring.darwin-x64.node",
  },
  "bun-windows-x64": {
    packageName: "@napi-rs/keyring-win32-x64-msvc",
    filename: "keyring.win32-x64-msvc.node",
  },
  "bun-linux-x64": {
    packageName: "@napi-rs/keyring-linux-x64-gnu",
    filename: "keyring.linux-x64-gnu.node",
  },
  "bun-linux-arm64": {
    packageName: "@napi-rs/keyring-linux-arm64-gnu",
    filename: "keyring.linux-arm64-gnu.node",
  },
};

/** Native addon that must accompany a compiled standalone target. */
export function keyringAssetForStandaloneTarget(target: string): KeyringNativeAsset | undefined {
  return ASSET_BY_TARGET[target];
}

function runtimeAsset(platform: NodeJS.Platform, arch: string): KeyringNativeAsset | undefined {
  const target = platform === "darwin"
    ? `bun-darwin-${arch}`
    : platform === "win32"
      ? `bun-windows-${arch}`
      : platform === "linux"
        ? `bun-linux-${arch}`
        : "";
  return keyringAssetForStandaloneTarget(target);
}

/**
 * Deterministic packaged-addon paths. Never search cwd: a desktop command can be launched from an
 * arbitrary directory, and loading a same-named native file from there would turn cwd into code.
 */
export function packagedKeyringCandidates({
  executable = process.execPath,
  platform = process.platform,
  arch = process.arch,
}: {
  executable?: string;
  platform?: NodeJS.Platform;
  arch?: string;
} = {}): string[] {
  const asset = runtimeAsset(platform, arch);
  if (!asset) return [];
  const executableDir = dirname(resolve(executable));
  const adjacent = join(executableDir, "keyring", asset.filename);
  if (platform !== "darwin") return [adjacent];
  return [
    // Tauri resources live in Contents/Resources while its external binary lives in Contents/MacOS.
    join(executableDir, "..", "Resources", "keyring", asset.filename),
    // Standalone archives keep the addon beside the executable in keyring/.
    adjacent,
  ];
}

const nodeRequire = createRequire(import.meta.url);

/**
 * Load the OS-keyring binding from the immutable packaged location, falling back to normal package
 * resolution for source/npm installs. Bun cannot materialize a N-API binary from `$bunfs`, so a
 * compiled executable must never depend on `@napi-rs/keyring` resolving inside its virtual tree.
 */
export function loadKeyringBinding({
  candidates = packagedKeyringCandidates(),
  fileExists = existsSync,
  load = (specifier: string): unknown => nodeRequire(specifier),
}: {
  candidates?: string[];
  fileExists?: (path: string) => boolean;
  load?: (specifier: string) => unknown;
} = {}): KeyringBinding {
  for (const candidate of candidates) {
    if (fileExists(candidate)) return load(candidate) as KeyringBinding;
  }
  return load("@napi-rs/keyring") as KeyringBinding;
}
