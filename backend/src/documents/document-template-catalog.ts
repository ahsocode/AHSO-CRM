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

function createPagedLayout(pages: TemplateBox[][]): DocumentTemplateLayout {
  return {
    version: 1,
    page: {
      widthMm: A4_PAGE_WIDTH_MM,
      heightMm: A4_PAGE_HEIGHT_MM,
      gridMm: DEFAULT_GRID_MM,
      marginMm: { ...DEFAULT_PAGE_MARGIN_MM }
    },
    pages: pages.map((boxes, index) => ({
      id: `page-${index + 1}`,
      boxes
    }))
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
              width: 55,
              align: "left"
            },
            {
              id: "col-description",
              label: localize("Mô tả", "Description"),
              value: "{{description}}",
              width: 50,
              align: "left"
            },
            {
              id: "col-qty",
              label: localize("SL", "Qty"),
              value: "{{quantity}}",
              width: 15,
              align: "center"
            },
            {
              id: "col-unit-price",
              label: localize("Đơn giá", "Unit Price"),
              value: "{{unitPrice|currency}}",
              width: 28,
              align: "right"
            },
            {
              id: "col-total",
              label: localize("Thành tiền", "Amount"),
              value: "{{total|currency}}",
              width: 20,
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
      { key: "items[].description", label: "Mô tả hạng mục", description: "Mô tả chi tiết nội dung dòng hàng." },
      { key: "items[].unit", label: "Đơn vị tính", description: "Đơn vị đo lường (cái, bộ, m, set, ...)." },
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
    tokens: [
      ...QUOTATION_TOKENS[0].tokens,
      { key: "company.representative", label: "Người đại diện", description: "Người đại diện pháp lý hoặc được ủy quyền." },
      { key: "company.representativeTitle", label: "Chức vụ đại diện", description: "Chức danh của người đại diện." },
      { key: "company.bankName", label: "Ngân hàng", description: "Tên ngân hàng nhận thanh toán." },
      { key: "company.bankAccount", label: "Số tài khoản", description: "Số tài khoản công ty." },
      { key: "company.bankAccountName", label: "Tên tài khoản", description: "Tên chủ tài khoản." },
      { key: "company.bankBranch", label: "Chi nhánh", description: "Chi nhánh ngân hàng." }
    ]
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
      { key: "customer.taxCode", label: "Mã số thuế khách hàng", description: "MST của khách hàng." },
      { key: "customer.address", label: "Địa chỉ khách hàng", description: "Địa chỉ khách hàng." },
      { key: "customer.phone", label: "Điện thoại khách hàng", description: "Điện thoại khách hàng." },
      { key: "customer.email", label: "Email khách hàng", description: "Email khách hàng." },
      { key: "primaryContact.name", label: "Người liên hệ", description: "Người liên hệ chính." },
      { key: "primaryContact.title", label: "Chức danh liên hệ", description: "Chức danh người liên hệ." },
      { key: "primaryContact.phone", label: "Điện thoại liên hệ", description: "Số điện thoại người liên hệ." },
      { key: "primaryContact.email", label: "Email liên hệ", description: "Email người liên hệ." },
      { key: "linkedQuote.items", label: "Hạng mục từ báo giá", description: "Nguồn bảng hạng mục nếu hợp đồng đi từ báo giá." }
    ]
  },
  {
    id: "milestones",
    label: "Mốc nghiệm thu",
    tokens: [
      { key: "milestones", label: "Danh sách milestone", description: "Toàn bộ milestone của hợp đồng." },
      { key: "milestones[].name", label: "Tên milestone", description: "Tên từng giai đoạn triển khai." },
      { key: "milestones[].description", label: "Mô tả milestone", description: "Mô tả chi tiết nội dung giai đoạn." },
      { key: "milestones[].dueDate", label: "Hạn milestone", description: "Ngày đến hạn từng milestone." },
      { key: "milestones[].completedAt", label: "Ngày hoàn tất", description: "Ngày milestone được đánh dấu hoàn tất." },
      { key: "milestones[].status", label: "Trạng thái milestone", description: "Trạng thái milestone." },
      { key: "milestones[].paymentAmount", label: "Giá trị thanh toán milestone", description: "Giá trị gắn với milestone." },
      { key: "milestones[].notes", label: "Ghi chú milestone", description: "Ghi chú thêm về giai đoạn triển khai." },
      { key: "policies.paymentTerms", label: "Chính sách thanh toán", description: "Điều khoản mặc định từ settings." },
      { key: "policies.warranty", label: "Bảo hành", description: "Chính sách bảo hành." },
      { key: "policies.service", label: "Dịch vụ triển khai", description: "Cam kết triển khai và hỗ trợ." }
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
          { id: "stt", label: localize("STT", "No."), value: "{{index}}", width: 10, align: "center" },
          { id: "name", label: localize("Hạng mục", "Item"), value: "{{name}}", width: 58, align: "left" },
          { id: "description", label: localize("Mô tả", "Description"), value: "{{description}}", width: 48, align: "left" },
          { id: "qty", label: localize("SL", "Qty"), value: "{{quantity}}", width: 14, align: "center" },
          { id: "unit", label: localize("Đơn giá", "Unit Price"), value: "{{unitPrice|currency}}", width: 28, align: "right" },
          { id: "total", label: localize("Thành tiền", "Amount"), value: "{{total|currency}}", width: 28, align: "right" }
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
      y: 266,
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

function createCompactContractLayout(): DocumentTemplateLayout {
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

function createContractLayout(): DocumentTemplateLayout {
  return createPagedLayout([
    [
      {
        id: "contract-logo",
        type: "image",
        page: 0,
        x: 12,
        y: 12,
        width: 32,
        height: 16,
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
        x: 46,
        y: 12,
        width: 118,
        height: 16,
        zIndex: 20,
        visible: true,
        style: {
          fontSize: 15.2,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.15,
          color: "#0f172a"
        },
        content: {
          text: localize("HỢP ĐỒNG CUNG CẤP THIẾT BỊ, PHẦN MỀM VÀ DỊCH VỤ TRIỂN KHAI")
        }
      },
      {
        id: "contract-subtitle",
        type: "text",
        page: 0,
        x: 46,
        y: 27,
        width: 118,
        height: 12,
        zIndex: 20,
        visible: true,
        style: {
          fontSize: 8.8,
          textAlign: "center",
          lineHeight: 1.25,
          color: "#475569"
        },
        content: {
          text: localize("Số: {{contract.contractNo}}  •  Dự án: {{project.name}}  •  Ký ngày {{contract.signDate|date}}")
        }
      },
      {
        id: "contract-header-note",
        type: "text",
        page: 0,
        x: 164,
        y: 14,
        width: 34,
        height: 20,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.8,
          textAlign: "right",
          lineHeight: 1.35,
          color: "#64748b"
        },
        content: {
          text: localize("Mẫu chuẩn AHSO")
        }
      },
      {
        id: "contract-recital",
        type: "text",
        page: 0,
        x: 12,
        y: 42,
        width: 186,
        height: 20,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.8,
          textAlign: "justify",
          lineHeight: 1.32,
          padding: 1.5,
          borderWidth: 0.5,
          borderColor: "#cbd5e1",
          borderRadius: 4,
          backgroundColor: "#f8fafc"
        },
        content: {
          text: localize(
            "Căn cứ nhu cầu triển khai dự án {{project.name}}, Bên A và Bên B thống nhất ký kết Hợp đồng này để điều chỉnh phạm vi cung cấp, giá trị thương mại, tiến độ thực hiện, điều kiện nghiệm thu, trách nhiệm phối hợp và nghĩa vụ bảo hành trong suốt vòng đời dự án."
          )
        }
      },
      {
        id: "contract-party-a",
        type: "key_value_table",
        page: 0,
        x: 12,
        y: 66,
        width: 90,
        height: 56,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 9.3,
          lineHeight: 1.3,
          padding: 2
        },
        content: {
          labelWidth: 31,
          rows: [
            { id: "party-a-title", label: localize("Bên A"), value: "{{customer.name}}" },
            { id: "party-a-tax", label: localize("MST"), value: "{{customer.taxCode}}" },
            { id: "party-a-address", label: localize("Địa chỉ"), value: "{{customer.address}}" },
            { id: "party-a-contact", label: localize("Đại diện"), value: "{{primaryContact.name}}" },
            { id: "party-a-phone", label: localize("Điện thoại"), value: "{{primaryContact.phone}}" },
            { id: "party-a-email", label: localize("Email"), value: "{{primaryContact.email}}" }
          ]
        }
      },
      {
        id: "contract-party-b",
        type: "key_value_table",
        page: 0,
        x: 108,
        y: 66,
        width: 90,
        height: 56,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 9.3,
          lineHeight: 1.3,
          padding: 2
        },
        content: {
          labelWidth: 31,
          rows: [
            { id: "party-b-title", label: localize("Bên B"), value: "{{company.name}}" },
            { id: "party-b-tax", label: localize("MST"), value: "{{company.taxId}}" },
            { id: "party-b-address", label: localize("Địa chỉ"), value: "{{company.address}}" },
            { id: "party-b-contact", label: localize("Đại diện"), value: "{{company.representative}}" },
            { id: "party-b-role", label: localize("Chức vụ"), value: "{{company.representativeTitle}}" },
            { id: "party-b-bank", label: localize("Ngân hàng"), value: "{{company.bankName}}" }
          ]
        }
      },
      {
        id: "contract-scope-heading",
        type: "text",
        page: 0,
        x: 12,
        y: 126,
        width: 186,
        height: 10,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 9.8,
          fontWeight: 700,
          lineHeight: 1.2,
          color: "#0f172a"
        },
        content: {
          text: localize("ĐIỀU 1 & 2. ĐỐI TƯỢNG, PHẠM VI VÀ HẠNG MỤC CUNG CẤP")
        }
      },
      {
        id: "contract-items",
        type: "line_items_table",
        page: 0,
        x: 12,
        y: 136,
        width: 186,
        height: 64,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.9,
          lineHeight: 1.34,
          padding: 2
        },
        content: {
          source: "linkedQuote.items",
          columns: [
            { id: "stt", label: localize("STT"), value: "{{index}}", width: 12, align: "center" },
            { id: "name", label: localize("Thiết bị / dịch vụ / phần mềm"), value: "{{name}}", width: 88, align: "left" },
            { id: "qty", label: localize("SL"), value: "{{quantity}}", width: 16, align: "center" },
            { id: "unit", label: localize("Đơn giá"), value: "{{unitPrice|currency}}", width: 32, align: "right" },
            { id: "total", label: localize("Thành tiền"), value: "{{total|currency}}", width: 38, align: "right" }
          ],
          emptyText: localize("Chưa có hạng mục liên kết từ báo giá")
        }
      },
      {
        id: "contract-commercial-summary",
        type: "key_value_table",
        page: 0,
        x: 12,
        y: 205,
        width: 90,
        height: 34,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 9.3,
          lineHeight: 1.36,
          padding: 2
        },
        content: {
          labelWidth: 36,
          rows: [
            { id: "contract-value", label: localize("Giá trị HĐ"), value: "{{contract.value|currency}}" },
            { id: "contract-sign", label: localize("Ngày ký"), value: "{{contract.signDate|date}}" },
            { id: "contract-start", label: localize("Hiệu lực từ"), value: "{{contract.startDate|date}}" }
          ]
        }
      },
      {
        id: "contract-payment-warranty-summary",
        type: "text",
        page: 0,
        x: 108,
        y: 205,
        width: 90,
        height: 34,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.5,
          lineHeight: 1.28,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4
        },
        content: {
          text: localize("Thanh toán: {{policies.paymentTerms}}\nBảo hành / hỗ trợ: {{policies.warranty}}")
        }
      },
      {
        id: "contract-opening-terms",
        type: "text",
        page: 0,
        x: 12,
        y: 244,
        width: 186,
        height: 32,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          textAlign: "justify",
          lineHeight: 1.3,
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4,
          backgroundColor: "#f8fafc"
        },
        content: {
          text: localize(
            "Điều 3. Hồ sơ ưu tiên gồm Hợp đồng này, các phụ lục, báo giá/đề xuất kỹ thuật được chấp thuận và biên bản thay đổi hợp lệ; khi có mâu thuẫn, Hợp đồng này được ưu tiên áp dụng.\n\nĐiều 4. Tổng giá trị Hợp đồng là {{contract.value|currency}} và là cơ sở thanh toán cho toàn bộ phạm vi đã thống nhất."
          )
        }
      },
      {
        id: "contract-page-1-note",
        type: "text",
        page: 0,
        x: 12,
        y: 281,
        width: 186,
        height: 4,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.2,
          textAlign: "center",
          lineHeight: 1.2,
          color: "#64748b"
        },
        content: {
          text: localize("Trang 1/4 • Thông tin các bên, phạm vi và cơ sở thương mại")
        }
      }
    ],
    [
      {
        id: "contract-terms-title",
        type: "text",
        page: 1,
        x: 12,
        y: 14,
        width: 186,
        height: 10,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 13.8,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.2,
          color: "#0f172a"
        },
        content: {
          text: localize("NỘI DUNG CỐT LÕI CỦA HỢP ĐỒNG")
        }
      },
      {
        id: "contract-core-articles-1",
        type: "text",
        page: 1,
        x: 12,
        y: 30,
        width: 186,
        height: 42,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          lineHeight: 1.3,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4
        },
        content: {
          text: localize(
            "ĐIỀU 1. GIẢI THÍCH TỪ NGỮ\nCác thuật ngữ Thiết bị, Phần mềm, Dịch vụ, Sản phẩm bàn giao và Tiêu chí nghiệm thu được hiểu theo phạm vi dự án {{project.name}}.\n\nĐIỀU 2. ĐỐI TƯỢNG VÀ PHẠM VI HỢP ĐỒNG\nBên B cung cấp thiết bị, phần mềm, dịch vụ triển khai, đào tạo và bảo hành theo danh mục đã được chấp thuận."
          )
        }
      },
      {
        id: "contract-core-articles-2",
        type: "text",
        page: 1,
        x: 12,
        y: 76,
        width: 186,
        height: 40,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          lineHeight: 1.3,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4
        },
        content: {
          text: localize(
            "ĐIỀU 3. THÀNH PHẦN HỒ SƠ VÀ THỨ TỰ ƯU TIÊN\nHợp đồng, phụ lục, báo giá/đề xuất kỹ thuật đã được chấp thuận và biên bản thay đổi hợp lệ là bộ hồ sơ điều chỉnh dự án.\n\nĐIỀU 4. GIÁ TRỊ HỢP ĐỒNG\nTổng giá trị Hợp đồng là {{contract.value|currency}}."
          )
        }
      },
      {
        id: "contract-core-articles-3",
        type: "text",
        page: 1,
        x: 12,
        y: 120,
        width: 186,
        height: 44,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          lineHeight: 1.3,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4
        },
        content: {
          text: localize(
            "ĐIỀU 5. PHƯƠNG THỨC VÀ TIẾN ĐỘ THANH TOÁN\n{{policies.paymentTerms}}\n\nĐIỀU 6. TIẾN ĐỘ THỰC HIỆN, GIAO HÀNG, LẮP ĐẶT VÀ CHẠY THỬ\nHợp đồng có hiệu lực từ {{contract.startDate|date}} đến {{contract.endDate|date}}; các Bên phối hợp theo timeline và mốc nghiệm thu đã thống nhất."
          )
        }
      },
      {
        id: "contract-core-articles-4",
        type: "text",
        page: 1,
        x: 12,
        y: 168,
        width: 186,
        height: 44,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          lineHeight: 1.3,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4
        },
        content: {
          text: localize(
            "ĐIỀU 7. QUẢN LÝ THAY ĐỔI VÀ PHÁT SINH\nMọi thay đổi về phạm vi, thông số, số lượng, tiến độ hoặc tiêu chí nghiệm thu phải được xác nhận bằng văn bản.\n\nĐIỀU 8. NGHIỆM THU, BÀN GIAO VÀ ACCEPTANCE TEST\nBên B thông báo hoàn thành để Bên A kiểm tra, chạy thử và nghiệm thu; nếu chưa đạt, Bên B phải khắc phục trong thời hạn hợp lý."
          )
        }
      },
      {
        id: "contract-core-articles-5",
        type: "text",
        page: 1,
        x: 12,
        y: 216,
        width: 186,
        height: 18,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          lineHeight: 1.28,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4
        },
        content: {
          text: localize(
            "ĐIỀU 9 & 10. HỒ SƠ BÀN GIAO, BẢO HÀNH VÀ HỖ TRỢ\nBên B phải bàn giao đầy đủ hồ sơ kỹ thuật, tài liệu vận hành, cấu hình và hồ sơ nghiệm thu theo phạm vi dự án. Chính sách bảo hành và hỗ trợ áp dụng theo {{policies.warranty}}."
          )
        }
      },
      {
        id: "contract-page-2-note",
        type: "text",
        page: 1,
        x: 12,
        y: 281,
        width: 186,
        height: 4,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.2,
          textAlign: "center",
          lineHeight: 1.2,
          color: "#64748b"
        },
        content: {
          text: localize("Trang 2/4 • Điều 1 đến Điều 10")
        }
      }
    ],
    [
      {
        id: "contract-compliance-title",
        type: "text",
        page: 2,
        x: 12,
        y: 14,
        width: 186,
        height: 10,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 13.8,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.2,
          color: "#0f172a"
        },
        content: {
          text: localize("TRÁCH NHIỆM, TUÂN THỦ VÀ QUẢN TRỊ RỦI RO")
        }
      },
      {
        id: "contract-compliance-1",
        type: "text",
        page: 2,
        x: 12,
        y: 30,
        width: 186,
        height: 42,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          lineHeight: 1.3,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4
        },
        content: {
          text: localize(
            "ĐIỀU 11. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A\nBên A cung cấp dữ liệu đầu vào, điều kiện hiện trường và đầu mối phối hợp đúng hạn.\n\nĐIỀU 12. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B\nBên B thực hiện đúng phạm vi, chất lượng, tiến độ và bố trí nhân sự đủ năng lực."
          )
        }
      },
      {
        id: "contract-compliance-2",
        type: "text",
        page: 2,
        x: 12,
        y: 76,
        width: 186,
        height: 40,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          lineHeight: 1.3,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4,
          backgroundColor: "#f8fafc"
        },
        content: {
          text: localize(
            "ĐIỀU 13. AN TOÀN, NỘI QUY CÔNG TRƯỜNG VÀ TUÂN THỦ\nBên B và nhân sự của mình phải tuân thủ yêu cầu an toàn lao động, PCCC, an ninh, môi trường và quy định vào hiện trường.\n\nBên B chịu trách nhiệm đối với thiệt hại phát sinh do lỗi của mình hoặc nhà thầu phụ do mình quản lý."
          )
        }
      },
      {
        id: "contract-compliance-3",
        type: "text",
        page: 2,
        x: 12,
        y: 122,
        width: 186,
        height: 42,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          lineHeight: 1.3,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4,
          backgroundColor: "#f8fafc"
        },
        content: {
          text: localize(
            "ĐIỀU 14. BẢO MẬT THÔNG TIN\nCác Bên bảo mật thông tin kỹ thuật, thương mại, tài chính và dữ liệu tiếp cận trong quá trình thực hiện Hợp đồng.\n\nĐIỀU 15. QUYỀN SỞ HỮU TRÍ TUỆ\nQuyền sử dụng và quyền sở hữu đối với sản phẩm bàn giao được áp dụng theo Hợp đồng và Phụ lục."
          )
        }
      },
      {
        id: "contract-compliance-4",
        type: "text",
        page: 2,
        x: 12,
        y: 170,
        width: 186,
        height: 46,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          lineHeight: 1.3,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4
        },
        content: {
          text: localize(
            "ĐIỀU 16. BẢO VỆ DỮ LIỆU CÁ NHÂN\nCác Bên tuân thủ quy định pháp luật hiện hành về bảo vệ dữ liệu cá nhân.\n\nĐIỀU 17. CHỐNG THAM NHŨNG, HỐI LỘ VÀ XUNG ĐỘT LỢI ÍCH\nBên B cam kết không đưa hoặc hứa hẹn lợi ích không chính đáng nhằm tác động đến quyết định thương mại, kỹ thuật hoặc triển khai dự án."
          )
        }
      },
      {
        id: "contract-page-3-note",
        type: "text",
        page: 2,
        x: 12,
        y: 281,
        width: 186,
        height: 4,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.2,
          textAlign: "center",
          lineHeight: 1.2,
          color: "#64748b"
        },
        content: {
          text: localize("Trang 3/4 • Điều 11 đến Điều 17")
        }
      }
    ],
    [
      {
        id: "contract-execution-title",
        type: "text",
        page: 3,
        x: 12,
        y: 14,
        width: 186,
        height: 10,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 13.8,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.2,
          color: "#0f172a"
        },
        content: {
          text: localize("KÝ KẾT, PHỤ LỤC THỰC HIỆN VÀ THÔNG TIN THANH TOÁN")
        }
      },
      {
        id: "contract-final-articles",
        type: "text",
        page: 3,
        x: 12,
        y: 30,
        width: 186,
        height: 40,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          lineHeight: 1.3,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4
        },
        content: {
          text: localize(
            "ĐIỀU 18. PHẠT VI PHẠM VÀ BỒI THƯỜNG THIỆT HẠI\nBên vi phạm phải khắc phục vi phạm và bồi thường thiệt hại thực tế, trực tiếp và hợp lý.\n\nĐIỀU 19. BẢO HIỂM\nNếu dự án yêu cầu, Bên B duy trì các loại bảo hiểm phù hợp đối với nhân sự, hàng hóa và trách nhiệm dân sự.\n\nĐIỀU 20. BẤT KHẢ KHÁNG\nBên bị ảnh hưởng phải thông báo kịp thời và các Bên cùng thống nhất biện pháp xử lý."
          )
        }
      },
      {
        id: "contract-milestones",
        type: "line_items_table",
        page: 3,
        x: 12,
        y: 76,
        width: 186,
        height: 52,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.8,
          lineHeight: 1.34,
          padding: 2
        },
        content: {
          source: "milestones",
          columns: [
            { id: "ms-index", label: localize("STT"), value: "{{index}}", width: 12, align: "center" },
            { id: "ms-name", label: localize("Mốc triển khai"), value: "{{name}}", width: 78, align: "left" },
            { id: "ms-date", label: localize("Hạn"), value: "{{dueDate|date}}", width: 28, align: "center" },
            { id: "ms-status", label: localize("Trạng thái"), value: "{{status}}", width: 28, align: "center" },
            { id: "ms-payment", label: localize("Giá trị"), value: "{{paymentAmount|currency}}", width: 40, align: "right" }
          ],
          emptyText: localize("Chưa cấu hình milestone cho hợp đồng")
        }
      },
      {
        id: "contract-appendix-payment",
        type: "text",
        page: 3,
        x: 12,
        y: 134,
        width: 186,
        height: 18,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.7,
          lineHeight: 1.3,
          textAlign: "justify",
          padding: 1.5,
          borderWidth: 0.4,
          borderColor: "#e2e8f0",
          borderRadius: 4,
          backgroundColor: "#f8fafc"
        },
        content: {
          text: localize(
            "ĐIỀU 21, 22 VÀ 23. CHẤM DỨT, GIẢI QUYẾT TRANH CHẤP VÀ ĐIỀU KHOẢN CHUNG\nHợp đồng có thể chấm dứt theo thỏa thuận hoặc do vi phạm nghiêm trọng; tranh chấp được ưu tiên giải quyết bằng thương lượng trước khi áp dụng pháp luật Việt Nam."
          )
        }
      },
      {
        id: "contract-contact-summary",
        type: "key_value_table",
        page: 3,
        x: 12,
        y: 158,
        width: 90,
        height: 32,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 9.1,
          lineHeight: 1.34,
          padding: 2
        },
        content: {
          labelWidth: 34,
          rows: [
            { id: "contact-name", label: localize("Đầu mối"), value: "{{primaryContact.name}}" },
            { id: "contact-title", label: localize("Chức danh"), value: "{{primaryContact.title}}" },
            { id: "contact-phone", label: localize("Điện thoại"), value: "{{primaryContact.phone}}" },
            { id: "contact-email", label: localize("Email"), value: "{{primaryContact.email}}" }
          ]
        }
      },
      {
        id: "contract-bank-summary",
        type: "key_value_table",
        page: 3,
        x: 108,
        y: 158,
        width: 90,
        height: 32,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 9.1,
          lineHeight: 1.34,
          padding: 2
        },
        content: {
          labelWidth: 34,
          rows: [
            { id: "bank-name", label: localize("Ngân hàng"), value: "{{company.bankName}}" },
            { id: "bank-account", label: localize("Số TK"), value: "{{company.bankAccount}}" },
            { id: "bank-owner", label: localize("Chủ TK"), value: "{{company.bankAccountName}}" },
            { id: "bank-branch", label: localize("Chi nhánh"), value: "{{company.bankBranch}}" }
          ]
        }
      },
      {
        id: "contract-final-note",
        type: "text",
        page: 3,
        x: 12,
        y: 196,
        width: 186,
        height: 14,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.6,
          lineHeight: 1.26,
          textAlign: "justify",
          padding: 1.5
        },
        content: {
          text: localize(
            "Hợp đồng này được lập thành 04 bản gốc có giá trị pháp lý như nhau; mỗi Bên giữ 02 bản để theo dõi thực hiện, nghiệm thu, thanh toán và hoàn tất hồ sơ pháp lý của dự án."
          )
        }
      },
      {
        id: "contract-signature",
        type: "signature_block",
        page: 3,
        x: 12,
        y: 222,
        width: 186,
        height: 44,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 10,
          lineHeight: 1.34,
          padding: 2
        },
        content: {
          leftTitle: localize("ĐẠI DIỆN BÊN A"),
          rightTitle: localize("ĐẠI DIỆN BÊN B"),
          leftCaption: localize("Ký, ghi rõ họ tên và đóng dấu"),
          rightCaption: localize("Ký, ghi rõ họ tên và đóng dấu")
        }
      },
      {
        id: "contract-page-4-note",
        type: "text",
        page: 3,
        x: 12,
        y: 281,
        width: 186,
        height: 4,
        zIndex: 10,
        visible: true,
        style: {
          fontSize: 8.2,
          textAlign: "center",
          lineHeight: 1.2,
          color: "#64748b"
        },
        content: {
          text: localize("Trang 4/4 • Điều 18 đến Điều 23, phụ lục thực hiện và ký kết")
        }
      }
    ]
  ]);
}

