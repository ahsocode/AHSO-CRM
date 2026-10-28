/**
 * Realistic render fixtures for every document type (audit DOCUMENT_TEMPLATE_AUDIT.md, step 0).
 *
 * The harness wires the REAL DocumentsService + DocumentDataLoaderService + I18nService +
 * QuotationFlowHtmlRendererService and only replaces I/O with plain objects (Prisma rows,
 * settings, uploads, PDF). No jest APIs here so `scripts/render-docs` can reuse it.
 */
import { Prisma } from "@prisma/client";
import type { DocumentType } from "@prisma/client";
import type { JwtUser } from "../../auth/auth.types";
import type { PrismaService } from "../../common/prisma.service";
import type { SettingsService } from "../../settings/settings.service";
import type { UploadService } from "../../upload/upload.service";
import { DocumentDataLoaderService } from "../document-data-loader.service";
import type { DocumentLayoutRendererService } from "../document-layout-renderer.service";
import type { DocumentNumberService } from "../document-number.service";
import type { DocumentTemplateVariantsService } from "../document-template-variants.service";
import { DocumentsService } from "../documents.service";
import type { DocumentLanguage } from "../dto/document-type.enum";
import { I18nService } from "../i18n.service";
import type { PdfRendererService } from "../pdf-renderer.service";
import { QuotationFlowHtmlRendererService } from "../quotation-flow-html-renderer.service";
import { TEMPLATE_REGISTRY } from "../template-registry";

export type FixtureVariant = "full" | "minimal";

/** 2026-10-28 00:30 in Asia/Ho_Chi_Minh — still 2026-10-27 in UTC (catches timezone bugs). */
export const FIXTURE_NOW = new Date("2026-10-27T17:30:00.000Z");

export const FIXTURE_USER: JwtUser = {
  sub: "user-admin",
  email: "admin@ahso.vn",
  name: "Admin AHSO",
  role: "ADMIN",
  permissions: []
} as unknown as JwtUser;

const dec = (value: string | number) => new Prisma.Decimal(value);
const at = (iso: string) => new Date(iso);

/** Settings as stored by the settings module: the tax id key is `taxId`, NOT `taxCode` (audit E-02). */
export function companySettings(variant: FixtureVariant): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: "CÔNG TY TNHH AHSO",
    taxId: "0316896939",
    address: "39/15 Đường Cao Bá Quát, Phường 9, Quận Gò Vấp, TP. Hồ Chí Minh",
    phone: "0901951351",
    email: "sales@ahso.vn",
    website: "https://www.ahso.vn",
    representative: "Ngô Văn Hùng",
    representativeTitle: "Giám đốc"
  };
  if (variant === "minimal") return base;
  return {
    ...base,
    bankName: "Techcombank",
    bankBranch: "Bình Dương",
    bankAccount: "19036688990011",
    bankAccountName: "CONG TY TNHH AHSO",
    contactName: "Nguyễn Thị Kế Toán"
  };
}

export const POLICIES = { warrantyPeriodMonths: 18, paymentDeadlineDays: 15, ndaDurationYears: 3 };
export const LOGO_DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

function contact() {
  return {
    id: "contact-orion-1",
    name: "Trần Thu Hà",
    title: "Trưởng phòng Kỹ thuật",
    department: "Kỹ thuật",
    email: "ha.tran@orion.example",
    phone: "0283 999 1234",
    isPrimary: true,
    notes: null,
    customerId: "cust-orion",
    createdAt: at("2026-05-01T02:00:00.000Z"),
    updatedAt: at("2026-05-01T02:00:00.000Z")
  };
}

