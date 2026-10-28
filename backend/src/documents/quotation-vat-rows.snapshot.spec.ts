import { readFileSync } from "fs";
import { join } from "path";
import {
  DATE_ONLY_FAKE_TIMERS,
  createRenderHarness,
  extractQuotationSummary,
  type RenderHarness
} from "./__fixtures__/document-fixtures";

/**
 * QUOTATION totals/VAT rows must stay BYTE-IDENTICAL to the "before" HTML captured before the
 * template-standardisation work (audit section 4, rule 1). Styling changes must not touch them.
 * The baselines were rendered from the real QuotationFlowHtmlRendererService + loader VAT grouping.
 */
const BASELINE_DIR = join(__dirname, "__fixtures__", "quotation-vat");
const CASES = [
  { name: "multi-group-kct", variant: "full", entityId: "quote-orion" },
  { name: "single-group", variant: "full", entityId: "quote-single" },
  { name: "no-items-legacy", variant: "minimal", entityId: "quote-orion" }
] as const;

describe("QUOTATION VAT rows (byte-identical to before-snapshot)", () => {
  const harnesses: Partial<Record<"full" | "minimal", RenderHarness>> = {};

  beforeAll(async () => {
    jest.useFakeTimers(DATE_ONLY_FAKE_TIMERS as never);
    harnesses.full = await createRenderHarness("full");
    harnesses.minimal = await createRenderHarness("minimal");
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe.each(CASES)("$name", ({ name, variant, entityId }) => {
    it.each(["vi", "vi-en"] as const)("%s", async (language) => {
      const html = await harnesses[variant]!.render("QUOTATION", language, entityId);
      const before = readFileSync(join(BASELINE_DIR, `${name}.${language}.before.html`), "utf-8");
      expect(extractQuotationSummary(html)).toBe(before);
    });
  });

  it("baseline itself encodes the per-group VAT rule (8% on 70.750.000, KCT last)", () => {
    const before = readFileSync(join(BASELINE_DIR, "multi-group-kct.vi.before.html"), "utf-8");
    const vatRow = before.indexOf("VAT 8% (trên 70.750.000 đ)");
    const kctRow = before.indexOf("Không chịu thuế (KCT) (trên 12.000.000 đ)");
    expect(vatRow).toBeGreaterThan(0);
    expect(kctRow).toBeGreaterThan(vatRow);
    expect(before).toContain("<td>5.660.000</td>");
    expect(before).toContain("<td>88.410.000</td>");
  });
});