interface StandardLayoutOptions {
  prefix: string;
  titleVi: string;
  titleViEn?: string;
  metaText: TemplateLocalizedText;
  subjectRows: Array<{ id: string; label: TemplateLocalizedText; value: string }>;
  tableSource: string;
  tableColumns: Array<{ id: string; label: TemplateLocalizedText; value: string; width?: number; align?: "left" | "center" | "right" }>;
  notesText: TemplateLocalizedText;
  signatureLeft?: TemplateLocalizedText;
  signatureRight?: TemplateLocalizedText;
}

function createStandardDocumentLayout(options: StandardLayoutOptions): DocumentTemplateLayout {
  return createBaseLayout([
    {
      id: `${options.prefix}-logo`,
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
      id: `${options.prefix}-title`,
      type: "text",
      page: 0,
      x: 62,
      y: 12,
      width: 136,
      height: 18,
      zIndex: 20,
      visible: true,
      style: {
        fontSize: 16,
        fontWeight: 700,
        textAlign: "right",
        lineHeight: 1.2,
        color: "#1e3a5f"
      },
      content: {
        text: localize(options.titleVi, options.titleViEn)
      }
    },
    {
      id: `${options.prefix}-company`,
      type: "key_value_table",
      page: 0,
      x: 12,
      y: 38,
      width: 88,
      height: 58,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.4,
        lineHeight: 1.35,
        padding: 2
      },
      content: {
        labelWidth: 30,
        rows: [
          { id: "company-name", label: localize("Công ty", "Company"), value: "{{company.name}}" },
          { id: "company-tax", label: localize("MST", "Tax ID"), value: "{{company.taxId}}" },
          { id: "company-address", label: localize("Địa chỉ", "Address"), value: "{{company.address}}" },
          { id: "company-phone", label: localize("Điện thoại", "Phone"), value: "{{company.phone}}" },
          { id: "company-rep", label: localize("Đại diện", "Representative"), value: "{{company.representative}}" }
        ]
      }
    },
    {
      id: `${options.prefix}-subject`,
      type: "key_value_table",
      page: 0,
      x: 108,
      y: 38,
      width: 90,
      height: 58,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.4,
        lineHeight: 1.35,
        padding: 2
      },
      content: {
        labelWidth: 32,
        rows: options.subjectRows
      }
    },
    {
      id: `${options.prefix}-meta`,
      type: "text",
      page: 0,
      x: 12,
      y: 102,
      width: 186,
      height: 24,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 10,
        lineHeight: 1.42,
        padding: 2,
        borderWidth: 0.6,
        borderColor: "#cbd5e1",
        borderRadius: 4
      },
      content: {
        text: options.metaText
      }
    },
    {
      id: `${options.prefix}-table`,
      type: "line_items_table",
      page: 0,
      x: 12,
      y: 132,
      width: 186,
      height: 82,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9,
        lineHeight: 1.32,
        padding: 2
      },
      content: {
        source: options.tableSource,
        columns: options.tableColumns,
        emptyText: localize("Chưa có dữ liệu", "No data")
      }
    },
    {
      id: `${options.prefix}-notes`,
      type: "text",
      page: 0,
      x: 12,
      y: 220,
      width: 186,
      height: 34,
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
        text: options.notesText
      }
    },
    {
      id: `${options.prefix}-signature`,
      type: "signature_block",
      page: 0,
      x: 12,
      y: 260,
      width: 186,
      height: 24,
      zIndex: 10,
      visible: true,
      style: {
        fontSize: 9.8,
        lineHeight: 1.35,
        padding: 1
      },
      content: {
        leftTitle: options.signatureLeft ?? localize("ĐẠI DIỆN AHSO", "AHSO REPRESENTATIVE"),
        rightTitle: options.signatureRight ?? localize("ĐẠI DIỆN KHÁCH HÀNG", "CUSTOMER REPRESENTATIVE"),
        leftCaption: localize("Ký, ghi rõ họ tên", "Sign and full name"),
        rightCaption: localize("Ký, ghi rõ họ tên", "Sign and full name")
      }
    }
  ]);
}

