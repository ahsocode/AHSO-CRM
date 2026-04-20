import { DocumentType } from "@prisma/client";
import { getTemplateEntry } from "./template-registry";
import type {
  DocumentTemplateLayout,
  TemplateBox,
  TemplateBoxLibraryItem,
  TemplateCatalog,
  TemplateLocalizedText,
  TemplateTokenGroup
} from "./document-template.types";
import {
  A4_PAGE_HEIGHT_MM,
  A4_PAGE_WIDTH_MM,
  DEFAULT_GRID_MM,
  DEFAULT_PAGE_MARGIN_MM
} from "./document-template.types";

function localize(vi: string, viEn?: string): TemplateLocalizedText {
  return {
    vi,
    viEn
  };
}

function createBaseLayout(boxes: TemplateBox[]): DocumentTemplateLayout {
  return {
    version: 1,
    page: {
      widthMm: A4_PAGE_WIDTH_MM,
      heightMm: A4_PAGE_HEIGHT_MM,
      gridMm: DEFAULT_GRID_MM,
      marginMm: { ...DEFAULT_PAGE_MARGIN_MM }
    },
    pages: [
      {
        id: "page-1",
        boxes
      }
    ]
  };
}

function cloneLayout(layout: DocumentTemplateLayout): DocumentTemplateLayout {
  return JSON.parse(JSON.stringify(layout)) as DocumentTemplateLayout;
}

function createDefaultBoxLibrary(): TemplateBoxLibraryItem[] {
  return [
    {
      type: "text",
      label: "Text Box",
      description: "Đoạn văn bản tĩnh hoặc dùng token động.",
      defaultBox: {
        id: "box-text",
        type: "text",
        page: 0,
        x: 15,
        y: 15,
        width: 70,
        height: 24,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 10,
          lineHeight: 1.45,
          padding: 3,
          color: "#0f172a"
        },
        content: {
          text: localize("{{company.name}}", "{{company.name}}")
        }
      }
    },
    {
      type: "image",
      label: "Image / Logo",
      description: "Khối ảnh cho logo hoặc chữ ký.",
      defaultBox: {
        id: "box-image",
        type: "image",
        page: 0,
        x: 15,
        y: 15,
        width: 34,
        height: 18,
        zIndex: 10,
        visible: true,
        content: {
          src: "{{logo}}",
          alt: "Logo công ty",
          fit: "contain"
        }
      }
    },
    {
      type: "key_value_table",
      label: "Key / Value Table",
      description: "Bảng thông tin hai cột cho công ty, khách hàng hoặc điều khoản.",
      defaultBox: {
        id: "box-kv",
        type: "key_value_table",
        page: 0,
        x: 15,
        y: 42,
        width: 80,
        height: 52,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 9.5,
          lineHeight: 1.35,
          padding: 2
        },
        content: {
          labelWidth: 30,
          rows: [
            {
              id: "row-1",
              label: localize("Tên", "Name"),
              value: "{{customer.name}}"
            },
            {
              id: "row-2",
              label: localize("Địa chỉ", "Address"),
              value: "{{customer.address}}"
            }
          ]
        }
      }
    },
    {
      type: "line_items_table",
      label: "Line Items Table",
      description: "Bảng danh sách hạng mục từ quote/items.",
      defaultBox: {
        id: "box-items",
        type: "line_items_table",
        page: 0,
        x: 15,
        y: 110,
        width: 180,
        height: 80,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 9,
          lineHeight: 1.3,
          padding: 2
        },
        content: {
          source: "items",
          columns: [
            {
              id: "col-index",
              label: localize("STT", "No."),
              value: "{{index}}",
              width: 12,
              align: "center"
            },
            {
              id: "col-name",
              label: localize("Hạng mục", "Item"),
              value: "{{name}}",
              width: 80,
              align: "left"
            },
            {
              id: "col-qty",
              label: localize("SL", "Qty"),
              value: "{{quantity}}",
              width: 18,
              align: "center"
            },
            {
              id: "col-unit-price",
              label: localize("Đơn giá", "Unit Price"),
              value: "{{unitPrice|currency}}",
              width: 34,
              align: "right"
            },
            {
              id: "col-total",
              label: localize("Thành tiền", "Amount"),
              value: "{{total|currency}}",
              width: 36,
              align: "right"
            }
          ],
          emptyText: localize("Chưa có dữ liệu", "No line items")
        }
      }
    },
    {
      type: "signature_block",
      label: "Signature Block",
      description: "Khối ký xác nhận hai bên.",
      defaultBox: {
        id: "box-signature",
        type: "signature_block",
        page: 0,
        x: 15,
        y: 236,
        width: 180,
        height: 40,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 10,
          lineHeight: 1.4,
          padding: 2
        },
        content: {
          leftTitle: localize("ĐẠI DIỆN AHSO", "AHSO REPRESENTATIVE"),
          rightTitle: localize("ĐẠI DIỆN KHÁCH HÀNG", "CUSTOMER REPRESENTATIVE"),
          leftCaption: localize("Ký, ghi rõ họ tên", "Sign and full name"),
          rightCaption: localize("Ký, ghi rõ họ tên", "Sign and full name")
        }
      }
    }
  ];
}