function customer(variant: FixtureVariant) {
  return {
    id: "cust-orion",
    name: "CÔNG TY TNHH ORION FOOD VINA",
    shortName: "Orion Vina",
    code: "ORION",
    language: "vi",
    taxCode: variant === "full" ? "3700512345" : null,
    industry: "Thực phẩm",
    address: variant === "full" ? "Số 2 Đại lộ Tự Do, KCN Việt Nam - Singapore, Thuận An, Bình Dương" : null,
    website: null,
    phone: variant === "full" ? "0274 376 8888" : null,
    email: variant === "full" ? "purchasing@orion.example" : null,
    source: null,
    notes: null,
    status: "ACTIVE",
    isVip: true,
    deletedAt: null,
    assignedToId: "user-admin",
    createdAt: at("2026-01-10T02:00:00.000Z"),
    updatedAt: at("2026-10-01T02:00:00.000Z"),
    contacts: variant === "full" ? [contact()] : []
  };
}

/** Orion quote BG-2026-059 style: 3 lines at 8% (base 70.750.000) + 1 KCT line; total 88.410.000. */
function quoteItems(variant: FixtureVariant) {
  if (variant === "minimal") return [];
  return [
    { id: "qi-1", order: 1, name: "Biến tần ABB ACS580 7.5kW", description: "Biến tần cho motor hút bột Mixer MB\n✓ Bảo vệ quá tải ✓ Tích hợp Modbus", unit: "cái", quantity: dec(2), unitPrice: dec(18500000), total: dec(37000000), taxRate: dec("8.00"), quoteId: "quote-orion", materialId: null, bomId: null },
    { id: "qi-2", order: 2, name: "Tủ điện điều khiển", description: "Vỏ tủ sơn tĩnh điện 600x800", unit: "bộ", quantity: dec(1), unitPrice: dec(21750000), total: dec(21750000), taxRate: dec(8), quoteId: "quote-orion", materialId: null, bomId: null },
    { id: "qi-3", order: 3, name: "Lắp đặt & chạy thử", description: null, unit: "gói", quantity: dec(1), unitPrice: dec(12000000), total: dec(12000000), taxRate: dec(8), quoteId: "quote-orion", materialId: null, bomId: null },
    { id: "qi-4", order: 4, name: "Phần mềm giám sát năng lượng", description: "Bản quyền vĩnh viễn", unit: "bản", quantity: dec(1), unitPrice: dec(12000000), total: dec(12000000), taxRate: null, quoteId: "quote-orion", materialId: null, bomId: null }
  ];
}

function milestones(variant: FixtureVariant) {
  if (variant === "minimal") {
    return [
      { id: "ms-x", name: "Thanh toán sau nghiệm thu", description: null, dueDate: null, completedAt: null, status: "PENDING", paymentAmount: null, notes: null, projectId: "proj-orion", contractId: "contract-orion", createdAt: at("2026-10-01T02:00:00.000Z") }
    ];
  }
  return [
    { id: "ms-1", name: "Tạm ứng 30%", description: null, dueDate: at("2026-10-24T05:00:00.000Z"), completedAt: at("2026-10-22T03:00:00.000Z"), status: "DONE", paymentAmount: dec(26523000), notes: null, projectId: "proj-orion", contractId: "contract-orion", createdAt: at("2026-10-01T02:00:00.000Z") },
    { id: "ms-2", name: "Giao hàng 60%", description: null, dueDate: at("2026-11-14T05:00:00.000Z"), completedAt: null, status: "PENDING", paymentAmount: dec(53046000), notes: null, projectId: "proj-orion", contractId: "contract-orion", createdAt: at("2026-10-01T02:00:00.000Z") },
    { id: "ms-3", name: "Nghiệm thu 10%", description: null, dueDate: at("2026-12-14T05:00:00.000Z"), completedAt: null, status: "PENDING", paymentAmount: dec(8841000), notes: null, projectId: "proj-orion", contractId: "contract-orion", createdAt: at("2026-10-01T02:00:00.000Z") }
  ];
}

