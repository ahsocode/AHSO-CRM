import type { ComponentProps } from "react";
import type { AppIcon } from "@/components/shared/app-icon";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import type {
  BusinessDocumentSource,
  BusinessDocumentStatus,
  BusinessDocumentType,
  ContractStatus,
  DocumentTemplateType,
  MilestoneStatus,
  Priority,
  ProjectStatus,
  SurveyNoteType
} from "@/lib/types";

export type Project360Tab =
  | "overview"
  | "timeline"
  | "surveys"
  | "documents"
  | "quotes"
  | "contracts"
  | "delivery"
  | "payments"
  | "handover"
  | "materials";

export type AppIconName = ComponentProps<typeof AppIcon>["name"];

export const TABS: Array<{ key: Project360Tab; label: string; icon: AppIconName }> = [
  { key: "overview", label: "Tổng quan", icon: "dashboard" },
  { key: "timeline", label: "Timeline", icon: "activity" },
  { key: "surveys", label: "Khảo sát", icon: "calendar" },
  { key: "documents", label: "Tài liệu", icon: "description" },
  { key: "quotes", label: "Báo giá", icon: "description" },
  { key: "contracts", label: "Hợp đồng", icon: "contract" },
  { key: "delivery", label: "Triển khai", icon: "briefcase" },
  { key: "payments", label: "Thanh toán", icon: "analytics" },
  { key: "materials", label: "Vật tư", icon: "factory" },
  { key: "handover", label: "Ghi chú / Quyết định", icon: "history" }
];
export const TAB_KEYS = TABS.map((tab) => tab.key);

export const PRIORITY_CONFIG: Record<Priority, { label: string; variant: "neutral" | "info" | "warning" }> = {
  LOW: { label: "Ưu tiên thấp", variant: "neutral" },
  NORMAL: { label: "Ưu tiên chuẩn", variant: "info" },
  HIGH: { label: "Ưu tiên cao", variant: "warning" }
};

export const CONTRACT_STATUS_CONFIG: Record<
  ContractStatus,
  {
    label: string;
    variant: "info" | "warning" | "success" | "danger";
  }
> = {
  ACTIVE: { label: "Hiệu lực", variant: "info" },
  SUSPENDED: { label: "Tạm dừng", variant: "warning" },
  COMPLETED: { label: "Hoàn tất", variant: "success" },
  CANCELLED: { label: "Hủy", variant: "danger" }
};

export const MILESTONE_STATUS_CONFIG: Record<
  MilestoneStatus,
  {
    label: string;
    variant: "neutral" | "info" | "success" | "warning";
  }
> = {
  PENDING: { label: "Chờ xử lý", variant: "neutral" },
  IN_PROGRESS: { label: "Đang làm", variant: "info" },
  DONE: { label: "Đã xong", variant: "success" },
  ACCEPTED: { label: "Đã nghiệm thu", variant: "warning" }
};

export const DOCUMENT_TYPE_LABELS: Record<BusinessDocumentType, string> = {
  RFQ: "Yêu cầu báo giá",
  CUSTOMER_PO: "PO khách hàng",
  QUOTATION: "Báo giá",
  SIGNED_QUOTATION: "Báo giá đã ký",
  PROPOSAL: "Đề xuất",
  CONTRACT: "Hợp đồng",
  SIGNED_CONTRACT: "Hợp đồng đã ký",
  CONTRACT_ADDENDUM: "Phụ lục hợp đồng",
  NDA: "NDA",
  DELIVERY_NOTE: "Phiếu giao hàng",
  DOC_HANDOVER: "Bàn giao hồ sơ",
  INSTALLATION_REPORT: "Biên bản lắp đặt",
  ACCEPTANCE_REPORT: "Biên bản nghiệm thu",
  PARTIAL_ACCEPTANCE: "Nghiệm thu từng phần",
  WARRANTY_CERT: "Chứng nhận bảo hành",
  MAINTENANCE_RECORD: "Biên bản bảo trì",
  PAYMENT_REQUEST: "Đề nghị thanh toán",
  PAYMENT_RECEIPT: "Phiếu thu",
  INVOICE: "Hóa đơn",
  AR_RECONCILIATION: "Đối soát công nợ",
  OTHER: "Tài liệu khác"
};