const QUOTATION_TOKENS: TemplateTokenGroup[] = [
  {
    id: "company",
    label: "Công ty",
    tokens: [
      { key: "company.name", label: "Tên công ty", description: "Tên pháp lý của công ty." },
      { key: "company.taxId", label: "Mã số thuế", description: "MST hiện tại trong settings." },
      { key: "company.address", label: "Địa chỉ", description: "Địa chỉ công ty." },
      { key: "company.phone", label: "Điện thoại", description: "Số điện thoại công ty." },
      { key: "company.email", label: "Email", description: "Email công ty." },
      { key: "company.website", label: "Website", description: "Website công ty." },
      { key: "logo", label: "Logo", description: "Logo hiện tại của công ty." }
    ]
  },
  {
    id: "quote",
    label: "Báo giá",
    tokens: [
      { key: "quote.quoteNo", label: "Số báo giá", description: "Mã số báo giá." },
      { key: "quote.version", label: "Phiên bản", description: "Số version báo giá." },
      { key: "quote.validUntil", label: "Hiệu lực đến", description: "Ngày hết hiệu lực." },
      { key: "quote.total", label: "Tổng tiền", description: "Tổng giá trị báo giá." },
      { key: "quote.taxAmount", label: "Thuế", description: "Giá trị thuế." },
      { key: "quote.terms", label: "Điều khoản thanh toán", description: "Điều khoản thanh toán riêng của báo giá." },
      { key: "quote.deliveryTerms", label: "Điều khoản giao hàng", description: "Điều khoản giao hàng hoặc triển khai." }
    ]
  },
  {
    id: "customer",
    label: "Khách hàng",
    tokens: [
      { key: "customer.name", label: "Tên khách hàng", description: "Tên công ty khách hàng." },
      { key: "customer.address", label: "Địa chỉ khách hàng", description: "Địa chỉ khách hàng." },
      { key: "customer.phone", label: "Điện thoại khách hàng", description: "Điện thoại khách hàng." },
      { key: "customer.email", label: "Email khách hàng", description: "Email khách hàng." },
      { key: "primaryContact.name", label: "Người liên hệ", description: "Người liên hệ chính." }
    ]
  },
  {
    id: "items",
    label: "Hạng mục",
    tokens: [
      { key: "items", label: "Danh sách hạng mục", description: "Nguồn dữ liệu cho bảng line items." },
      { key: "items[].name", label: "Tên hạng mục", description: "Tên dòng hàng." },
      { key: "items[].quantity", label: "Số lượng", description: "Số lượng từng dòng." },
      { key: "items[].unitPrice", label: "Đơn giá", description: "Đơn giá từng dòng." },
      { key: "items[].total", label: "Thành tiền", description: "Thành tiền từng dòng." }
    ]
  }
];