const STANDARD_CUSTOMER_ROWS = [
  { id: "customer-name", label: localize("Khách hàng", "Customer"), value: "{{customer.name}}" },
  { id: "customer-address", label: localize("Địa chỉ", "Address"), value: "{{customer.address}}" },
  { id: "customer-phone", label: localize("Điện thoại", "Phone"), value: "{{customer.phone}}" },
  { id: "contact-name", label: localize("Liên hệ", "Contact"), value: "{{primaryContact.name}}" }
];

const STANDARD_CONTRACT_ROWS = [
  { id: "contract-no", label: localize("Số HĐ", "Contract No."), value: "{{contract.contractNo}}" },
  { id: "customer-name", label: localize("Khách hàng", "Customer"), value: "{{customer.name}}" },
  { id: "contact-name", label: localize("Liên hệ", "Contact"), value: "{{primaryContact.name}}" },
  { id: "contract-value", label: localize("Giá trị", "Value"), value: "{{contract.value|currency}}" }
];

function createProposalLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "proposal",
    titleVi: "ĐỀ XUẤT DỰ ÁN",
    titleViEn: "ĐỀ XUẤT DỰ ÁN / PROJECT PROPOSAL",
    metaText: localize(
      "Dự án: {{project.name}}  |  Giá trị dự kiến: {{project.estimatedValue|currency}}  |  Báo giá liên kết: {{linkedQuote.total|currency}}",
      "Project: {{project.name}}  |  Estimated Value: {{project.estimatedValue|currency}}  |  Linked Quote: {{linkedQuote.total|currency}}"
    ),
    subjectRows: [
      ...STANDARD_CUSTOMER_ROWS,
      { id: "project-name", label: localize("Dự án", "Project"), value: "{{project.name}}" }
    ],
    tableSource: "milestones",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
      { id: "name", label: localize("Mốc triển khai", "Milestone"), value: "{{name}}", width: 74 },
      { id: "due-date", label: localize("Hạn", "Due"), value: "{{dueDate|date}}", width: 34, align: "center" },
      { id: "amount", label: localize("Giá trị", "Amount"), value: "{{paymentAmount|currency}}", width: 38, align: "right" },
      { id: "status", label: localize("Trạng thái", "Status"), value: "{{status}}", width: 28, align: "center" }
    ],
    notesText: localize(
      "AHSO đề xuất phạm vi triển khai theo các mốc trên. Chi tiết thương mại có thể được chốt trong báo giá/hợp đồng chính thức.",
      "AHSO proposes the implementation scope above. Commercial details can be finalized in the formal quote/contract."
    )
  });
}

function createSurveyReportLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "survey",
    titleVi: "BÁO CÁO KHẢO SÁT",
    titleViEn: "BÁO CÁO KHẢO SÁT / SURVEY REPORT",
    metaText: localize(
      "Dự án: {{project.name}}  |  Người khảo sát: {{surveyorName}}  |  Ngày khảo sát: {{surveyDate|date}}",
      "Project: {{project.name}}  |  Surveyor: {{surveyorName}}  |  Survey Date: {{surveyDate|date}}"
    ),
    subjectRows: STANDARD_CUSTOMER_ROWS,
    tableSource: "findings",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
      { id: "title", label: localize("Hạng mục", "Finding"), value: "{{title}}", width: 58 },
      { id: "description", label: localize("Mô tả hiện trạng", "Description"), value: "{{description}}", width: 116 }
    ],
    notesText: localize(
      "Các phát hiện khảo sát là cơ sở để AHSO đề xuất phạm vi kỹ thuật, tiến độ và ngân sách triển khai.",
      "Survey findings are the basis for AHSO's technical scope, timeline, and budget proposal."
    )
  });
}

function createContractAddendumLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "addendum",
    titleVi: "PHỤ LỤC HỢP ĐỒNG",
    titleViEn: "PHỤ LỤC HỢP ĐỒNG / CONTRACT ADDENDUM",
    metaText: localize(
      "Số hợp đồng: {{contract.contractNo}}  |  Ngày phụ lục: {{addendumDate|date}}  |  Dự án: {{project.name}}",
      "Contract No: {{contract.contractNo}}  |  Addendum Date: {{addendumDate|date}}  |  Project: {{project.name}}"
    ),
    subjectRows: STANDARD_CONTRACT_ROWS,
    tableSource: "modifications",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 14, align: "center" },
      { id: "content", label: localize("Nội dung điều chỉnh", "Modification"), value: "{{content}}", width: 172 }
    ],
    notesText: localize(
      "Các nội dung không được điều chỉnh trong phụ lục này vẫn giữ nguyên hiệu lực theo hợp đồng đã ký.",
      "Terms not amended by this addendum remain effective under the signed contract."
    )
  });
}

function createNdaLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "nda",
    titleVi: "THỎA THUẬN BẢO MẬT",
    titleViEn: "THỎA THUẬN BẢO MẬT / NDA",
    metaText: localize(
      "Ngày hiệu lực: {{ndaDate|date}}  |  Bên nhận thông tin: {{customer.name}}  |  Liên hệ: {{primaryContact.name}}",
      "Effective Date: {{ndaDate|date}}  |  Receiving Party: {{customer.name}}  |  Contact: {{primaryContact.name}}"
    ),
    subjectRows: STANDARD_CUSTOMER_ROWS,
    tableSource: "confidentialScopes",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 14, align: "center" },
      { id: "scope", label: localize("Phạm vi bảo mật", "Confidential Scope"), value: "{{scope}}", width: 68 },
      { id: "description", label: localize("Mô tả", "Description"), value: "{{description}}", width: 104 }
    ],
    notesText: localize(
      "Hai bên cam kết bảo mật toàn bộ thông tin kỹ thuật, thương mại và vận hành được trao đổi trong quá trình làm việc.",
      "Both parties agree to keep all technical, commercial, and operational information confidential."
    )
  });
}

function createDeliveryNoteLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "delivery",
    titleVi: "BIÊN BẢN GIAO HÀNG",
    titleViEn: "BIÊN BẢN GIAO HÀNG / DELIVERY NOTE",
    metaText: localize(
      "Số hợp đồng: {{contract.contractNo}}  |  Ngày giao hàng: {{deliveryDate|date}}  |  Dự án: {{project.name}}",
      "Contract No: {{contract.contractNo}}  |  Delivery Date: {{deliveryDate|date}}  |  Project: {{project.name}}"
    ),
    subjectRows: STANDARD_CONTRACT_ROWS,
    tableSource: "deliveredItems",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
      { id: "name", label: localize("Hàng hóa / thiết bị", "Item"), value: "{{name}}", width: 116 },
      { id: "quantity", label: localize("SL", "Qty"), value: "{{quantity}}", width: 24, align: "center" },
      { id: "unit", label: localize("Đơn vị", "Unit"), value: "{{unit}}", width: 34, align: "center" }
    ],
    notesText: localize("Các bên xác nhận số lượng hàng hóa đã được bàn giao theo danh sách trên.", "Both parties confirm the listed items have been delivered.")
  });
}

function createDocHandoverLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "handover",
    titleVi: "BIÊN BẢN BÀN GIAO TÀI LIỆU",
    titleViEn: "BIÊN BẢN BÀN GIAO TÀI LIỆU / DOCUMENT HANDOVER",
    metaText: localize("Số hợp đồng: {{contract.contractNo}}  |  Ngày bàn giao: {{handoverDate|date}}", "Contract No: {{contract.contractNo}}  |  Handover Date: {{handoverDate|date}}"),
    subjectRows: STANDARD_CONTRACT_ROWS,
    tableSource: "handedOverDocs",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
      { id: "name", label: localize("Tài liệu", "Document"), value: "{{name}}", width: 76 },
      { id: "format", label: localize("Định dạng", "Format"), value: "{{format}}", width: 48 },
      { id: "note", label: localize("Ghi chú", "Note"), value: "{{note}}", width: 50 }
    ],
    notesText: localize("Danh sách tài liệu trên là một phần của hồ sơ bàn giao dự án.", "The listed documents are part of the project handover package.")
  });
}

function createInstallationReportLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "installation",
    titleVi: "BIÊN BẢN CÀI ĐẶT & TRIỂN KHAI",
    titleViEn: "BIÊN BẢN CÀI ĐẶT & TRIỂN KHAI / INSTALLATION REPORT",
    metaText: localize("Số hợp đồng: {{contract.contractNo}}  |  Ngày triển khai: {{installationDate|date}}", "Contract No: {{contract.contractNo}}  |  Installation Date: {{installationDate|date}}"),
    subjectRows: STANDARD_CONTRACT_ROWS,
    tableSource: "installations",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
      { id: "name", label: localize("Hạng mục", "Item"), value: "{{name}}", width: 78 },
      { id: "status", label: localize("Trạng thái", "Status"), value: "{{status}}", width: 34, align: "center" },
      { id: "note", label: localize("Ghi chú", "Note"), value: "{{note}}", width: 62 }
    ],
    notesText: localize("Các hạng mục triển khai được xác nhận theo trạng thái tại thời điểm lập biên bản.", "Installation items are confirmed according to their status at report time.")
  });
}

function createAcceptanceReportLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "acceptance",
    titleVi: "BIÊN BẢN NGHIỆM THU KỸ THUẬT",
    titleViEn: "BIÊN BẢN NGHIỆM THU KỸ THUẬT / ACCEPTANCE REPORT",
    metaText: localize("Số hợp đồng: {{contract.contractNo}}  |  Ngày nghiệm thu: {{acceptanceDate|date}}", "Contract No: {{contract.contractNo}}  |  Acceptance Date: {{acceptanceDate|date}}"),
    subjectRows: STANDARD_CONTRACT_ROWS,
    tableSource: "testResults",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
      { id: "name", label: localize("Nội dung kiểm thử", "Test Item"), value: "{{name}}", width: 82 },
      { id: "status", label: localize("Kết quả", "Result"), value: "{{status}}", width: 34, align: "center" },
      { id: "note", label: localize("Ghi chú", "Note"), value: "{{note}}", width: 58 }
    ],
    notesText: localize("Kết quả nghiệm thu là cơ sở để hai bên xác nhận hoàn thành phạm vi kỹ thuật.", "Acceptance results are the basis for confirming completion of technical scope.")
  });
}

function createPartialAcceptanceLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "partial-acceptance",
    titleVi: "BIÊN BẢN NGHIỆM THU GIAI ĐOẠN",
    titleViEn: "BIÊN BẢN NGHIỆM THU GIAI ĐOẠN / PARTIAL ACCEPTANCE",
    metaText: localize("Số hợp đồng: {{contract.contractNo}}  |  Giá trị HĐ: {{contract.value|currency}}  |  Ngày nghiệm thu: {{acceptanceDate|date}}", "Contract No: {{contract.contractNo}}  |  Value: {{contract.value|currency}}  |  Acceptance Date: {{acceptanceDate|date}}"),
    subjectRows: STANDARD_CONTRACT_ROWS,
    tableSource: "acceptedParts",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
      { id: "name", label: localize("Hạng mục nghiệm thu", "Accepted Part"), value: "{{name}}", width: 72 },
      { id: "ratio", label: localize("Tỷ lệ", "Ratio"), value: "{{ratio}}", width: 24, align: "center" },
      { id: "value", label: localize("Giá trị", "Value"), value: "{{value|currency}}", width: 38, align: "right" },
      { id: "note", label: localize("Ghi chú", "Note"), value: "{{note}}", width: 40 }
    ],
    notesText: localize("Phạm vi nghiệm thu giai đoạn không thay thế nghiệm thu cuối cùng của toàn bộ hợp đồng.", "Partial acceptance does not replace final acceptance for the full contract.")
  });
}

function createWarrantyCertLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "warranty",
    titleVi: "GIẤY CHỨNG NHẬN BẢO HÀNH",
    titleViEn: "GIẤY CHỨNG NHẬN BẢO HÀNH / WARRANTY CERTIFICATE",
    metaText: localize("Số hợp đồng: {{contract.contractNo}}  |  Dự án: {{project.name}}  |  Hạn bảo hành: {{warrantyEndDate|date}}", "Contract No: {{contract.contractNo}}  |  Project: {{project.name}}  |  Warranty End: {{warrantyEndDate|date}}"),
    subjectRows: STANDARD_CONTRACT_ROWS,
    tableSource: "warrantyItems",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
      { id: "name", label: localize("Hạng mục bảo hành", "Warranty Item"), value: "{{name}}", width: 90 },
      { id: "period", label: localize("Thời hạn", "Period"), value: "{{period}}", width: 34, align: "center" },
      { id: "note", label: localize("Ghi chú", "Note"), value: "{{note}}", width: 50 }
    ],
    notesText: localize("Thời hạn bảo hành {{warrantyPeriodMonths}} tháng kể từ {{warrantyDate|date}}.", "Warranty period is {{warrantyPeriodMonths}} months from {{warrantyDate|date}}.")
  });
}

function createMaintenanceRecordLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "maintenance",
    titleVi: "BIÊN BẢN BẢO TRÌ & HỖ TRỢ",
    titleViEn: "BIÊN BẢN BẢO TRÌ & HỖ TRỢ / MAINTENANCE RECORD",
    metaText: localize("Số hợp đồng: {{contract.contractNo}}  |  Ngày bảo trì: {{maintenanceDate|date}}  |  Kỹ thuật viên: {{technician}}", "Contract No: {{contract.contractNo}}  |  Maintenance Date: {{maintenanceDate|date}}  |  Technician: {{technician}}"),
    subjectRows: STANDARD_CONTRACT_ROWS,
    tableSource: "issues",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
      { id: "name", label: localize("Nội dung", "Issue"), value: "{{name}}", width: 82 },
      { id: "status", label: localize("Trạng thái", "Status"), value: "{{status}}", width: 38, align: "center" },
      { id: "note", label: localize("Ghi chú", "Note"), value: "{{note}}", width: 54 }
    ],
    notesText: localize("Biên bản ghi nhận tình trạng hệ thống và các hành động bảo trì đã thực hiện.", "This record captures system status and maintenance actions performed.")
  });
}

function createPaymentRequestLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "payment-request",
    titleVi: "GIẤY ĐỀ NGHỊ THANH TOÁN",
    titleViEn: "GIẤY ĐỀ NGHỊ THANH TOÁN / PAYMENT REQUEST",
    metaText: localize("Số hợp đồng: {{contract.contractNo}}  |  Số tiền đề nghị: {{paymentAmount|currency}}  |  Lý do: {{paymentReason}}", "Contract No: {{contract.contractNo}}  |  Requested Amount: {{paymentAmount|currency}}  |  Reason: {{paymentReason}}"),
    subjectRows: [
      ...STANDARD_CONTRACT_ROWS,
      { id: "bank-name", label: localize("Ngân hàng", "Bank"), value: "{{bankName}}" }
    ],
    tableSource: "paymentLines",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
      { id: "description", label: localize("Nội dung", "Description"), value: "{{description}}", width: 96 },
      { id: "amount", label: localize("Số tiền", "Amount"), value: "{{amount|currency}}", width: 42, align: "right" },
      { id: "note", label: localize("Ghi chú", "Note"), value: "{{note}}", width: 36 }
    ],
    notesText: localize("Thông tin nhận tiền: {{bankAccountName}} - {{bankAccountNo}} - {{bankName}}.", "Beneficiary: {{bankAccountName}} - {{bankAccountNo}} - {{bankName}}."),
    signatureLeft: localize("NGƯỜI ĐỀ NGHỊ", "REQUESTED BY"),
    signatureRight: localize("PHÊ DUYỆT", "APPROVED BY")
  });
}

function createPaymentReceiptLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "payment-receipt",
    titleVi: "PHIẾU THU",
    titleViEn: "PHIẾU THU / PAYMENT RECEIPT",
    metaText: localize("Số hợp đồng: {{contract.contractNo}}  |  Số tiền thu: {{receiptAmount|currency}}  |  Hình thức: {{paymentMethod}}", "Contract No: {{contract.contractNo}}  |  Receipt Amount: {{receiptAmount|currency}}  |  Method: {{paymentMethod}}"),
    subjectRows: [
      ...STANDARD_CONTRACT_ROWS,
      { id: "payer", label: localize("Người nộp", "Payer"), value: "{{payerName}}" }
    ],
    tableSource: "receiptLines",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 12, align: "center" },
      { id: "description", label: localize("Nội dung thu", "Receipt Description"), value: "{{description}}", width: 96 },
      { id: "amount", label: localize("Số tiền", "Amount"), value: "{{amount|currency}}", width: 42, align: "right" },
      { id: "method", label: localize("Hình thức", "Method"), value: "{{method}}", width: 36, align: "center" }
    ],
    notesText: localize("Lý do thu: {{receiptReason}}. Thu ngân: {{cashier}}.", "Receipt reason: {{receiptReason}}. Cashier: {{cashier}}."),
    signatureLeft: localize("NGƯỜI NỘP TIỀN", "PAYER"),
    signatureRight: localize("THU NGÂN", "CASHIER")
  });
}

