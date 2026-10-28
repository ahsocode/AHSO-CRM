import { readFileSync } from "fs";
import { join } from "path";
import {
  DATE_ONLY_FAKE_TIMERS,
  createRenderHarness,
  extractLegalArticlesText
} from "./__fixtures__/document-fixtures";

/**
 * Contract / addendum / NDA article wording lock (audit section 4, rule 2): the rendered text of every
 * "Điều" must stay identical to the reviewed baseline. Only an approved per-clause change (L-xx) may
 * update `__fixtures__/legal-articles.before.json`.
 */
const baseline = JSON.parse(
  readFileSync(join(__dirname, "__fixtures__", "legal-articles.before.json"), "utf-8")
) as Record<string, string>;

describe("legal article wording", () => {
  beforeAll(() => {
    jest.useFakeTimers(DATE_ONLY_FAKE_TIMERS as never);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it.each(Object.keys(baseline))("%s is unchanged", async (caseKey) => {
    const [type, language] = caseKey.split(".") as ["CONTRACT" | "CONTRACT_ADDENDUM" | "NDA", "vi" | "vi-en"];
    const harness = await createRenderHarness("full");
    expect(extractLegalArticlesText(await harness.render(type, language))).toBe(baseline[caseKey]);
  });
});
