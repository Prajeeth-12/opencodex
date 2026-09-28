import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { keyringAssetForStandaloneTarget } from "../src/lib/keyring-native";

/** Stage the platform N-API addon outside Bun's virtual filesystem beside a standalone binary. */
export function stageStandaloneKeyringAddon(repoRoot: string, output: string, target: string): string {
  const asset = keyringAssetForStandaloneTarget(target);
  if (!asset) throw new Error(`No keyring native asset is declared for standalone target ${target}`);
  const source = join(repoRoot, "node_modules", asset.packageName, asset.filename);
  if (!existsSync(source)) {
    throw new Error(
      `Missing ${asset.packageName}/${asset.filename}; install target optional dependencies before building ${target}`,
    );
  }
  const keyringDir = join(output, "keyring");
  mkdirSync(keyringDir, { recursive: true });
  const destination = join(keyringDir, asset.filename);
  copyFileSync(source, destination);
  return destination;
}
