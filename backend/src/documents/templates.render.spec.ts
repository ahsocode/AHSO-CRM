import type { DocumentType } from "@prisma/client";
import {
  ALL_DOCUMENT_TYPES,
  ALL_LANGUAGES,
  DATE_ONLY_FAKE_TIMERS,
  companySettings,
  createRenderHarness,
  stripStyles,
  type FixtureVariant
} from "./__fixtures__/document-fixtures";
import { ratchet } from "./__fixtures__/known-defects";
import type { DocumentLanguage } from "./dto/document-type.enum";

/**
 * Renders EVERY registry type x {vi, vi-en} x {full, minimal} fixture through the real
 * DocumentsService HTML stage (Handlebars templates, partials, helpers, i18n, quotation flow).
 */
const VARIANTS: FixtureVariant[] = ["full", "minimal"];
const HBS_TYPES: DocumentType[] = ALL_DOCUMENT_TYPES.filter((type) => type !== "QUOTATION");
const OPENING_SENTENCE_TYPES: DocumentType[] = [
  "CONTRACT",
  "CONTRACT_ADDENDUM",
  "NDA",
  "DELIVERY_NOTE",
  "DOC_HANDOVER",
  "INSTALLATION_REPORT",
  "ACCEPTANCE_REPORT",
  "PARTIAL_ACCEPTANCE",
  "MAINTENANCE_RECORD"
];
const SELLER_TAX_ID_TYPES: DocumentType[] = ["CONTRACT", "CONTRACT_ADDENDUM", "NDA", "PROPOSAL"];
const company = companySettings("full");

const rendered = new Map<string, string>();
const key = (type: DocumentType, language: DocumentLanguage, variant: FixtureVariant) => `${type}.${language}.${variant}`;
const html = (type: DocumentType, language: DocumentLanguage, variant: FixtureVariant) => {
  const value = rendered.get(key(type, language, variant));
  if (value === undefined) throw new Error(`not rendered: ${key(type, language, variant)}`);
  return value;
};
const visible = (type: DocumentType, language: DocumentLanguage, variant: FixtureVariant) =>
  stripStyles(html(type, language, variant));

beforeAll(async () => {
  jest.useFakeTimers(DATE_ONLY_FAKE_TIMERS as never);
  for (const variant of VARIANTS) {
    const harness = await createRenderHarness(variant);
    for (const type of ALL_DOCUMENT_TYPES) {
      for (const language of ALL_LANGUAGES) {
        rendered.set(key(type, language, variant), await harness.render(type, language));
      }
    }
  }
});

afterAll(() => {
  jest.useRealTimers();
});

describe.each(VARIANTS)("document HTML (%s fixture)", (variant) => {
  describe.each(ALL_DOCUMENT_TYPES)("%s", (type) => {
    describe.each(ALL_LANGUAGES)("%s", (language) => {
      it("is a complete HTML document with a body", () => {
        const out = html(type, language, variant);
        expect(out.startsWith("<!doctype html>")).toBe(true);
        expect(stripStyles(out).replace(/<[^>]+>/g, "").trim().length).toBeGreaterThan(200);
      });

      it("never leaks undefined / null / NaN / [object …]", () => {
        const out = visible(type, language, variant);
        expect(out).not.toMatch(/\bundefined\b/);
        expect(out).not.toMatch(/\bnull\b/);
        expect(out).not.toMatch(/\bNaN\b/);
        expect(out).not.toMatch(/\[object /);
      });

      ratchet("E-01", type)("has no unresolved {{placeholder}}", () => {
        expect(visible(type, language, variant)).not.toContain("{{");
      });

      ratchet("E-11", type)("prints no raw i18n title key", () => {
        expect(visible(type, language, variant)).not.toMatch(/document_title_|DOCUMENT_TITLE_/);
      });

      ratchet("E-06b", type)("never doubles the currency word in amounts in words", () => {
        expect(visible(type, language, variant)).not.toMatch(/đồng\s+đồng/);
      });

      ratchet("E-04", type)("does not glue a dd/mm/yyyy date onto the document number", () => {
        expect(visible(type, language, variant)).not.toMatch(/[A-ZĐ]{2,}[A-ZĐ-]*-[^<\s]*?(?:\/|PL-)\d{2}\/\d{2}\/\d{4}/);
      });

      if (HBS_TYPES.includes(type)) {
        ratchet("E-13", type)("has running page numbers instead of an empty .pageNumber span", () => {
          const out = html(type, language, variant);
          expect(out).not.toContain('<span class="pageNumber"></span>');
          expect(out).toMatch(/@bottom-right\s*\{[^}]*counter\(page\)[^}]*counter\(pages\)/);
        });
      }

      if (SELLER_TAX_ID_TYPES.includes(type)) {
        ratchet("E-02", type)("prints the AHSO tax id stored as settings key `taxId`", () => {
          expect(visible(type, language, variant)).toContain(String(company.taxId));
        });
      }

      if (OPENING_SENTENCE_TYPES.includes(type) && language === "vi") {
        ratchet("E-01", type)("opening sentence carries the render date in Asia/Ho_Chi_Minh", () => {
          const out = visible(type, language, variant);
          // FIXTURE_NOW = 2026-10-27T17:30Z = 28/10/2026 00:30 ICT
          expect(out).toContain("Hôm nay, ngày 28 tháng 10 năm 2026");
          expect(out).not.toMatch(/ngày\s+ngày/);
        });
      }
    });
  });
});

describe("specific data rules", () => {
  ratchet("E-01", "location")("CONTRACT / NDA opening sentence uses the company address as location", () => {
    for (const type of ["CONTRACT", "NDA"] as DocumentType[]) {
      expect(visible(type, "vi", "full")).toContain(`tại ${company.address}`);
    }
  });

  ratchet("E-06a")("a milestone without amount prints an em dash, never 0", () => {
    const out = visible("CONTRACT", "vi", "minimal");
    expect(out).toContain("Thanh toán sau nghiệm thu - —");
    expect(out).not.toMatch(/Thanh toán sau nghiệm thu - 0/);
  });

  it("real zero amounts still print 0 (AR totals without contracts)", () => {
    expect(visible("AR_RECONCILIATION", "vi", "minimal")).toContain("0 VND");
  });

  it("CONTRACT prints the contract value in figures and words", () => {
    const out = visible("CONTRACT", "vi", "full");
    expect(out).toContain("88.410.000 VND");
    expect(out).toContain("Tám mươi tám triệu bốn trăm mười nghìn đồng");
  });
});
