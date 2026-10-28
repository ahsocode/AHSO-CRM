import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/** Display-only rules from audit step 1 (E-12/E-13/E-14), checked on the shipped CSS and templates. */
const TEMPLATES = join(__dirname, "templates");
const css = (name: string) => readFileSync(join(TEMPLATES, "styles", name), "utf-8");
const hbs = (type: string, lang: string) => readFileSync(join(TEMPLATES, type, `${lang}.hbs`), "utf-8");
const allTemplates = readdirSync(TEMPLATES)
  .filter((dir) => /^[A-Z_]+$/.test(dir))
  .flatMap((dir) => ["vi", "vi-en"].map((lang) => ({ name: `${dir}/${lang}`, source: hbs(dir, lang) })));
const rule = (source: string, selector: string) => {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`rule ${selector} not found`);
  return source.slice(start, source.indexOf("}", start));
};

describe("document styles (step 1, display only)", () => {
  it("uses no invalid `border: … solid text` declarations", () => {
    expect(allTemplates.filter((t) => /solid\s+text\b/.test(t.source)).map((t) => t.name)).toEqual([]);
  });

  it("renders bilingual spans inline", () => {
    expect(rule(css("base.css"), ".lang-vi,\n.lang-en")).toContain("display: inline;");
  });

  it("does not justify text inside tables of classic documents", () => {
    expect(rule(css("classic.css"), ".classic-body table")).toContain("text-align: left;");
  });

  it("keeps article headings with their clause (no orphan 'ĐIỀU n')", () => {
    expect(rule(css("classic.css"), ".classic-article__heading")).toContain("break-after: avoid;");
  });

  it("gives the AR reconciliation header row readable colours on the th cells", () => {
    expect(rule(css("base.css"), ".table-head--brand th")).toMatch(/background: #1e3a8a;[\s\S]*color: #ffffff;/);
    for (const lang of ["vi", "vi-en"]) {
      expect(hbs("AR_RECONCILIATION", lang)).toContain('<tr class="table-head--brand">');
      expect(hbs("AR_RECONCILIATION", lang)).not.toContain("color: white");
    }
  });

  it("has no document-tail page footer with an empty page number", () => {
    const partial = readFileSync(join(TEMPLATES, "_partials", "footer-page.hbs"), "utf-8");
    const markup = partial.replace(/\{\{!--[\s\S]*?--\}\}/g, "");
    expect(markup).not.toContain("pageNumber");
    expect(markup.trim()).toBe("");
  });

  it("payment documents do not append a second ' đồng' after the amount in words", () => {
    for (const type of ["PAYMENT_REQUEST", "PAYMENT_RECEIPT"]) {
      for (const lang of ["vi", "vi-en"]) {
        expect(hbs(type, lang)).not.toMatch(/"words"\}\}\s*đồng/);
      }
    }
  });
});