function project(variant: FixtureVariant) {
  return {
    id: "proj-orion",
    code: "PRJ-2026-031",
    name: "Lắp đặt biến tần hút bột Mixer MB",
    description: "Thay khởi động sao-tam giác bằng biến tần cho motor hút bột",
    status: "DELIVERING",
    stageChangedAt: at("2026-10-20T02:00:00.000Z"),
    priority: "HIGH",
    estimatedValue: dec(90000000),
    startDate: variant === "full" ? at("2026-11-02T05:00:00.000Z") : null,
    expectedEndDate: variant === "full" ? at("2026-12-14T05:00:00.000Z") : null,
    completedAt: null,
    salesInvoiceDate: null,
    notes: null,
    deletedAt: null,
    customerId: "cust-orion",
    contactId: null,
    createdAt: at("2026-09-15T02:00:00.000Z"),
    updatedAt: at("2026-10-20T02:00:00.000Z")
  };
}

function quoteRow(variant: FixtureVariant) {
  const full = variant === "full";
  return {
    id: "quote-orion",
    quoteNo: "BG-2026-059",
    version: 2,
    status: "ACCEPTED",
    validUntil: full ? at("2026-11-26T05:00:00.000Z") : null,
    subtotal: dec(full ? 82750000 : 0),
    taxRate: dec(8),
    taxAmount: dec(full ? 5660000 : 0),
    total: dec(full ? 88410000 : 0),
    tableColumnWidths: null,
    terms: full ? "Thanh toán 30% tạm ứng, 60% khi giao hàng, 10% sau nghiệm thu." : null,
    deliveryTerms: full ? "Giao hàng trong 30 ngày kể từ ngày nhận tạm ứng." : null,
    internalNote: "KHÔNG IN: biên lợi nhuận 18%",
    sentAt: at("2026-10-05T02:00:00.000Z"),
    acceptedAt: at("2026-10-15T02:00:00.000Z"),
    acceptedItemIds: [],
    projectId: "proj-orion",
    createdById: "user-admin",
    createdAt: at("2026-10-03T02:00:00.000Z"),
    updatedAt: at("2026-10-15T02:00:00.000Z"),
    deletedAt: null,
    items: quoteItems(variant)
  };
}

/** Single-group legacy quote (10%, no KCT) — exercises the "no base text" VAT row. */
function singleRateQuoteRow() {
  return {
    ...quoteRow("full"),
    id: "quote-single",
    quoteNo: "BG-2026-041",
    version: 1,
    subtotal: dec(50000000),
    taxRate: dec(10),
    taxAmount: dec(5000000),
    total: dec(55000000),
    items: [
      { id: "qs-1", order: 1, name: "Camera công nghiệp 5MP", description: null, unit: "bộ", quantity: dec(2), unitPrice: dec(25000000), total: dec(50000000), taxRate: dec(10), quoteId: "quote-single", materialId: null, bomId: null }
    ]
  };
}

function contractRow(variant: FixtureVariant) {
  const full = variant === "full";
  const items = full
    ? quoteItems("full").map((item, index) => ({
        id: `ci-${index + 1}`,
        order: item.order,
        name: item.name,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        contractId: "contract-orion",
        quoteItemId: item.id,
        createdAt: at("2026-10-16T02:00:00.000Z"),
        updatedAt: at("2026-10-16T02:00:00.000Z")
      }))
    : [];
  return {
    id: "contract-orion",
    contractNo: "HD-2026-012",
    signDate: at("2026-10-19T05:00:00.000Z"),
    startDate: full ? at("2026-11-02T05:00:00.000Z") : null,
    endDate: full ? at("2026-12-14T05:00:00.000Z") : null,
    value: dec(88410000),
    status: "ACTIVE",
    fileUrl: null,
    notes: null,
    projectId: "proj-orion",
    createdAt: at("2026-10-16T02:00:00.000Z"),
    updatedAt: at("2026-10-16T02:00:00.000Z"),
    deletedAt: null,
    items,
    milestones: milestones(variant),
    project: {
      ...project(variant),
      customer: customer(variant),
      quotes: full ? [quoteRow("full")] : []
    }
  };
}