const CONTRACT_TOKENS: TemplateTokenGroup[] = [
  {
    id: "company",
    label: "Công ty",
    tokens: QUOTATION_TOKENS[0].tokens
  },
  {
    id: "contract",
    label: "Hợp đồng",
    tokens: [
      { key: "contract.contractNo", label: "Số hợp đồng", description: "Mã hợp đồng." },
      { key: "contract.signDate", label: "Ngày ký", description: "Ngày ký hợp đồng." },
      { key: "contract.startDate", label: "Ngày bắt đầu", description: "Ngày bắt đầu hiệu lực." },
      { key: "contract.endDate", label: "Ngày kết thúc", description: "Ngày kết thúc hiệu lực." },
      { key: "contract.value", label: "Giá trị hợp đồng", description: "Giá trị hợp đồng." },
      { key: "contract.notes", label: "Ghi chú hợp đồng", description: "Phần ghi chú hợp đồng." }
    ]
  },
  {
    id: "project-customer",
    label: "Dự án & khách hàng",
    tokens: [
      { key: "project.name", label: "Tên dự án", description: "Tên dự án liên quan." },
      { key: "customer.name", label: "Tên khách hàng", description: "Tên khách hàng." },
      { key: "customer.address", label: "Địa chỉ khách hàng", description: "Địa chỉ khách hàng." },
      { key: "primaryContact.name", label: "Người liên hệ", description: "Người liên hệ chính." },
      { key: "linkedQuote.items", label: "Hạng mục từ báo giá", description: "Nguồn bảng hạng mục nếu hợp đồng đi từ báo giá." }
    ]
  },
  {
    id: "milestones",
    label: "Mốc nghiệm thu",
    tokens: [
      { key: "milestones", label: "Danh sách milestone", description: "Toàn bộ milestone của hợp đồng." },
      { key: "policies.paymentTerms", label: "Chính sách thanh toán", description: "Điều khoản mặc định từ settings." },
      { key: "policies.warranty", label: "Bảo hành", description: "Chính sách bảo hành." }
    ]
  }
];

