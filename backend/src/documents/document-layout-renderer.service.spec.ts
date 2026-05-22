import { DocumentLayoutRendererService } from "./document-layout-renderer.service";
import type { DocumentTemplateLayout } from "./document-template.types";

describe("DocumentLayoutRendererService", () => {
  const service = new DocumentLayoutRendererService();
  const basePage: DocumentTemplateLayout["page"] = {
    widthMm: 210,
    heightMm: 297,
    gridMm: 5,
    marginMm: {
      top: 12,
      right: 12,
      bottom: 12,
      left: 12
    }
  };

  function countPages(html: string) {
    return html.match(/schema-document__page/g)?.length ?? 0;
  }

  it("renders key-value values with long customer addresses and PDF-safe wrapping styles", () => {
    const layout: DocumentTemplateLayout = {
      version: 1,
      page: basePage,
      pages: [
        {
          id: "page-1",
          boxes: [
            {
              id: "customer-info",
              type: "key_value_table",
              page: 0,
              x: 12,
              y: 20,
              width: 90,
              height: 30,
              zIndex: 10,
              visible: true,
              style: {
                textAlign: "left",
                fontSize: 9.6,
                lineHeight: 1.35,
                padding: 2
              },
              content: {
                labelWidth: 30,
                rows: [
                  {
                    id: "customer-address",
                    label: {
                      vi: "Địa chỉ"
                    },
                    value: "{{customer.address}}"
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const html = service.render(
      layout,
      {
        customer: {
          address: "Lô E.01, Đường Trung Tâm, Khu công nghiệp Long Hậu, Xã Cần Giuộc, Tỉnh Tây Ninh, Việt Nam"
        }
      },
      "vi"
    );
    const css = service.getCss();

    expect(html).toContain("Lô E.01, Đường Trung Tâm");
    expect(html).toContain("schema-document__kv-value");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("white-space: pre-wrap");
  });

  it("paginates long line item tables and repeats the table header on continuation pages", () => {
    const layout: DocumentTemplateLayout = {
      version: 1,
      page: basePage,
      pages: [
        {
          id: "page-1",
          boxes: [
            {
              id: "doc-title",
              type: "text",
              page: 0,
              x: 12,
              y: 12,
              width: 186,
              height: 12,
              zIndex: 1,
              visible: true,
              style: { fontSize: 14, fontWeight: 700, lineHeight: 1.2 },
              content: { text: { vi: "BÁO GIÁ" } }
            },
            {
              id: "doc-meta",
              type: "text",
              page: 0,
              x: 12,
              y: 26,
              width: 186,
              height: 10,
              zIndex: 1,
              visible: true,
              style: { fontSize: 8, lineHeight: 1.2 },
              content: { text: { vi: "Số báo giá: {{quote.quoteNo}}" } }
            },
            {
              id: "line-items",
              type: "line_items_table",
              page: 0,
              x: 12,
              y: 48,
              width: 186,
              height: 118,
              zIndex: 2,
              visible: true,
              style: { fontSize: 9, lineHeight: 1.35, padding: 1 },
              content: {
                source: "items",
                columns: [
                  { id: "index", label: { vi: "STT" }, value: "{{index}}", align: "center" },
                  { id: "name", label: { vi: "Hạng mục" }, value: "{{name}}" },
                  { id: "description", label: { vi: "Mô tả" }, value: "{{description}}" },
                  { id: "quantity", label: { vi: "SL" }, value: "{{quantity}}", align: "center" },
                  { id: "unitPrice", label: { vi: "Đơn giá" }, value: "{{unitPrice|currency}}", align: "right" },
                  { id: "total", label: { vi: "Thành tiền" }, value: "{{total|currency}}", align: "right" }
                ]
              }
            },
            {
              id: "signature",
              type: "signature_block",
              page: 0,
              x: 12,
              y: 178,
              width: 186,
              height: 45,
              zIndex: 3,
              visible: true,
              style: { fontSize: 9, lineHeight: 1.3 },
              content: {
                leftTitle: { vi: "ĐẠI DIỆN AHSO" },
                rightTitle: { vi: "ĐẠI DIỆN KHÁCH HÀNG" }
              }
            }
          ]
        }
      ]
    };
    const description = [
      "Bộ phận đếm sản phẩm, hệ thống feeder cấp liệu, cơ cấu tách sản phẩm,",
      "camera và phần mềm AI nhận diện lỗi, băng tải dẫn sản phẩm và module đóng gói tự động."
    ].join(" ");
    const items = Array.from({ length: 18 }, (_, index) => ({
      name: `Hạng mục ${index + 1}`,
      description,
      quantity: 1,
      unitPrice: 1000000,
      total: 1000000
    }));

    const html = service.render(layout, { quote: { quoteNo: "BG-2026-001" }, items }, "vi");

    expect(countPages(html)).toBeGreaterThan(1);
    expect(html.match(/Hạng mục/g)?.length ?? 0).toBeGreaterThan(1);
    expect(html).toContain("Trang 2");
    expect(html).toContain("ĐẠI DIỆN KHÁCH HÀNG");
  });

  it("splits long text boxes across multiple render pages", () => {
    const layout: DocumentTemplateLayout = {
      version: 1,
      page: basePage,
      pages: [
        {
          id: "page-1",
          boxes: [
            {
              id: "long-terms",
              type: "text",
              page: 0,
              x: 12,
              y: 20,
              width: 186,
              height: 40,
              zIndex: 1,
              visible: true,
              style: { fontSize: 10, lineHeight: 1.35, padding: 1 },
              content: {
                text: {
                  vi: Array.from({ length: 80 }, (_, index) => `Điều khoản triển khai số ${index + 1}: nội dung kiểm thử phân trang tự động.`).join("\n")
                }
              }
            }
          ]
        }
      ]
    };

    const html = service.render(layout, {}, "vi");

    expect(countPages(html)).toBeGreaterThan(1);
    expect(html).toContain("Điều khoản triển khai số 1");
    expect(html).toContain("Điều khoản triển khai số 80");
  });

  it("applies quote-specific line item column widths without changing the template", () => {
    const layout: DocumentTemplateLayout = {
      version: 1,
      page: basePage,
      pages: [
        {
          id: "page-1",
          boxes: [
            {
              id: "quote-items",
              type: "line_items_table",
              page: 0,
              x: 12,
              y: 48,
              width: 186,
              height: 80,
              zIndex: 2,
              visible: true,
              style: { fontSize: 9, lineHeight: 1.35, padding: 1 },
              content: {
                source: "items",
                columns: [
                  { id: "stt", label: { vi: "STT" }, value: "{{index}}", width: 10, align: "center" },
                  { id: "name", label: { vi: "Hạng mục" }, value: "{{name}}", width: 58 },
                  { id: "description", label: { vi: "Mô tả" }, value: "{{description}}", width: 48 },
                  { id: "qty", label: { vi: "SL" }, value: "{{quantity}}", width: 14, align: "center" },
                  { id: "unit", label: { vi: "Đơn giá" }, value: "{{unitPrice|currency}}", width: 28, align: "right" },
                  { id: "total", label: { vi: "Thành tiền" }, value: "{{total|currency}}", width: 28, align: "right" }
                ]
              }
            }
          ]
        }
      ]
    };

    const html = service.render(
      layout,
      {
        quote: {
          tableColumnWidths: {
            index: 5,
            name: 30,
            description: 35,
            quantity: 5,
            unitPrice: 10,
            total: 15
          }
        },
        items: [{ name: "Máy đóng gói", description: "Mô tả dài", quantity: 1, unitPrice: 1000, total: 1000 }]
      },
      "vi"
    );

    expect(html).toContain('width:35.0000%');
    expect(html).toContain('width:30.0000%');
    expect(html).toContain('width:15.0000%');
  });

  it("lets a line item table grow instead of splitting while it still fits the page", () => {
    const layout: DocumentTemplateLayout = {
      version: 1,
      page: basePage,
      pages: [
        {
          id: "page-1",
          boxes: [
            {
              id: "quote-items",
              type: "line_items_table",
              page: 0,
              x: 12,
              y: 146,
              width: 186,
              height: 72,
              zIndex: 2,
              visible: true,
              style: { fontSize: 9.2, lineHeight: 1.35, padding: 2 },
              content: {
                source: "items",
                columns: [
                  { id: "stt", label: { vi: "STT" }, value: "{{index}}", width: 10, align: "center" },
                  { id: "name", label: { vi: "Hạng mục" }, value: "{{name}}", width: 58 },
                  { id: "description", label: { vi: "Mô tả" }, value: "{{description}}", width: 48 },
                  { id: "qty", label: { vi: "SL" }, value: "{{quantity}}", width: 14, align: "center" },
                  { id: "unit", label: { vi: "Đơn giá" }, value: "{{unitPrice|currency}}", width: 28, align: "right" },
                  { id: "total", label: { vi: "Thành tiền" }, value: "{{total|currency}}", width: 28, align: "right" }
                ]
              }
            }
          ]
        }
      ]
    };
    const description = "Cảm biến inline tích hợp cảnh báo và hỗ trợ nghiệm thu.";
    const items = Array.from({ length: 6 }, (_, index) => ({
      name: `Hạng mục kiểm tra chất lượng ${index + 1}`,
      description,
      quantity: 1,
      unitPrice: 1000000,
      total: 1000000
    }));

    const html = service.render(layout, { items }, "vi");

    expect(countPages(html)).toBe(1);
    expect(html.match(/schema-document__table/g)?.length ?? 0).toBe(1);
    expect(html).not.toContain("__flow_table_2");
  });

  it("keeps a signature block on the same page when the original spacing fits", () => {
    const layout: DocumentTemplateLayout = {
      version: 1,
      page: basePage,
      pages: [
        {
          id: "page-1",
          boxes: [
            {
              id: "quote-terms",
              type: "text",
              page: 0,
              x: 12,
              y: 222,
              width: 108,
              height: 42,
              zIndex: 1,
              visible: true,
              style: { fontSize: 9.4, lineHeight: 1.45, padding: 2 },
              content: {
                text: {
                  vi: "Điều khoản thanh toán:\nThanh toán 50% khi xác nhận đơn hàng.\n\nĐiều khoản giao hàng:\nTriển khai sau khi nhận PO."
                }
              }
            },
            {
              id: "quote-summary",
              type: "key_value_table",
              page: 0,
              x: 126,
              y: 222,
              width: 72,
              height: 42,
              zIndex: 1,
              visible: true,
              style: { fontSize: 9.8, lineHeight: 1.5, padding: 2 },
              content: {
                labelWidth: 28,
                rows: [
                  { id: "subtotal", label: { vi: "Tạm tính" }, value: "6.840.000" },
                  { id: "tax", label: { vi: "Thuế" }, value: "547.200" },
                  { id: "total", label: { vi: "Tổng cộng" }, value: "7.387.200" }
                ]
              }
            },
            {
              id: "quote-signature",
              type: "signature_block",
              page: 0,
              x: 12,
              y: 266,
              width: 186,
              height: 18,
              zIndex: 1,
              visible: true,
              style: { fontSize: 9.8, lineHeight: 1.35, padding: 1 },
              content: {
                leftTitle: { vi: "ĐẠI DIỆN AHSO" },
                rightTitle: { vi: "ĐẠI DIỆN KHÁCH HÀNG" }
              }
            }
          ]
        }
      ]
    };

    const html = service.render(layout, {}, "vi");

    expect(countPages(html)).toBe(1);
    expect(html).toContain("ĐẠI DIỆN KHÁCH HÀNG");
    expect(html).not.toContain("Trang 2");
  });
});