function surveyRow() {
  return {
    id: "survey-1",
    title: "Khảo sát tủ điện Mixer MB",
    surveyedAt: at("2026-09-20T02:00:00.000Z"),
    location: "Xưởng Mixer MB, Orion Vina",
    customerParticipants: "Trần Thu Hà",
    objectives: "Đánh giá hiện trạng motor hút bột",
    summary: "Motor 7.5kW khởi động sao-tam giác, dòng khởi động cao.",
    nextStep: "Gửi báo giá biến tần",
    customerId: "cust-orion",
    projectId: "proj-orion",
    createdById: "user-admin",
    createdAt: at("2026-09-20T02:00:00.000Z"),
    updatedAt: at("2026-09-20T02:00:00.000Z"),
    createdBy: { name: "Kỹ sư Lê Minh" },
    notes: [
      { id: "sn-1", type: "TECHNICAL_REQUIREMENT", content: "Nguồn 3 pha 380V, tủ hiện hữu không còn chỗ trống.", isImportant: true, createdAt: at("2026-09-20T03:00:00.000Z") },
      { id: "sn-2", type: "RISK", content: "Bụi bột mì: cần tủ IP54.", isImportant: false, createdAt: at("2026-09-20T03:05:00.000Z") }
    ]
  };
}

/** Plain-object Prisma stand-in: returns fixture rows, records nothing, never touches a DB. */
export function createFixturePrisma(variant: FixtureVariant) {
  const full = variant === "full";
  const documents: Array<Record<string, unknown>> = [];
  return {
    documents,
    contract: {
      findUnique: async ({ where }: { where: { id: string } }) => (where.id === "contract-orion" ? contractRow(variant) : null)
    },
    quote: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = where.id === "quote-orion" ? quoteRow(variant) : where.id === "quote-single" ? singleRateQuoteRow() : null;
        if (!row) return null;
        return {
          ...row,
          project: { ...project(variant), customer: customer(variant), milestones: milestones(variant) },
          createdBy: { id: "user-admin", name: "Admin AHSO", email: "admin@ahso.vn" }
        };
      }
    },
    customer: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id !== "cust-orion") return null;
        const contract = contractRow(variant);
        return {
          ...customer(variant),
          projects: [{ ...project(variant), contract: full ? { ...contract, items: undefined, milestones: undefined, project: undefined } : null }]
        };
      },
      findFirst: async () => ({ id: "cust-orion" })
    },
    project: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id !== "proj-orion") return null;
        return {
          ...project(variant),
          customer: customer(variant),
          milestones: milestones(variant),
          quotes: full ? [quoteRow("full")] : []
        };
      }
    },
    survey: {
      findFirst: async () => (full ? surveyRow() : null)
    },
    payment: {
      findFirst: async () =>
        full
          ? { id: "pay-1", amount: dec(26523000), paidAt: at("2026-10-22T03:00:00.000Z"), method: "Chuyển khoản", reference: "FT2629512345", notes: "Tạm ứng 30% HĐ HD-2026-012", projectId: "proj-orion", contractId: "contract-orion", quoteId: null, createdAt: at("2026-10-22T03:00:00.000Z") }
          : null,
      groupBy: async () => (full ? [{ contractId: "contract-orion", _sum: { amount: dec(26523000) } }] : [])
    },
    document: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `doc-${documents.length + 1}`, ...data };
        documents.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({ id: where.id, ...data }),
      delete: async () => undefined
    }
  };
}

/** Entity id passed to each type's loader. */
export const FIXTURE_ENTITY_IDS: Record<DocumentType, string> = Object.fromEntries(
  Object.values(TEMPLATE_REGISTRY).map((entry) => [
    entry.type,
    entry.entityType === "quote" ? "quote-orion" : entry.entityType === "customer" ? "cust-orion" : entry.entityType === "project" ? "proj-orion" : "contract-orion"
  ])
) as Record<DocumentType, string>;

export const ALL_DOCUMENT_TYPES = Object.keys(TEMPLATE_REGISTRY) as DocumentType[];
export const ALL_LANGUAGES: DocumentLanguage[] = ["vi", "vi-en"];