function createQuotationLayout(): DocumentTemplateLayout {
  return createBaseLayout([
    {
      id: "quote-logo",
      type: "image",
      page: 0,
      x: 12,
      y: 12,
      width: 36,
      height: 18,
      zIndex: 10,
      visible: true,
      content: {
        src: "{{logo}}",
        alt: "Logo",
        fit: "contain"
      }
    },
    {
      id: "quote-title",
      type: "text",
      page: 0,
      x: 120,
      y: 12,
      width: 78,
      height: 18,
      zIndex: 20,
      visible: true,
      style: {
        fontSize: 18,
        fontWeight: 700,
        textAlign: "right",
        lineHeight: 1.25,
        color: "#1e3a5f"
      },
      content: {
        text: localize("BÁO GIÁ", "BÁO GIÁ / QUOTATION")
      }
    },
    {
      id: "quote-company",
      type: "key_value_table",
      page: 0,
      x: 12,
      y: 38,
      width: 88,
      height: 54,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.6,
        lineHeight: 1.35,
        padding: 2
      },
      content: {
        labelWidth: 29,
        rows: [
          { id: "company-name", label: localize("Công ty", "Company"), value: "{{company.name}}" },
          { id: "company-tax", label: localize("MST", "Tax ID"), value: "{{company.taxId}}" },
          { id: "company-address", label: localize("Địa chỉ", "Address"), value: "{{company.address}}" },
          { id: "company-phone", label: localize("Điện thoại", "Phone"), value: "{{company.phone}}" },
          { id: "company-email", label: localize("Email", "Email"), value: "{{company.email}}" },
          { id: "company-website", label: localize("Website", "Website"), value: "{{company.website}}" }
        ]
      }
    },
    {
      id: "quote-customer",
      type: "key_value_table",
      page: 0,
      x: 108,
      y: 38,
      width: 90,
      height: 54,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.6,
        lineHeight: 1.35,
        padding: 2
      },
      content: {
        labelWidth: 30,
        rows: [
          { id: "customer-name", label: localize("Khách hàng", "Customer"), value: "{{customer.name}}" },
          { id: "customer-address", label: localize("Địa chỉ", "Address"), value: "{{customer.address}}" },
          { id: "customer-phone", label: localize("Điện thoại", "Phone"), value: "{{customer.phone}}" },
          { id: "customer-email", label: localize("Email", "Email"), value: "{{customer.email}}" },
          { id: "customer-contact", label: localize("Người liên hệ", "Contact"), value: "{{primaryContact.name}}" }
        ]
      }
    },
    {
      id: "quote-meta",
      type: "text",
      page: 0,
      x: 12,
      y: 96,
      width: 186,
      height: 16,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 10.2,
        lineHeight: 1.4,
        padding: 2,
        borderWidth: 0.6,
        borderColor: "#cbd5e1",
        borderRadius: 4
      },
      content: {
        text: localize(
          "Số báo giá: {{quote.quoteNo}}  |  Phiên bản: {{quote.version}}  |  Hiệu lực: {{quote.validUntil|date}}",
          "Quotation No: {{quote.quoteNo}}  |  Version: {{quote.version}}  |  Valid Until: {{quote.validUntil|date}}"
        )
      }
    },
    {
      id: "quote-intro",
      type: "text",
      page: 0,
      x: 12,
      y: 116,
      width: 186,
      height: 26,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 10.1,
        lineHeight: 1.45,
        padding: 2
      },
      content: {
        text: localize(
          "AHSO trân trọng gửi tới {{customer.name}} báo giá cho dự án {{project.name}}. Chúng tôi tin rằng giải pháp này phù hợp với mục tiêu vận hành và tăng trưởng của doanh nghiệp.",
          "AHSO respectfully submits this quotation to {{customer.name}} for project {{project.name}}. We believe this solution is aligned with your operational and growth goals."
        )
      }
    },
    {
      id: "quote-items",
      type: "line_items_table",
      page: 0,
      x: 12,
      y: 146,
      width: 186,
      height: 72,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.2,
        lineHeight: 1.35,
        padding: 2
      },
      content: {
        source: "items",
        columns: [
          { id: "stt", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
          { id: "name", label: localize("Hạng mục", "Item"), value: "{{name}}", width: 84, align: "left" },
          { id: "qty", label: localize("SL", "Qty"), value: "{{quantity}}", width: 18, align: "center" },
          { id: "unit", label: localize("Đơn giá", "Unit Price"), value: "{{unitPrice|currency}}", width: 34, align: "right" },
          { id: "total", label: localize("Thành tiền", "Amount"), value: "{{total|currency}}", width: 38, align: "right" }
        ],
        emptyText: localize("Chưa có dòng dữ liệu", "No line items")
      }
    },
    {
      id: "quote-terms",
      type: "text",
      page: 0,
      x: 12,
      y: 222,
      width: 108,
      height: 42,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.4,
        lineHeight: 1.45,
        padding: 2,
        borderWidth: 0.6,
        borderColor: "#cbd5e1",
        borderRadius: 4
      },
      content: {
        text: localize(
          "Điều khoản thanh toán:\n{{quote.terms}}\n\nĐiều khoản giao hàng / triển khai:\n{{quote.deliveryTerms}}",
          "Payment Terms:\n{{quote.terms}}\n\nDelivery / Service Terms:\n{{quote.deliveryTerms}}"
        )
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
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.8,
        lineHeight: 1.5,
        padding: 2
      },
      content: {
        labelWidth: 28,
        rows: [
          { id: "subtotal", label: localize("Tạm tính", "Subtotal"), value: "{{quote.subtotal|currency}}" },
          { id: "tax", label: localize("Thuế", "Tax"), value: "{{quote.taxAmount|currency}}" },
          { id: "total", label: localize("Tổng cộng", "Total"), value: "{{quote.total|currency}}" }
        ]
      }
    },
    {
      id: "quote-signature",
      type: "signature_block",
      page: 0,
      x: 12,
      y: 268,
      width: 186,
      height: 18,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.8,
        lineHeight: 1.35,
        padding: 1
      },
      content: {
        leftTitle: localize("ĐẠI DIỆN AHSO", "AHSO REPRESENTATIVE"),
        rightTitle: localize("ĐẠI DIỆN KHÁCH HÀNG", "CUSTOMER REPRESENTATIVE"),
        leftCaption: localize("Ký, ghi rõ họ tên", "Sign and full name"),
        rightCaption: localize("Ký, ghi rõ họ tên", "Sign and full name")
      }
    }
  ]);
}

