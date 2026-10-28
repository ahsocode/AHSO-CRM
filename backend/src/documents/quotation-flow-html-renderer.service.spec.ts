import { QuotationFlowHtmlRendererService } from "./quotation-flow-html-renderer.service";

describe("QuotationFlowHtmlRendererService", () => {
  const service = new QuotationFlowHtmlRendererService();

  const context = {
    logo: "data:image/png;base64,abc",
    company: {
      name: "CÔNG TY TNHH AHSO",
      taxCode: "0316896939",
      address: "39/15 Đường Cao Bá Quát, TP.HCM",
      phone: "0901951351",
      email: "sales@ahso.vn",
      website: "https://www.ahso.vn",
      representative: "Ngô Văn Hùng",
      representativeTitle: "Giám đốc"
    },
    customer: {
      name: "CÔNG TY KIỂM THỬ",
      address: "Hà Nội",
      phone: "02432001111",
      email: "buyer@example.com"
    },
    primaryContact: {
      name: "Trần Thu Hà"
    },
    project: {
      name: "Dự án kiểm thử PDF"
    },
    quote: {
      quoteNo: "BG-2026-001",
      version: 2,
      validUntil: "2026-07-06T00:00:00.000Z",
      subtotal: 100000000,
      taxRate: 8,
      taxAmount: 8000000,
      total: 108000000,
      terms: "Thanh toán 50% khi xác nhận đơn hàng.",
      deliveryTerms: "Giao hàng trong 30 ngày.",
      tableColumnWidths: {
        index: 5,
        name: 30,
        description: 35,
        quantity: 6,
        unitPrice: 12,
        total: 12
      }
    },
    items: [
      {
        name: "Máy đóng gói",
        description: "Mô tả dài\nCó xuống dòng",
        unit: "Bộ",
        quantity: 1,
        unitPrice: 100000000,
        total: 100000000
      }
    ]
  };

  it("renders semantic quotation HTML with table header/body and commercial sections", () => {
    const html = service.renderBody(context, "vi");

    expect(html).toContain("<thead>");
    expect(html).toContain("<tbody>");
    expect(html).toContain("<colgroup>");
    expect(html).toContain("Điều khoản thanh toán");
    expect(html).toContain("Tạm tính");
    expect(html).toContain("ĐẠI DIỆN AHSO");
  });

  it("applies saved quotation table column widths to the colgroup", () => {
    const html = service.renderBody(context, "vi");

    expect(html).toContain('style="width: 5.0000%"');
    expect(html).toContain('style="width: 30.0000%"');
    expect(html).toContain('style="width: 35.0000%"');
  });

  it("exposes print CSS for automatic pagination and repeated table headers", () => {
    const css = service.getCss();

    expect(css).toContain("@page");
    expect(css).toContain("display: table-header-group");
    expect(css).toContain("break-inside: avoid");
  });

  it("keeps a single VAT row for legacy quotes without taxBreakdown", () => {
    const html = service.renderBody(context, "vi");

    expect(html).toContain("Thuế (8%)");
    expect(html).not.toContain("Không chịu thuế");
  });

  it("renders one VAT row per breakdown group, KCT last, summing to the grand total", () => {
    const multi = {
      ...context,
      quote: {
        ...context.quote,
        subtotal: 300000,
        taxAmount: 18000,
        total: 318000,
        taxBreakdown: [
          { rate: 10, base: 100000, tax: 10000 },
          { rate: 8, base: 100000, tax: 8000 },
          { rate: null, base: 100000, tax: 0 }
        ]
      }
    };

    const viHtml = service.renderBody(multi, "vi");
    expect(viHtml).toContain("Thuế (10%)");
    expect(viHtml).toContain("Thuế (8%)");
    expect(viHtml.indexOf("Thuế (10%)")).toBeLessThan(viHtml.indexOf("Thuế (8%)"));
    expect(viHtml.indexOf("Thuế (8%)")).toBeLessThan(viHtml.indexOf("Không chịu thuế (KCT)"));

    const enHtml = service.renderBody(multi, "vi-en");
    expect(enHtml).toContain("VAT (10%)");
    expect(enHtml).toContain("Non-taxable (KCT)");
  });
});