export interface RenderHarness {
  service: DocumentsService;
  prisma: ReturnType<typeof createFixturePrisma>;
  /** HTML handed to the PDF renderer (renderPdf path). */
  pdfHtml: string[];
  render(type: DocumentType, language: DocumentLanguage, entityId?: string): Promise<string>;
}

export async function createRenderHarness(
  variant: FixtureVariant = "full",
  overrides: { company?: Record<string, unknown>; logo?: string | null } = {}
): Promise<RenderHarness> {
  const prisma = createFixturePrisma(variant);
  const company = overrides.company ?? companySettings(variant);
  const logo = overrides.logo !== undefined ? overrides.logo : variant === "full" ? LOGO_DATA_URL : null;
  const settings = {
    getAllSettings: async () => ({ company, policies: variant === "full" ? POLICIES : {}, logo }),
    getCompanyInfo: async () => company
  };
  const upload = {
    readFileAsDataUrl: async () => null,
    saveBuffer: async () => ({ url: "/uploads/documents/fixture.pdf", filename: "fixture.pdf", size: 1, mimeType: "application/pdf" }),
    readStoredFile: async () => null
  };
  const pdfHtml: string[] = [];
  const pdfRenderer = {
    render: async (html: string) => {
      pdfHtml.push(html);
      return Buffer.from("%PDF-fixture");
    }
  };
  const documentNumbers = {
    reserveWithRetry: async (
      _type: DocumentType,
      _code: string | null,
      _version: number,
      attempt: (number: string, version: number) => Promise<void>
    ) => {
      await attempt("FX-2026-ORION-001-v1", 1);
      return "FX-2026-ORION-001-v1";
    }
  };
  const templateVariants = {
    getActiveVariant: async () => null,
    getPublishedRuntimeVariant: async () => null
  };

  const loader = new DocumentDataLoaderService(
    prisma as unknown as PrismaService,
    settings as unknown as SettingsService,
    upload as unknown as UploadService
  );
  const service = new DocumentsService(
    prisma as unknown as PrismaService,
    loader,
    documentNumbers as unknown as DocumentNumberService,
    pdfRenderer as unknown as PdfRendererService,
    new I18nService(),
    templateVariants as unknown as DocumentTemplateVariantsService,
    {} as DocumentLayoutRendererService,
    new QuotationFlowHtmlRendererService(),
    upload as unknown as UploadService
  );
  await service.onModuleInit();

  return {
    service,
    prisma,
    pdfHtml,
    async render(type, language, entityId) {
      const { html } = await service.renderPreview(type, entityId ?? FIXTURE_ENTITY_IDS[type], language, FIXTURE_USER);
      return html;
    }
  };
}

/** Visible document text/markup without the CSS bundle (CSS legitimately contains words like "none"). */
export function stripStyles(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, "");
}

/** The quotation totals table (subtotal + VAT rows + total). */
export function extractQuotationSummary(html: string): string {
  const match = html.match(/<table class="summary-table">[\s\S]*?<\/table>/);
  if (!match) throw new Error("summary-table not found in QUOTATION html");
  return match[0];
}

/** Normalised text of the numbered articles (Điều …) of a legal document — used to lock clause wording. */
export function extractLegalArticlesText(html: string): string {
  const body = stripStyles(html);
  const start = body.indexOf('<div class="classic-article"');
  if (start < 0) throw new Error("no classic-article block found");
  const end = body.indexOf('<div class="avoid-break"', start);
  const segment = body.slice(start, end < 0 ? undefined : end);
  return segment
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clamp jest fake timers to Date only (fs/promises keep working). */
export const DATE_ONLY_FAKE_TIMERS = {
  now: FIXTURE_NOW,
  doNotFake: [
    "nextTick",
    "setImmediate",
    "clearImmediate",
    "queueMicrotask",
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    "hrtime",
    "performance"
  ]
} as const;