function createContractLayout(): DocumentTemplateLayout {
  return createBaseLayout([
    {
      id: "contract-logo",
      type: "image",
      page: 0,
      x: 12,
      y: 12,
      width: 34,
      height: 18,
      zIndex: 10,
      visible: true,
      content: {
        src: "{{logo}}",
        alt: "Logo",
        fit: "contain"
      }
    },
    {
      id: "contract-title",
      type: "text",
      page: 0,
      x: 88,
      y: 12,
      width: 110,
      height: 18,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 17,
        fontWeight: 700,
        textAlign: "right",
        lineHeight: 1.25,
        color: "#1e3a5f"
      },
      content: {
        text: localize("HỢP ĐỒNG KINH TẾ", "HỢP ĐỒNG KINH TẾ / ECONOMIC CONTRACT")
      }
    },
    {
      id: "contract-meta",
      type: "text",
      page: 0,
      x: 12,
      y: 38,
      width: 186,
      height: 16,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 10.2,
        lineHeight: 1.4,
        padding: 2,
        borderWidth: 0.6,
        borderColor: "#cbd5e1",
        borderRadius: 4
      },
      content: {
        text: localize(
          "Số hợp đồng: {{contract.contractNo}}  |  Ngày ký: {{contract.signDate|date}}  |  Giá trị: {{contract.value|currency}}",
          "Contract No: {{contract.contractNo}}  |  Sign Date: {{contract.signDate|date}}  |  Value: {{contract.value|currency}}"
        )
      }
    },
    {
      id: "contract-party-a",
      type: "key_value_table",
      page: 0,
      x: 12,
      y: 60,
      width: 88,
      height: 56,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.6,
        lineHeight: 1.35,
        padding: 2
      },
      content: {
        labelWidth: 29,
        rows: [
          { id: "party-a-name", label: localize("Bên A", "Party A"), value: "{{company.name}}" },
          { id: "party-a-tax", label: localize("MST", "Tax ID"), value: "{{company.taxId}}" },
          { id: "party-a-address", label: localize("Địa chỉ", "Address"), value: "{{company.address}}" },
          { id: "party-a-phone", label: localize("Điện thoại", "Phone"), value: "{{company.phone}}" },
          { id: "party-a-email", label: localize("Email", "Email"), value: "{{company.email}}" }
        ]
      }
    },
    {
      id: "contract-party-b",
      type: "key_value_table",
      page: 0,
      x: 108,
      y: 60,
      width: 90,
      height: 56,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.6,
        lineHeight: 1.35,
        padding: 2
      },
      content: {
        labelWidth: 29,
        rows: [
          { id: "party-b-name", label: localize("Bên B", "Party B"), value: "{{customer.name}}" },
          { id: "party-b-address", label: localize("Địa chỉ", "Address"), value: "{{customer.address}}" },
          { id: "party-b-phone", label: localize("Điện thoại", "Phone"), value: "{{customer.phone}}" },
          { id: "party-b-email", label: localize("Email", "Email"), value: "{{customer.email}}" },
          { id: "party-b-contact", label: localize("Người liên hệ", "Contact"), value: "{{primaryContact.name}}" }
        ]
      }
    },
    {
      id: "contract-body",
      type: "text",
      page: 0,
      x: 12,
      y: 120,
      width: 186,
      height: 32,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 10,
        lineHeight: 1.5,
        padding: 2
      },
      content: {
        text: localize(
          "Hai bên thống nhất ký kết hợp đồng cho dự án {{project.name}} với phạm vi công việc theo báo giá liên quan. Việc thực hiện sẽ tuân theo các mốc, chính sách thanh toán và điều khoản dịch vụ đã thống nhất.",
          "Both parties agree to execute this contract for project {{project.name}} based on the related quotation scope, payment policy, and agreed service terms."
        )
      }
    },
    {
      id: "contract-items",
      type: "line_items_table",
      page: 0,
      x: 12,
      y: 156,
      width: 186,
      height: 62,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.1,
        lineHeight: 1.35,
        padding: 2
      },
      content: {
        source: "linkedQuote.items",
        columns: [
          { id: "stt", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
          { id: "name", label: localize("Hạng mục", "Item"), value: "{{name}}", width: 84, align: "left" },
          { id: "qty", label: localize("SL", "Qty"), value: "{{quantity}}", width: 18, align: "center" },
          { id: "unit", label: localize("Đơn giá", "Unit Price"), value: "{{unitPrice|currency}}", width: 34, align: "right" },
          { id: "total", label: localize("Thành tiền", "Amount"), value: "{{total|currency}}", width: 38, align: "right" }
        ],
        emptyText: localize("Hợp đồng chưa liên kết báo giá có dòng hàng", "No quotation line items linked")
      }
    },
    {
      id: "contract-summary",
      type: "key_value_table",
      page: 0,
      x: 12,
      y: 222,
      width: 88,
      height: 38,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.5,
        lineHeight: 1.45,
        padding: 2
      },
      content: {
        labelWidth: 32,
        rows: [
          { id: "contract-value", label: localize("Giá trị", "Value"), value: "{{contract.value|currency}}" },
          { id: "contract-start", label: localize("Hiệu lực từ", "From"), value: "{{contract.startDate|date}}" },
          { id: "contract-end", label: localize("Đến ngày", "To"), value: "{{contract.endDate|date}}" }
        ]
      }
    },
    {
      id: "contract-policies",
      type: "text",
      page: 0,
      x: 108,
      y: 222,
      width: 90,
      height: 38,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.2,
        lineHeight: 1.45,
        padding: 2,
        borderWidth: 0.6,
        borderColor: "#cbd5e1",
        borderRadius: 4
      },
      content: {
        text: localize(
          "Thanh toán: {{policies.paymentTerms}}\n\nBảo hành / hỗ trợ: {{policies.warranty}}",
          "Payment: {{policies.paymentTerms}}\n\nWarranty / Service: {{policies.warranty}}"
        )
      }
    },
    {
      id: "contract-signature",
      type: "signature_block",
      page: 0,
      x: 12,
      y: 266,
      width: 186,
      height: 20,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.8,
        lineHeight: 1.35,
        padding: 1
      },
      content: {
        leftTitle: localize("ĐẠI DIỆN AHSO", "AHSO REPRESENTATIVE"),
        rightTitle: localize("ĐẠI DIỆN KHÁCH HÀNG", "CUSTOMER REPRESENTATIVE"),
        leftCaption: localize("Ký, ghi rõ họ tên", "Sign and full name"),
        rightCaption: localize("Ký, ghi rõ họ tên", "Sign and full name")
      }
    }
  ]);
}

