import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const assetPairs = [
  ["src/email/templates", "dist/email/templates"],
  ["src/documents/templates", "dist/documents/templates"],
  ["src/documents/i18n", "dist/documents/i18n"]
];

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

for (const [sourceRelative, targetRelative] of assetPairs) {
  const sourcePath = resolve(rootDir, sourceRelative);
  const targetPath = resolve(rootDir, targetRelative);

  if (!(await pathExists(sourcePath))) {
    continue;
  }

  await rm(targetPath, { recursive: true, force: true });
  await mkdir(dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });
}