export const DOCUMENT_STATUS_LABELS: Record<BusinessDocumentStatus, string> = {
  DRAFT: "Bản nháp",
  ISSUED: "Đã phát hành",
  RECEIVED: "Đã nhận",
  SIGNED: "Đã ký",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Bị từ chối",
  SUPERSEDED: "Đã thay thế",
  CANCELLED: "Đã hủy",
  ARCHIVED: "Lưu trữ"
};

export const DOCUMENT_SOURCE_LABELS: Record<BusinessDocumentSource, string> = {
  GENERATED: "Hệ thống sinh",
  UPLOADED: "Upload nội bộ",
  RECEIVED: "Khách gửi",
  SIGNED_UPLOAD: "Bản ký upload"
};

export const GENERATED_DOCUMENT_LABELS: Partial<Record<DocumentTemplateType, string>> = {
  QUOTATION: "Báo giá",
  PROPOSAL: "Đề xuất dự án",
  SURVEY_REPORT: "Báo cáo khảo sát",
  CONTRACT: "Hợp đồng kinh tế",
  CONTRACT_ADDENDUM: "Phụ lục hợp đồng",
  NDA: "Thỏa thuận bảo mật",
  DELIVERY_NOTE: "Biên bản giao hàng",
  DOC_HANDOVER: "Biên bản bàn giao hồ sơ",
  INSTALLATION_REPORT: "Biên bản lắp đặt",
  ACCEPTANCE_REPORT: "Biên bản nghiệm thu",
  PARTIAL_ACCEPTANCE: "Biên bản nghiệm thu giai đoạn",
  WARRANTY_CERT: "Phiếu bảo hành",
  MAINTENANCE_RECORD: "Biên bản bảo trì",
  PAYMENT_REQUEST: "Đề nghị thanh toán",
  PAYMENT_RECEIPT: "Phiếu thu",
  AR_RECONCILIATION: "Biên bản đối chiếu công nợ"
};

export const PROJECT_GENERATED_DOCUMENTS: Array<{
  type: DocumentTemplateType;
  label: string;
  entity: "quote" | "project" | "contract" | "customer";
}> = [
  { type: "QUOTATION", label: "Báo giá", entity: "quote" },
  { type: "PROPOSAL", label: "Đề xuất dự án", entity: "project" },
  { type: "SURVEY_REPORT", label: "Báo cáo khảo sát", entity: "project" },
  { type: "CONTRACT", label: "Hợp đồng kinh tế", entity: "contract" },
  { type: "CONTRACT_ADDENDUM", label: "Phụ lục hợp đồng", entity: "contract" },
  { type: "NDA", label: "Thỏa thuận bảo mật", entity: "customer" },
  { type: "DELIVERY_NOTE", label: "Biên bản giao hàng", entity: "contract" },
  { type: "DOC_HANDOVER", label: "Biên bản bàn giao hồ sơ", entity: "contract" },
  { type: "INSTALLATION_REPORT", label: "Biên bản lắp đặt", entity: "contract" },
  { type: "ACCEPTANCE_REPORT", label: "Biên bản nghiệm thu", entity: "contract" },
  { type: "PARTIAL_ACCEPTANCE", label: "Biên bản nghiệm thu giai đoạn", entity: "contract" },
  { type: "WARRANTY_CERT", label: "Phiếu bảo hành", entity: "contract" },
  { type: "MAINTENANCE_RECORD", label: "Biên bản bảo trì", entity: "contract" },
  { type: "PAYMENT_REQUEST", label: "Đề nghị thanh toán", entity: "contract" },
  { type: "PAYMENT_RECEIPT", label: "Phiếu thu", entity: "contract" },
  { type: "AR_RECONCILIATION", label: "Biên bản đối chiếu công nợ", entity: "customer" }
];