function createArReconciliationLayout(): DocumentTemplateLayout {
  return createStandardDocumentLayout({
    prefix: "ar-reconciliation",
    titleVi: "BẢNG ĐỐI CHIẾU CÔNG NỢ",
    titleViEn: "BẢNG ĐỐI CHIẾU CÔNG NỢ / AR RECONCILIATION",
    metaText: localize("Ngày đối chiếu: {{reconDate|date}}  |  Kỳ: {{periodStart|date}} - {{periodEnd|date}}  |  Tổng còn lại: {{totals.outstanding|currency}}", "Reconciliation Date: {{reconDate|date}}  |  Period: {{periodStart|date}} - {{periodEnd|date}}  |  Outstanding: {{totals.outstanding|currency}}"),
    subjectRows: STANDARD_CUSTOMER_ROWS,
    tableSource: "lineItems",
    tableColumns: [
      { id: "index", label: localize("STT", "No."), value: "{{index}}", width: 10, align: "center" },
      { id: "contract", label: localize("Số HĐ", "Contract"), value: "{{contractNo}}", width: 28 },
      { id: "project", label: localize("Dự án", "Project"), value: "{{projectName}}", width: 44 },
      { id: "value", label: localize("Giá trị", "Value"), value: "{{contractValue|currency}}", width: 34, align: "right" },
      { id: "paid", label: localize("Đã thu", "Paid"), value: "{{paid|currency}}", width: 34, align: "right" },
      { id: "outstanding", label: localize("Còn lại", "Outstanding"), value: "{{outstanding|currency}}", width: 36, align: "right" }
    ],
    notesText: localize("Tổng đã xuất hóa đơn: {{totals.invoiced|currency}}. Tổng đã thu: {{totals.paid|currency}}. Còn phải thu: {{totals.outstanding|currency}}.", "Invoiced: {{totals.invoiced|currency}}. Paid: {{totals.paid|currency}}. Outstanding: {{totals.outstanding|currency}}.")
  });
}

const DEFAULT_LAYOUTS: Record<DocumentType, DocumentTemplateLayout> = {
  QUOTATION: createQuotationLayout(),
  CONTRACT: createContractLayout(),
  PROPOSAL: createProposalLayout(),
  SURVEY_REPORT: createSurveyReportLayout(),
  CONTRACT_ADDENDUM: createContractAddendumLayout(),
  NDA: createNdaLayout(),
  DELIVERY_NOTE: createDeliveryNoteLayout(),
  DOC_HANDOVER: createDocHandoverLayout(),
  INSTALLATION_REPORT: createInstallationReportLayout(),
  ACCEPTANCE_REPORT: createAcceptanceReportLayout(),
  PARTIAL_ACCEPTANCE: createPartialAcceptanceLayout(),
  WARRANTY_CERT: createWarrantyCertLayout(),
  MAINTENANCE_RECORD: createMaintenanceRecordLayout(),
  PAYMENT_REQUEST: createPaymentRequestLayout(),
  PAYMENT_RECEIPT: createPaymentReceiptLayout(),
  AR_RECONCILIATION: createArReconciliationLayout()
};

const SAMPLE_COMPANY = {
  name: "CÔNG TY TNHH AHSO",
  taxId: "0316896939",
  address: "39/15 Đường Cao Bá Quát, TP.HCM",
  phone: "0901 951 351",
  email: "ahso@ahso.vn",
  website: "https://ahso.vn",
  representative: "Ngô Văn Hùng",
  representativeTitle: "Giám đốc",
  bankName: "Vietcombank",
  bankAccount: "0071001988666",
  bankAccountNo: "0071001988666",
  bankAccountName: "CONG TY TNHH AHSO",
  bankBranch: "Chi nhánh TP.HCM"
};

const SAMPLE_CUSTOMER = {
  name: "DNP Water",
  taxCode: "0100100101",
  address: "Hà Nội",
  phone: "02432001111",
  email: "projects@dnpwater.vn"
};

const SAMPLE_CONTACT = {
  name: "Trần Thu Hà",
  title: "Giám đốc dự án",
  phone: "0909123123",
  email: "ha.tran@dnpwater.vn"
};

const SAMPLE_PROJECT = {
  name: "Dự án điều khiển tự động hóa nhà máy",
  estimatedValue: 1450000000
};

const SAMPLE_CONTRACT = {
  contractNo: "HD-2026-003",
  signDate: "2026-04-18T00:00:00.000Z",
  startDate: "2026-04-20T00:00:00.000Z",
  endDate: "2026-07-20T00:00:00.000Z",
  value: 1320000000,
  notes: "Hợp đồng triển khai theo 3 giai đoạn."
};

const SAMPLE_LINKED_QUOTE_ITEMS = [
  { name: "Máy chủ Edge Controller", quantity: 2, unit: "Cái", unitPrice: 210000000, total: 420000000 },
  { name: "Tủ điện điều khiển trung tâm", quantity: 2, unit: "Cái", unitPrice: 270000000, total: 540000000 },
  { name: "Dịch vụ triển khai và đào tạo", quantity: 1, unit: "Gói", unitPrice: 360000000, total: 360000000 }
];

const SAMPLE_POLICIES = {
  paymentTerms: "40% ký hợp đồng, 40% bàn giao, 20% sau nghiệm thu.",
  warranty: "Bảo hành 12 tháng, phản hồi sự cố trong 4 giờ làm việc.",
  service: "Bao gồm khảo sát chi tiết, lắp đặt, chạy thử, đào tạo vận hành và hỗ trợ từ xa sau bàn giao."
};

function createBaseSampleContext() {
  return {
    company: SAMPLE_COMPANY,
    logo: null,
    customer: SAMPLE_CUSTOMER,
    primaryContact: SAMPLE_CONTACT,
    project: SAMPLE_PROJECT,
    contract: SAMPLE_CONTRACT,
    policies: SAMPLE_POLICIES,
    generatedAt: "2026-05-15T08:00:00.000Z"
  };
}

