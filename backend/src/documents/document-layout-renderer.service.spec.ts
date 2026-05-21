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
});
