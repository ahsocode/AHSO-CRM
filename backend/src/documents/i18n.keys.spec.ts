import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { ratchet } from "./__fixtures__/known-defects";

/**
 * i18n key lock (audit step 0). Any added/removed key or changed wording in vi.json / en.json
 * fails here until `__fixtures__/i18n-keys.lock.json` is regenerated on purpose
 * (`UPDATE_I18N_LOCK=1 npx jest src/documents/i18n.keys.spec.ts`) and the diff is reviewed —
 * contract/NDA statement wording must not change without Henry's per-clause approval.
 */
const I18N_DIR = join(__dirname, "i18n");
const TEMPLATES_DIR = join(__dirname, "templates");
const LOCK_PATH = join(__dirname, "__fixtures__", "i18n-keys.lock.json");

type Bundle = Record<string, string>;
const rawVi = readFileSync(join(I18N_DIR, "vi.json"), "utf-8");
const rawEn = readFileSync(join(I18N_DIR, "en.json"), "utf-8");
const vi = JSON.parse(rawVi) as Bundle;
const en = JSON.parse(rawEn) as Bundle;

const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
const placeholders = (value: string) => [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

function listTemplates(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listTemplates(path);
    return name.endsWith(".hbs") ? [path] : [];
  });
}

interface TCall {
  file: string;
  key: string;
  params: string[];
}
const tCalls: TCall[] = listTemplates(TEMPLATES_DIR).flatMap((file) => {
  const source = readFileSync(file, "utf-8");
  return [...source.matchAll(/\{\{\s*t\s+"([^"]+)"([^}]*)\}\}/g)].map((m) => ({
    file: file.slice(TEMPLATES_DIR.length + 1),
    key: m[1],
    params: [...m[2].matchAll(/(\w+)=/g)].map((p) => p[1])
  }));
});

function duplicateKeys(raw: string): string[] {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const match of raw.matchAll(/^\s*"([^"]+)"\s*:/gm)) {
    if (seen.has(match[1])) dups.push(match[1]);
    seen.add(match[1]);
  }
  return dups;
}

describe("document i18n bundles", () => {
  it("match the reviewed key/wording lock", () => {
    const current: Record<string, { vi: string | null; en: string | null }> = {};
    for (const key of [...new Set([...Object.keys(vi), ...Object.keys(en)])].sort()) {
      current[key] = { vi: key in vi ? hash(vi[key]) : null, en: key in en ? hash(en[key]) : null };
    }
    if (process.env.UPDATE_I18N_LOCK === "1") {
      writeFileSync(LOCK_PATH, `${JSON.stringify(current, null, 2)}\n`);
    }
    const lock = JSON.parse(readFileSync(LOCK_PATH, "utf-8")) as typeof current;
    const changed = [...new Set([...Object.keys(lock), ...Object.keys(current)])]
      .filter((key) => JSON.stringify(lock[key]) !== JSON.stringify(current[key]))
      .map((key) => `${key}: vi=${JSON.stringify(vi[key])} en=${JSON.stringify(en[key])}`);
    expect(changed).toEqual([]);
  });

  it("vi and en define the same keys", () => {
    expect(Object.keys(vi).filter((key) => !(key in en))).toEqual([]);
    expect(Object.keys(en).filter((key) => !(key in vi))).toEqual([]);
  });

  ratchet("E-20", "duplicate-keys")("have no duplicate keys (the later one silently wins)", () => {
    expect({ vi: duplicateKeys(rawVi), en: duplicateKeys(rawEn) }).toEqual({ vi: [], en: [] });
  });

  ratchet("E-11", "i18n")("define every key a template calls with {{t}}", () => {
    const missing = tCalls.filter((call) => !(call.key in vi) || !(call.key in en)).map((c) => `${c.file}: ${c.key}`);
    expect([...new Set(missing)]).toEqual([]);
  });

  it("use the same {{placeholders}} in vi and en", () => {
    const mismatched = Object.keys(vi)
      .filter((key) => key in en)
      .filter((key) => placeholders(vi[key]).join() !== placeholders(en[key]).join());
    expect(mismatched).toEqual([]);
  });

  it("every template call passes all placeholders its key needs", () => {
    const missingParams = tCalls
      .filter((call) => call.key in vi)
      .flatMap((call) =>
        placeholders(vi[call.key])
          .filter((name) => !call.params.includes(name))
          .map((name) => `${call.file}: ${call.key} needs ${name}`)
      );
    expect(missingParams).toEqual([]);
  });

  ratchet("E-20", "typo")("label typo 'Hơp' is gone", () => {
    expect(Object.entries(vi).filter(([, value]) => value.includes("Hơp"))).toEqual([]);
  });
});
