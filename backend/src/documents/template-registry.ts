import { DocumentType } from "@prisma/client";
import { DOCUMENT_PREFIX } from "./document-number.service";
import type { DocumentEntityType } from "./dto/document-type.enum";

export type TemplateStyle = "modern" | "classic";

/**
 * One template loader method name per document type. The actual loader lives
 * on DocumentDataLoaderService — the registry only records the string name so
 * we can dispatch dynamically without introducing a circular dependency.
 */
export interface TemplateRegistryEntry {
  type: DocumentType;
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
}

export const TEMPLATE_REGISTRY: Record<DocumentType, TemplateRegistryEntry> = {
  QUOTATION: {
    type: "QUOTATION",
    templateDir: "QUOTATION",
    prefix: DOCUMENT_PREFIX.QUOTATION,
    style: "modern",
    entityType: "quote",
    loaderMethod: "loadForQuotation",
    phase: 1
  },
  PROPOSAL: {
    type: "PROPOSAL",
    templateDir: "PROPOSAL",
    prefix: DOCUMENT_PREFIX.PROPOSAL,
    style: "modern",
    entityType: "project",
    loaderMethod: "loadForProposal",
    phase: 2
  },
  SURVEY_REPORT: {
    type: "SURVEY_REPORT",
    templateDir: "SURVEY_REPORT",
    prefix: DOCUMENT_PREFIX.SURVEY_REPORT,
    style: "modern",
    entityType: "project",
    loaderMethod: "loadForSurveyReport",
    phase: 3
  },
  CONTRACT: {
    type: "CONTRACT",
    templateDir: "CONTRACT",
    prefix: DOCUMENT_PREFIX.CONTRACT,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForContract",
    phase: 4
  },
  CONTRACT_ADDENDUM: {
    type: "CONTRACT_ADDENDUM",
    templateDir: "CONTRACT_ADDENDUM",
    prefix: DOCUMENT_PREFIX.CONTRACT_ADDENDUM,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForContractAddendum",
    phase: 5
  },
  NDA: {
    type: "NDA",
    templateDir: "NDA",
    prefix: DOCUMENT_PREFIX.NDA,
    style: "classic",
    entityType: "customer",
    loaderMethod: "loadForNda",
    phase: 6
  },
  DELIVERY_NOTE: {
    type: "DELIVERY_NOTE",
    templateDir: "DELIVERY_NOTE",
    prefix: DOCUMENT_PREFIX.DELIVERY_NOTE,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForDeliveryNote",
    phase: 7
  },
  DOC_HANDOVER: {
    type: "DOC_HANDOVER",
    templateDir: "DOC_HANDOVER",
    prefix: DOCUMENT_PREFIX.DOC_HANDOVER,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForDocHandover",
    phase: 8
  },
  INSTALLATION_REPORT: {
    type: "INSTALLATION_REPORT",
    templateDir: "INSTALLATION_REPORT",
    prefix: DOCUMENT_PREFIX.INSTALLATION_REPORT,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForInstallationReport",
    phase: 9
  },
  ACCEPTANCE_REPORT: {
    type: "ACCEPTANCE_REPORT",
    templateDir: "ACCEPTANCE_REPORT",
    prefix: DOCUMENT_PREFIX.ACCEPTANCE_REPORT,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForAcceptanceReport",
    phase: 10
  },
  PARTIAL_ACCEPTANCE: {
    type: "PARTIAL_ACCEPTANCE",
    templateDir: "PARTIAL_ACCEPTANCE",
    prefix: DOCUMENT_PREFIX.PARTIAL_ACCEPTANCE,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForPartialAcceptance",
    phase: 11
  },
  WARRANTY_CERT: {
    type: "WARRANTY_CERT",
    templateDir: "WARRANTY_CERT",
    prefix: DOCUMENT_PREFIX.WARRANTY_CERT,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForWarrantyCert",
    phase: 12
  },
  MAINTENANCE_RECORD: {
    type: "MAINTENANCE_RECORD",
    templateDir: "MAINTENANCE_RECORD",
    prefix: DOCUMENT_PREFIX.MAINTENANCE_RECORD,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForMaintenanceRecord",
    phase: 13
  },
  PAYMENT_REQUEST: {
    type: "PAYMENT_REQUEST",
    templateDir: "PAYMENT_REQUEST",
    prefix: DOCUMENT_PREFIX.PAYMENT_REQUEST,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForPaymentRequest",
    phase: 14
  },
  PAYMENT_RECEIPT: {
    type: "PAYMENT_RECEIPT",
    templateDir: "PAYMENT_RECEIPT",
    prefix: DOCUMENT_PREFIX.PAYMENT_RECEIPT,
    style: "classic",
    entityType: "contract",
    loaderMethod: "loadForPaymentReceipt",
    phase: 15
  },
  AR_RECONCILIATION: {
    type: "AR_RECONCILIATION",
    templateDir: "AR_RECONCILIATION",
    prefix: DOCUMENT_PREFIX.AR_RECONCILIATION,
    style: "classic",
    entityType: "customer",
    loaderMethod: "loadForArReconciliation",
    phase: 16
  }
};

export function getTemplateEntry(type: DocumentType): TemplateRegistryEntry {
  const entry = TEMPLATE_REGISTRY[type];
  if (!entry) {
    throw new Error(`Không tìm thấy template cho loại tài liệu ${type}`);
  }
  return entry;
}
