import { QuotationFlowHtmlRendererService } from "./quotation-flow-html-renderer.service";

describe("QuotationFlowHtmlRendererService dates (audit E-08)", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("prints validUntil as the Vietnamese calendar day whatever the container TZ", () => {
    process.env.TZ = "UTC";
    const html = new QuotationFlowHtmlRendererService().renderBody(
      { quote: { quoteNo: "BG-2026-059", validUntil: "2026-11-25T17:30:00.000Z", subtotal: 0, total: 0 }, items: [] },
      "vi"
    );
    expect(html).toContain("26/11/2026");
    expect(html).not.toContain("25/11/2026");
  });
});