const DEFAULT_SAMPLE_DATA: Record<DocumentType, Record<string, unknown>> = {
  QUOTATION: {
    ...createBaseSampleContext(),
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
      terms: "Thanh toán 50% khi ký PO, 40% khi bàn giao, 10% sau nghiệm thu.",
      deliveryTerms: "Triển khai trong 30 ngày kể từ ngày xác nhận báo giá và chốt mặt bằng."
    },
    items: [
      { name: "Tủ điều khiển PLC", quantity: 2, unitPrice: 220000000, total: 440000000 },
      { name: "Biến tần trung thế", quantity: 4, unitPrice: 95000000, total: 380000000 },
      { name: "Dịch vụ lập trình & commissioning", quantity: 1, unitPrice: 160000000, total: 160000000 }
    ]
  },
  CONTRACT: {
    ...createBaseSampleContext(),
    linkedQuote: {
      subtotal: 1200000000,
      taxRate: 10,
      taxAmount: 120000000,
      total: 1320000000,
      items: SAMPLE_LINKED_QUOTE_ITEMS
    },
    milestones: [
      { name: "Khởi động dự án", dueDate: "2026-04-25T00:00:00.000Z", status: "IN_PROGRESS", paymentAmount: 528000000 },
      { name: "Bàn giao phần cứng", dueDate: "2026-05-25T00:00:00.000Z", status: "PENDING", paymentAmount: 528000000 },
      { name: "Nghiệm thu cuối", dueDate: "2026-07-20T00:00:00.000Z", status: "PENDING", paymentAmount: 264000000 }
    ]
  },
  PROPOSAL: {
    ...createBaseSampleContext(),
    title: "ĐỀ XUẤT DỰ ÁN / PROJECT PROPOSAL",
    linkedQuote: { quoteNo: "BG-2026-002", total: 1078000000 },
    milestones: [
      { name: "Khảo sát & thiết kế giải pháp", dueDate: "2026-05-20T00:00:00.000Z", status: "PLANNED", paymentAmount: 180000000 },
      { name: "Cung cấp thiết bị chính", dueDate: "2026-06-15T00:00:00.000Z", status: "PLANNED", paymentAmount: 780000000 },
      { name: "Commissioning & đào tạo", dueDate: "2026-07-10T00:00:00.000Z", status: "PLANNED", paymentAmount: 490000000 }
    ]
  },
  SURVEY_REPORT: {
    ...createBaseSampleContext(),
    title: "BÁO CÁO KHẢO SÁT / SURVEY REPORT",
    surveyorName: "Nguyễn Văn Kỹ Thuật",
    surveyDate: "2026-05-15T08:00:00.000Z",
    surveyActivity: { type: "SURVEY", scheduledAt: "2026-05-15T08:00:00.000Z" },
    findings: [
      { title: "Tủ điều khiển hiện hữu", description: "Thiết bị vận hành ổn định nhưng thiếu dự phòng nguồn và giám sát từ xa." },
      { title: "Hạ tầng mạng công nghiệp", description: "Cần bổ sung switch công nghiệp và phân vùng mạng OT/IT." },
      { title: "Không gian lắp đặt", description: "Khu vực tủ điện đủ diện tích, cần bổ sung máng cáp và tiếp địa." }
    ]
  },
  CONTRACT_ADDENDUM: {
    ...createBaseSampleContext(),
    title: "PHỤ LỤC HỢP ĐỒNG / CONTRACT ADDENDUM",
    addendumDate: "2026-05-15T08:00:00.000Z",
    modifications: [
      { content: "Gia hạn thời gian thực hiện hợp đồng thêm 30 ngày." },
      { content: "Bổ sung hạng mục đào tạo vận hành nâng cao cho đội kỹ thuật khách hàng." },
      { content: "Điều chỉnh lịch thanh toán đợt cuối sau nghiệm thu FAT/SAT." }
    ]
  },
  NDA: {
    ...createBaseSampleContext(),
    title: "THỎA THUẬN BẢO MẬT / NON-DISCLOSURE AGREEMENT",
    ndaDate: "2026-05-15T08:00:00.000Z",
    confidentialScopes: [
      { scope: "Tài liệu kỹ thuật", description: "Bản vẽ, sơ đồ hệ thống, cấu hình thiết bị và thông số vận hành." },
      { scope: "Thông tin thương mại", description: "Báo giá, chi phí, điều khoản thanh toán và chiến lược triển khai." },
      { scope: "Dữ liệu vận hành", description: "Log hệ thống, dữ liệu sản xuất và thông tin người dùng nội bộ." }
    ]
  },
  DELIVERY_NOTE: {
    ...createBaseSampleContext(),
    title: "BIÊN BẢN GIAO HÀNG / DELIVERY NOTE",
    deliveredItems: [
      { name: "Máy chủ Edge Controller", quantity: 2, unit: "Cái" },
      { name: "Tủ điện điều khiển trung tâm", quantity: 2, unit: "Cái" },
      { name: "Switch công nghiệp 8 port", quantity: 4, unit: "Cái" }
    ],
    deliveryDate: "2026-05-15T08:00:00.000Z"
  },
  DOC_HANDOVER: {
    ...createBaseSampleContext(),
    title: "BIÊN BẢN BÀN GIAO TÀI LIỆU / DOCUMENT HANDOVER",
    handedOverDocs: [
      { name: "Tài liệu hướng dẫn vận hành", format: "PDF + bản in", note: "01 bộ tiếng Việt" },
      { name: "Sơ đồ kiến trúc hệ thống", format: "PDF", note: "Bản cập nhật sau triển khai" },
      { name: "Biên bản nghiệm thu kỹ thuật", format: "Bản gốc", note: "02 bản có ký đóng dấu" }
    ],
    handoverDate: "2026-05-16T08:00:00.000Z"
  },
  INSTALLATION_REPORT: {
    ...createBaseSampleContext(),
    title: "BIÊN BẢN CÀI ĐẶT & TRIỂN KHAI / INSTALLATION REPORT",
    installations: [
      { name: "Lắp đặt máy chủ Edge Controller", status: "Hoàn thành", note: "Đã cấu hình IP và kiểm tra nguồn dự phòng." },
      { name: "Đấu nối tủ điều khiển trung tâm", status: "Hoàn thành", note: "Đã kiểm tra tín hiệu I/O." },
      { name: "Kết nối dashboard giám sát", status: "Hoàn thành", note: "Đã test truy cập từ phòng điều khiển." }
    ],
    installationDate: "2026-05-17T08:00:00.000Z"
  },
  ACCEPTANCE_REPORT: {
    ...createBaseSampleContext(),
    title: "BIÊN BẢN NGHIỆM THU KỸ THUẬT / UAT REPORT",
    testResults: [
      { name: "Kiểm thử tín hiệu PLC", status: "Đạt", note: "Tín hiệu ổn định trong 4 giờ chạy thử." },
      { name: "Kiểm thử cảnh báo dashboard", status: "Đạt", note: "Cảnh báo hiển thị đúng ngưỡng." },
      { name: "Kiểm thử báo cáo vận hành", status: "Đạt", note: "Xuất PDF thành công." }
    ],
    acceptanceDate: "2026-05-18T08:00:00.000Z"
  },
  PARTIAL_ACCEPTANCE: {
    ...createBaseSampleContext(),
    title: "BIÊN BẢN NGHIỆM THU GIAI ĐOẠN / PARTIAL ACCEPTANCE REPORT",
    acceptedParts: [
      { name: "Cung cấp thiết bị chính", ratio: "40%", value: 528000000, note: "Đã bàn giao đủ số lượng." },
      { name: "Lắp đặt tại hiện trường", ratio: "30%", value: 396000000, note: "Đã hoàn tất đấu nối." }
    ],
    acceptanceDate: "2026-05-19T08:00:00.000Z"
  },
  WARRANTY_CERT: {
    ...createBaseSampleContext(),
    title: "GIẤY CHỨNG NHẬN BẢO HÀNH / WARRANTY CERTIFICATE",
    warrantyDate: "2026-05-20T08:00:00.000Z",
    warrantyPeriodMonths: 12,
    warrantyEndDate: "2027-05-20T08:00:00.000Z",
    warrantyItems: [
      { name: "Máy chủ Edge Controller", period: "12 tháng", note: "Bảo hành phần cứng theo serial." },
      { name: "Tủ điện điều khiển trung tâm", period: "12 tháng", note: "Bao gồm module điều khiển và phụ kiện." }
    ]
  },
  MAINTENANCE_RECORD: {
    ...createBaseSampleContext(),
    title: "BIÊN BẢN BẢO TRÌ & HỖ TRỢ / MAINTENANCE RECORD",
    issues: [
      { name: "Kiểm tra CPU/RAM máy chủ", status: "Ổn định", note: "CPU < 40%, RAM < 60%." },
      { name: "Backup dữ liệu định kỳ", status: "Hoàn thành", note: "Đã sao lưu lên storage dự phòng." },
      { name: "Cập nhật bản vá bảo mật", status: "Hoàn thành", note: "Đã cập nhật bản vá tháng 05/2026." }
    ],
    maintenanceDate: "2026-05-21T08:00:00.000Z",
    technician: "Nguyễn Văn Kỹ Thuật"
  },
  PAYMENT_REQUEST: {
    ...createBaseSampleContext(),
    title: "GIẤY ĐỀ NGHỊ THANH TOÁN / PAYMENT REQUEST",
    requestDate: "2026-05-22T08:00:00.000Z",
    paymentAmount: 396000000,
    paymentReason: "Thanh toán tạm ứng đợt 1 theo hợp đồng (30%)",
    bankName: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)",
    bankAccountNo: "0071001988666",
    bankAccountName: "CONG TY TNHH AHSO",
    paymentLines: [
      { description: "Tạm ứng đợt 1 theo hợp đồng", amount: 396000000, note: "30% giá trị hợp đồng" }
    ]
  },
  PAYMENT_RECEIPT: {
    ...createBaseSampleContext(),
    title: "PHIẾU THU / PAYMENT RECEIPT",
    receiptDate: "2026-05-23T08:00:00.000Z",
    receiptAmount: 396000000,
    paymentMethod: "Chuyển khoản",
    receiptReason: "Thu tiền tạm ứng HĐ số HD-2026-003",
    cashier: "Nguyễn Thu Ngân",
    payerName: "Trần Thu Hà",
    receiptLines: [
      { description: "Thu tạm ứng đợt 1", amount: 396000000, method: "Chuyển khoản" }
    ]
  },
  AR_RECONCILIATION: {
    ...createBaseSampleContext(),
    title: "BẢNG ĐỐI CHIẾU CÔNG NỢ / AR RECONCILIATION STATEMENT",
    reconDate: "2026-05-24T08:00:00.000Z",
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-05-24T08:00:00.000Z",
    lineItems: [
      { contractNo: "HD-2026-003", projectName: "Dự án điều khiển tự động hóa nhà máy", contractValue: 1320000000, invoiced: 924000000, paid: 396000000, outstanding: 528000000 },
      { contractNo: "HD-2026-001", projectName: "Nâng cấp SCADA tuyến bơm", contractValue: 680000000, invoiced: 680000000, paid: 520000000, outstanding: 160000000 }
    ],
    totals: {
      contractValue: 2000000000,
      invoiced: 1604000000,
      paid: 916000000,
      outstanding: 688000000
    }
  }
};

const PROPOSAL_TOKENS: TemplateTokenGroup[] = [
  ...QUOTATION_TOKENS,
  {
    id: "proposal",
    label: "Đề xuất",
    tokens: [
      { key: "project.estimatedValue", label: "Giá trị dự kiến", description: "Giá trị dự kiến của dự án." },
      { key: "linkedQuote.total", label: "Tổng báo giá liên kết", description: "Tổng giá trị báo giá liên quan." },
      { key: "milestones", label: "Danh sách mốc", description: "Nguồn bảng mốc triển khai." },
      { key: "milestones[].name", label: "Tên mốc", description: "Tên giai đoạn triển khai." },
      { key: "milestones[].description", label: "Mô tả mốc", description: "Mô tả chi tiết nội dung giai đoạn." },
      { key: "milestones[].dueDate", label: "Hạn mốc", description: "Ngày đến hạn từng mốc." },
      { key: "milestones[].completedAt", label: "Ngày hoàn tất mốc", description: "Ngày mốc được hoàn tất." },
      { key: "milestones[].status", label: "Trạng thái mốc", description: "Trạng thái milestone." },
      { key: "milestones[].paymentAmount", label: "Giá trị mốc", description: "Giá trị thanh toán theo mốc." },
      { key: "milestones[].notes", label: "Ghi chú mốc", description: "Ghi chú thêm về giai đoạn." }
    ]
  }
];