const DEFAULT_LAYOUTS: Record<DocumentType, DocumentTemplateLayout> = {
  QUOTATION: createQuotationLayout(),
  CONTRACT: createContractLayout(),
  PROPOSAL: createQuotationLayout(),
  SURVEY_REPORT: createQuotationLayout(),
  CONTRACT_ADDENDUM: createContractLayout(),
  NDA: createContractLayout(),
  DELIVERY_NOTE: createContractLayout(),
  DOC_HANDOVER: createContractLayout(),
  INSTALLATION_REPORT: createContractLayout(),
  ACCEPTANCE_REPORT: createContractLayout(),
  PARTIAL_ACCEPTANCE: createContractLayout(),
  WARRANTY_CERT: createContractLayout(),
  MAINTENANCE_RECORD: createContractLayout(),
  PAYMENT_REQUEST: createContractLayout(),
  PAYMENT_RECEIPT: createContractLayout(),
  AR_RECONCILIATION: createContractLayout()
};

const DEFAULT_SAMPLE_DATA: Record<DocumentType, Record<string, unknown>> = {
  QUOTATION: {
    company: {
      name: "CÔNG TY TNHH AHSO",
      taxId: "0316896939",
      address: "39/15 Đường Cao Bá Quát, TP.HCM",
      phone: "0901 951 351",
      email: "ahso@ahso.vn",
      website: "https://ahso.vn"
    },
    logo: null,
    customer: {
      name: "DNP Water",
      address: "Hà Nội",
      phone: "02432001111",
      email: "projects@dnpwater.vn"
    },
    primaryContact: {
      name: "Nguyễn Văn Minh"
    },
    project: {
      name: "Nâng cấp hệ thống PLC trạm bơm"
    },
    quote: {
      quoteNo: "BG-2026-002",
      version: 1,
      validUntil: "2026-05-20T00:00:00.000Z",
      subtotal: 980000000,
      taxAmount: 98000000,
      total: 1078000000,
      terms:
        "Thanh toán 50% khi ký PO, 40% khi bàn giao, 10% sau nghiệm thu.",
      deliveryTerms:
        "Triển khai trong 30 ngày kể từ ngày xác nhận báo giá và chốt mặt bằng."
    },
    items: [
      {
        name: "Tủ điều khiển PLC",
        quantity: 2,
        unitPrice: 220000000,
        total: 440000000
      },
      {
        name: "Biến tần trung thế",
        quantity: 4,
        unitPrice: 95000000,
        total: 380000000
      },
      {
        name: "Dịch vụ lập trình & commissioning",
        quantity: 1,
        unitPrice: 160000000,
        total: 160000000
      }
    ],
    policies: {
      paymentTerms:
        "Thanh toán 50% khi ký PO, 40% khi bàn giao, 10% sau nghiệm thu.",
      service: "AHSO hỗ trợ vận hành từ xa trong 60 ngày đầu."
    }
  },
  CONTRACT: {
    company: {
      name: "CÔNG TY TNHH AHSO",
      taxId: "0316896939",
      address: "39/15 Đường Cao Bá Quát, TP.HCM",
      phone: "0901 951 351",
      email: "ahso@ahso.vn",
      website: "https://ahso.vn"
    },
    logo: null,
    customer: {
      name: "DNP Water",
      address: "Hà Nội",
      phone: "02432001111",
      email: "projects@dnpwater.vn"
    },
    primaryContact: {
      name: "Trần Thu Hà"
    },
    project: {
      name: "Dự án điều khiển tự động hóa nhà máy"
    },
    contract: {
      contractNo: "HD-2026-003",
      signDate: "2026-04-18T00:00:00.000Z",
      startDate: "2026-04-20T00:00:00.000Z",
      endDate: "2026-07-20T00:00:00.000Z",
      value: 1320000000,
      notes: "Hợp đồng triển khai theo 3 giai đoạn."
    },
    linkedQuote: {
      items: [
        {
          name: "Máy chủ Edge Controller",
          quantity: 2,
          unitPrice: 210000000,
          total: 420000000
        },
        {
          name: "Tủ điện điều khiển trung tâm",
          quantity: 2,
          unitPrice: 270000000,
          total: 540000000
        },
        {
          name: "Dịch vụ triển khai và đào tạo",
          quantity: 1,
          unitPrice: 360000000,
          total: 360000000
        }
      ]
    },
    milestones: [
      {
        name: "Khởi động dự án",
        dueDate: "2026-04-25T00:00:00.000Z",
        status: "IN_PROGRESS"
      },
      {
        name: "Bàn giao phần cứng",
        dueDate: "2026-05-25T00:00:00.000Z",
        status: "PENDING"
      }
    ],
    policies: {
      paymentTerms: "40% ký hợp đồng, 40% bàn giao, 20% sau nghiệm thu.",
      warranty: "Bảo hành 12 tháng, phản hồi sự cố trong 4 giờ làm việc."
    }
  },
  PROPOSAL: {},
  SURVEY_REPORT: {},
  CONTRACT_ADDENDUM: {},
  NDA: {},
  DELIVERY_NOTE: {},
  DOC_HANDOVER: {},
  INSTALLATION_REPORT: {},
  ACCEPTANCE_REPORT: {},
  PARTIAL_ACCEPTANCE: {},
  WARRANTY_CERT: {},
  MAINTENANCE_RECORD: {},
  PAYMENT_REQUEST: {},
  PAYMENT_RECEIPT: {},
  AR_RECONCILIATION: {}
};

export function buildDocumentTemplateCatalog(type: DocumentType): TemplateCatalog {
  const entry = getTemplateEntry(type);
  const tokenGroups = type === "CONTRACT" ? CONTRACT_TOKENS : QUOTATION_TOKENS;

  return {
    type,
    label: entry.label,
    defaultLayout: cloneLayout(DEFAULT_LAYOUTS[type]),
    boxLibrary: createDefaultBoxLibrary(),
    tokenGroups,
    sampleData: DEFAULT_SAMPLE_DATA[type] ?? {}
  };
}

export function createDefaultLayoutForType(type: DocumentType) {
  return cloneLayout(DEFAULT_LAYOUTS[type]);
}
