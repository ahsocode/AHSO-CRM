import { DocumentLayoutRendererService } from "./document-layout-renderer.service";
import type { DocumentTemplateLayout } from "./document-template.types";

describe("DocumentLayoutRendererService", () => {
  const service = new DocumentLayoutRendererService();

  it("renders key-value values with long customer addresses and PDF-safe wrapping styles", () => {
    const layout: DocumentTemplateLayout = {
      version: 1,
      page: {
        widthMm: 210,
        heightMm: 297,
        gridMm: 5,
        marginMm: {
          top: 12,
          right: 12,
          bottom: 12,
          left: 12
        }
      },
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
});