const SURVEY_REPORT_TOKENS: TemplateTokenGroup[] = [
  CONTRACT_TOKENS[0],
  CONTRACT_TOKENS[2],
  {
    id: "survey",
    label: "Khảo sát",
    tokens: [
      { key: "surveyActivity", label: "Hoạt động khảo sát", description: "Hoạt động khảo sát liên quan." },
      { key: "surveyorName", label: "Người khảo sát", description: "Tên người thực hiện khảo sát." },
      { key: "surveyDate", label: "Ngày khảo sát", description: "Ngày thực hiện khảo sát." },
      { key: "findings", label: "Danh sách phát hiện", description: "Nguồn bảng phát hiện khảo sát." },
      { key: "findings[].title", label: "Tiêu đề phát hiện", description: "Tên phát hiện khảo sát." },
      { key: "findings[].description", label: "Mô tả phát hiện", description: "Mô tả chi tiết phát hiện." }
    ]
  }
];

const OPERATIONAL_DOC_TOKENS: TemplateTokenGroup[] = [
  CONTRACT_TOKENS[0],
  CONTRACT_TOKENS[1],
  CONTRACT_TOKENS[2],
  {
    id: "operational",
    label: "Vận hành",
    tokens: [
      { key: "deliveryDate", label: "Ngày giao hàng", description: "Ngày lập biên bản giao hàng." },
      { key: "deliveredItems", label: "Hàng đã giao", description: "Nguồn bảng hàng hóa bàn giao." },
      { key: "handedOverDocs", label: "Tài liệu bàn giao", description: "Nguồn bảng tài liệu bàn giao." },
      { key: "installations", label: "Hạng mục triển khai", description: "Nguồn bảng cài đặt/triển khai." },
      { key: "testResults", label: "Kết quả nghiệm thu", description: "Nguồn bảng kiểm thử/nghiệm thu." },
      { key: "acceptedParts", label: "Hạng mục nghiệm thu giai đoạn", description: "Nguồn bảng nghiệm thu giai đoạn." },
      { key: "warrantyDate", label: "Ngày bảo hành", description: "Ngày bắt đầu bảo hành." },
      { key: "warrantyPeriodMonths", label: "Thời hạn bảo hành", description: "Số tháng bảo hành." },
      { key: "warrantyEndDate", label: "Ngày hết hạn bảo hành", description: "Ngày kết thúc bảo hành." },
      { key: "issues", label: "Nội dung bảo trì", description: "Nguồn bảng nội dung bảo trì." },
      { key: "maintenanceDate", label: "Ngày bảo trì", description: "Ngày lập biên bản bảo trì." },
      { key: "technician", label: "Kỹ thuật viên", description: "Người phụ trách bảo trì." }
    ]
  }
];

const PAYMENT_TOKENS: TemplateTokenGroup[] = [
  CONTRACT_TOKENS[0],
  CONTRACT_TOKENS[1],
  CONTRACT_TOKENS[2],
  {
    id: "payment",
    label: "Thanh toán",
    tokens: [
      { key: "requestDate", label: "Ngày đề nghị", description: "Ngày lập giấy đề nghị thanh toán." },
      { key: "paymentAmount", label: "Số tiền đề nghị", description: "Số tiền đề nghị thanh toán." },
      { key: "paymentReason", label: "Lý do thanh toán", description: "Lý do đề nghị thanh toán." },
      { key: "bankName", label: "Ngân hàng", description: "Tên ngân hàng nhận tiền." },
      { key: "bankAccountNo", label: "Số tài khoản", description: "Số tài khoản nhận tiền." },
      { key: "bankAccountName", label: "Tên tài khoản", description: "Tên chủ tài khoản nhận tiền." },
      { key: "receiptDate", label: "Ngày thu", description: "Ngày lập phiếu thu." },
      { key: "receiptAmount", label: "Số tiền thu", description: "Số tiền đã thu." },
      { key: "paymentMethod", label: "Hình thức thanh toán", description: "Tiền mặt/chuyển khoản." },
      { key: "receiptReason", label: "Lý do thu", description: "Nội dung thu tiền." },
      { key: "cashier", label: "Thu ngân", description: "Người ghi nhận phiếu thu." },
      { key: "payerName", label: "Người nộp", description: "Người nộp tiền." }
    ]
  }
];

const AR_RECONCILIATION_TOKENS: TemplateTokenGroup[] = [
  CONTRACT_TOKENS[0],
  QUOTATION_TOKENS[2],
  {
    id: "ar-reconciliation",
    label: "Công nợ",
    tokens: [
      { key: "reconDate", label: "Ngày đối chiếu", description: "Ngày lập bảng đối chiếu." },
      { key: "periodStart", label: "Từ ngày", description: "Ngày bắt đầu kỳ đối chiếu." },
      { key: "periodEnd", label: "Đến ngày", description: "Ngày kết thúc kỳ đối chiếu." },
      { key: "lineItems", label: "Dòng công nợ", description: "Nguồn bảng công nợ." },
      { key: "lineItems[].contractNo", label: "Số hợp đồng", description: "Số hợp đồng từng dòng." },
      { key: "lineItems[].projectName", label: "Tên dự án", description: "Tên dự án từng dòng." },
      { key: "lineItems[].contractValue", label: "Giá trị hợp đồng", description: "Giá trị hợp đồng từng dòng." },
      { key: "lineItems[].invoiced", label: "Đã xuất hóa đơn", description: "Số tiền đã xuất hóa đơn." },
      { key: "lineItems[].paid", label: "Đã thanh toán", description: "Số tiền đã thanh toán." },
      { key: "lineItems[].outstanding", label: "Còn phải thu", description: "Số tiền còn phải thu." },
      { key: "totals.contractValue", label: "Tổng giá trị hợp đồng", description: "Tổng giá trị hợp đồng." },
      { key: "totals.invoiced", label: "Tổng đã xuất hóa đơn", description: "Tổng đã xuất hóa đơn." },
      { key: "totals.paid", label: "Tổng đã thu", description: "Tổng đã thanh toán." },
      { key: "totals.outstanding", label: "Tổng còn phải thu", description: "Tổng công nợ còn lại." }
    ]
  }
];

const NDA_TOKENS: TemplateTokenGroup[] = [
  CONTRACT_TOKENS[0],
  QUOTATION_TOKENS[2],
  {
    id: "nda",
    label: "NDA",
    tokens: [
      { key: "ndaDate", label: "Ngày NDA", description: "Ngày hiệu lực thỏa thuận bảo mật." },
      { key: "confidentialScopes", label: "Phạm vi bảo mật", description: "Nguồn bảng phạm vi bảo mật." },
      { key: "confidentialScopes[].scope", label: "Tên phạm vi", description: "Tên phạm vi cần bảo mật." },
      { key: "confidentialScopes[].description", label: "Mô tả phạm vi", description: "Mô tả thông tin bảo mật." }
    ]
  }
];

const ADDENDUM_TOKENS: TemplateTokenGroup[] = [
  CONTRACT_TOKENS[0],
  CONTRACT_TOKENS[1],
  CONTRACT_TOKENS[2],
  {
    id: "addendum",
    label: "Phụ lục",
    tokens: [
      { key: "addendumDate", label: "Ngày phụ lục", description: "Ngày lập phụ lục hợp đồng." },
      { key: "modifications", label: "Nội dung điều chỉnh", description: "Nguồn bảng nội dung điều chỉnh." },
      { key: "modifications[].content", label: "Dòng điều chỉnh", description: "Nội dung từng thay đổi trong phụ lục." }
    ]
  }
];

const TOKEN_GROUPS_MAP: Record<DocumentType, TemplateTokenGroup[]> = {
  QUOTATION: QUOTATION_TOKENS,
  CONTRACT: CONTRACT_TOKENS,
  PROPOSAL: PROPOSAL_TOKENS,
  SURVEY_REPORT: SURVEY_REPORT_TOKENS,
  CONTRACT_ADDENDUM: ADDENDUM_TOKENS,
  NDA: NDA_TOKENS,
  DELIVERY_NOTE: OPERATIONAL_DOC_TOKENS,
  DOC_HANDOVER: OPERATIONAL_DOC_TOKENS,
  INSTALLATION_REPORT: OPERATIONAL_DOC_TOKENS,
  ACCEPTANCE_REPORT: OPERATIONAL_DOC_TOKENS,
  PARTIAL_ACCEPTANCE: OPERATIONAL_DOC_TOKENS,
  WARRANTY_CERT: OPERATIONAL_DOC_TOKENS,
  MAINTENANCE_RECORD: OPERATIONAL_DOC_TOKENS,
  PAYMENT_REQUEST: PAYMENT_TOKENS,
  PAYMENT_RECEIPT: PAYMENT_TOKENS,
  AR_RECONCILIATION: AR_RECONCILIATION_TOKENS
};

export function buildDocumentTemplateCatalog(type: DocumentType): TemplateCatalog {
  const entry = getTemplateEntry(type);

  return {
    type,
    label: entry.label,
    defaultLayout: cloneLayout(DEFAULT_LAYOUTS[type]),
    boxLibrary: createDefaultBoxLibrary(),
    tokenGroups: TOKEN_GROUPS_MAP[type] ?? QUOTATION_TOKENS,
    sampleData: DEFAULT_SAMPLE_DATA[type] ?? {}
  };
}

export function createDefaultLayoutForType(type: DocumentType) {
  return cloneLayout(DEFAULT_LAYOUTS[type]);
}