export const DOCUMENT_GROUPS: Array<{
  label: string;
  types: DocumentTemplateType[];
}> = [
  {
    label: "Trước ký hợp đồng",
    types: ["SURVEY_REPORT", "PROPOSAL", "QUOTATION", "CONTRACT", "CONTRACT_ADDENDUM", "NDA"]
  },
  {
    label: "Triển khai",
    types: ["DELIVERY_NOTE", "DOC_HANDOVER", "INSTALLATION_REPORT"]
  },
  {
    label: "Nghiệm thu",
    types: ["ACCEPTANCE_REPORT", "PARTIAL_ACCEPTANCE", "WARRANTY_CERT", "MAINTENANCE_RECORD"]
  },
  {
    label: "Tài chính",
    types: ["PAYMENT_REQUEST", "PAYMENT_RECEIPT", "AR_RECONCILIATION"]
  }
];

export const DOCUMENT_PRESETS: Array<{
  label: string;
  description: string;
  types: DocumentTemplateType[];
}> = [
  {
    label: "Dự án có hợp đồng",
    description: "Khảo sát → Báo giá → HĐ → Lắp đặt → Nghiệm thu → Bảo hành → Thu tiền",
    types: [
      "SURVEY_REPORT", "QUOTATION", "CONTRACT",
      "INSTALLATION_REPORT", "DELIVERY_NOTE",
      "ACCEPTANCE_REPORT", "WARRANTY_CERT",
      "PAYMENT_REQUEST", "PAYMENT_RECEIPT"
    ]
  },
  {
    label: "Dự án nhỏ / không HĐ",
    description: "Khảo sát → Báo giá → Nghiệm thu → Thu tiền",
    types: ["SURVEY_REPORT", "QUOTATION", "ACCEPTANCE_REPORT", "PAYMENT_RECEIPT"]
  },
  {
    label: "Bảo trì định kỳ",
    description: "Biên bản bảo trì + thanh toán dịch vụ",
    types: ["MAINTENANCE_RECORD", "PAYMENT_REQUEST", "PAYMENT_RECEIPT"]
  }
];

export const SURVEY_NOTE_LABELS: Record<SurveyNoteType, string> = {
  GENERAL: "Ghi chú chung",
  TECHNICAL_REQUIREMENT: "Yêu cầu kỹ thuật",
  COMMERCIAL_REQUIREMENT: "Yêu cầu thương mại",
  SITE_CONSTRAINT: "Ràng buộc hiện trường",
  RISK: "Rủi ro",
  DECISION: "Quyết định",
  OPEN_QUESTION: "Câu hỏi mở"
};

export const TIMELINE_TYPE_LABELS: Record<string, string> = {
  activity: "Hoạt động",
  survey: "Khảo sát",
  quote: "Báo giá",
  contract: "Hợp đồng",
  document: "Tài liệu",
  milestone: "Milestone",
  payment: "Thanh toán",
  handover: "Bàn giao"
};

export const BUSINESS_DOCUMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const SURVEY_MEDIA_MAX_FILE_SIZE = 50 * 1024 * 1024;
export const BUSINESS_DOCUMENT_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".docx"];
export const SURVEY_MEDIA_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".mp4",
  ".mov",
  ".webm",
  ".pdf",
  ".docx",
  ".xlsx"
];
export const PROJECT_STAGE_ORDER = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "DELIVERING", "COMPLETED"] as const;

export function getPriorityConfig(priority: Priority) {
  return PRIORITY_CONFIG[priority] ?? { label: String(priority), variant: "neutral" as const };
}

export function getMilestoneStatusConfig(status: MilestoneStatus) {
  return MILESTONE_STATUS_CONFIG[status] ?? { label: String(status), variant: "neutral" as const };
}

export function getContractStatusConfig(status: ContractStatus) {
  return CONTRACT_STATUS_CONFIG[status] ?? { label: String(status), variant: "neutral" as const };
}

export function getProjectStatusLabel(status: ProjectStatus) {
  return PROJECT_STATUS_LABELS[status] ?? String(status);
}

export function resolveProject360Tab(value: string | null): Project360Tab {
  return TAB_KEYS.includes(value as Project360Tab) ? (value as Project360Tab) : "overview";
}

export function timelineIcon(type: string): AppIconName {
  switch (type) {
    case "survey":
      return "calendar";
    case "quote":
      return "description";
    case "contract":
      return "contract";
    case "document":
      return "description";
    case "payment":
      return "analytics";
    case "handover":
      return "history";
    default:
      return "activity";
  }
}
