/**
 * Render every document type x {vi, vi-en} x {full, minimal} fixture to HTML and, when the
 * `weasyprint` binary is on PATH, to PDF — for eyeballing layout. Output goes OUTSIDE the repo
 * (default /tmp/ahso-doc-render); never commit the PDFs.
 *
 *   cd backend && npx ts-node -r tsconfig-paths/register --transpile-only scripts/render-docs/render-docs.ts [outDir]
 *
 * Fixtures are fake (no DB access): see src/documents/__fixtures__/document-fixtures.ts.
 */
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import {
  ALL_DOCUMENT_TYPES,
  ALL_LANGUAGES,
  createRenderHarness,
  type FixtureVariant
} from "../../src/documents/__fixtures__/document-fixtures";

function hasWeasyprint(): boolean {
  try {
    execFileSync("weasyprint", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const outDir = resolve(process.argv[2] ?? "/tmp/ahso-doc-render");
  mkdirSync(join(outDir, "pdf"), { recursive: true });
  const pdf = hasWeasyprint();
  if (!pdf) console.warn("weasyprint not found on PATH: writing HTML only.");

  for (const variant of ["full", "minimal"] as FixtureVariant[]) {
    const harness = await createRenderHarness(variant);
    for (const type of ALL_DOCUMENT_TYPES) {
      for (const language of ALL_LANGUAGES) {
        const name = `${type}.${language}.${variant}`;
        const htmlPath = join(outDir, `${name}.html`);
        writeFileSync(htmlPath, await harness.render(type, language));
        if (pdf) {
          execFileSync("weasyprint", [htmlPath, join(outDir, "pdf", `${name}.pdf`)], { stdio: "inherit" });
        }
        console.log(name);
      }
    }
  }
  console.log(`done -> ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
