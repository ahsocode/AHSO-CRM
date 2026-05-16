import { NotFoundException } from "@nestjs/common";
import { DocumentType } from "@prisma/client";
import { DOCUMENT_PREFIX } from "./document-number.service";
import type { DocumentEntityType } from "./dto/document-type.enum";

export type TemplateStyle = "modern" | "classic";
export type TemplateRuntimeStatus = "production" | "beta";

/**
 * One template loader method name per document type. The actual loader lives
 * on DocumentDataLoaderService — the registry only records the string name so
 * we can dispatch dynamically without introducing a circular dependency.
 */
export interface TemplateRegistryEntry {
  type: DocumentType;
  /** Human-readable label shown in frontend/admin. */
  label: string;
  /** Folder under `templates/` holding `vi.hbs` and `vi-en.hbs`. */
  templateDir: string;
  prefix: string;
  style: TemplateStyle;
  /** Which entity type (URL segment) this template is keyed off. */
  entityType: DocumentEntityType;
  /** Method name on DocumentDataLoaderService to call for data loading. */
  loaderMethod: string;
  /** Phase number the concrete template ships in. */
  phase: number;
  runtimeStatus: TemplateRuntimeStatus;
  endUserEnabled: boolean;
}

export const TEMPLATE_REGISTRY: Record<DocumentType, TemplateRegistryEntry> = {
  QUOTATION: {
    type: "QUOTATION",
    label: "Báo giá",
    templateDir: "QUOTATION",
    prefix: DOCUMENT_PREFIX.QUOTATION,
    style: "modern",
    entityType: "quote",
    loaderMethod: "loadForQuotation",
    phase: 1,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  PROPOSAL: {
    type: "PROPOSAL",
    label: "Đề xuất dự án",
    templateDir: "PROPOSAL",
    prefix: DOCUMENT_PREFIX.PROPOSAL,
    style: "modern",
    entityType: "project",
    loaderMethod: "loadForProposal",
    phase: 2,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  SURVEY_REPORT: {
    type: "SURVEY_REPORT",
    label: "Báo cáo khảo sát",
    templateDir: "SURVEY_REPORT",
    prefix: DOCUMENT_PREFIX.SURVEY_REPORT,
    style: "modern",
    entityType: "project",
    loaderMethod: "loadForSurveyReport",
    phase: 3,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  CONTRACT: {
    type: "CONTRACT",
    label: "Hợp đồng kinh tế",
    templateDir: "CONTRACT",
    prefix: DOCUMENT_PREFIX.CONTRACT,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForContract",
    phase: 4,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  CONTRACT_ADDENDUM: {
    type: "CONTRACT_ADDENDUM",
    label: "Phụ lục hợp đồng",
    templateDir: "CONTRACT_ADDENDUM",
    prefix: DOCUMENT_PREFIX.CONTRACT_ADDENDUM,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForContractAddendum",
    phase: 5,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  NDA: {
    type: "NDA",
    label: "Thỏa thuận bảo mật",
    templateDir: "NDA",
    prefix: DOCUMENT_PREFIX.NDA,
    style: "classic",
    entityType: "customer",
    loaderMethod: "loadForNda",
    phase: 6,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  DELIVERY_NOTE: {
    type: "DELIVERY_NOTE",
    label: "Biên bản giao hàng",
    templateDir: "DELIVERY_NOTE",
    prefix: DOCUMENT_PREFIX.DELIVERY_NOTE,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForDeliveryNote",
    phase: 7,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  DOC_HANDOVER: {
    type: "DOC_HANDOVER",
    label: "Biên bản bàn giao hồ sơ",
    templateDir: "DOC_HANDOVER",
    prefix: DOCUMENT_PREFIX.DOC_HANDOVER,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForDocHandover",
    phase: 8,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  INSTALLATION_REPORT: {
    type: "INSTALLATION_REPORT",
    label: "Biên bản lắp đặt",
    templateDir: "INSTALLATION_REPORT",
    prefix: DOCUMENT_PREFIX.INSTALLATION_REPORT,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForInstallationReport",
    phase: 9,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  ACCEPTANCE_REPORT: {
    type: "ACCEPTANCE_REPORT",
    label: "Biên bản nghiệm thu",
    templateDir: "ACCEPTANCE_REPORT",
    prefix: DOCUMENT_PREFIX.ACCEPTANCE_REPORT,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForAcceptanceReport",
    phase: 10,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  PARTIAL_ACCEPTANCE: {
    type: "PARTIAL_ACCEPTANCE",
    label: "Biên bản nghiệm thu giai đoạn",
    templateDir: "PARTIAL_ACCEPTANCE",
    prefix: DOCUMENT_PREFIX.PARTIAL_ACCEPTANCE,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForPartialAcceptance",
    phase: 11,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  WARRANTY_CERT: {
    type: "WARRANTY_CERT",
    label: "Phiếu bảo hành",
    templateDir: "WARRANTY_CERT",
    prefix: DOCUMENT_PREFIX.WARRANTY_CERT,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForWarrantyCert",
    phase: 12,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  MAINTENANCE_RECORD: {
    type: "MAINTENANCE_RECORD",
    label: "Biên bản bảo trì",
    templateDir: "MAINTENANCE_RECORD",
    prefix: DOCUMENT_PREFIX.MAINTENANCE_RECORD,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForMaintenanceRecord",
    phase: 13,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  PAYMENT_REQUEST: {
    type: "PAYMENT_REQUEST",
    label: "Đề nghị thanh toán",
    templateDir: "PAYMENT_REQUEST",
    prefix: DOCUMENT_PREFIX.PAYMENT_REQUEST,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForPaymentRequest",
    phase: 14,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  PAYMENT_RECEIPT: {
    type: "PAYMENT_RECEIPT",
    label: "Phiếu thu",
    templateDir: "PAYMENT_RECEIPT",
    prefix: DOCUMENT_PREFIX.PAYMENT_RECEIPT,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForPaymentReceipt",
    phase: 15,
    runtimeStatus: "production",
    endUserEnabled: true
  },
  AR_RECONCILIATION: {
    type: "AR_RECONCILIATION",
    label: "Biên bản đối chiếu công nợ",
    templateDir: "AR_RECONCILIATION",
    prefix: DOCUMENT_PREFIX.AR_RECONCILIATION,
    style: "classic",
    entityType: "customer",
    loaderMethod: "loadForArReconciliation",
    phase: 16,
    runtimeStatus: "production",
    endUserEnabled: true
  }
};

export function getTemplateEntry(type: DocumentType): TemplateRegistryEntry {
  const entry = TEMPLATE_REGISTRY[type];
  if (!entry) {
    throw new NotFoundException(`Không tìm thấy template cho loại tài liệu ${type}`);
  }
  return entry;
}
