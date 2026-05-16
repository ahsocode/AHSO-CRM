"use client";

import { Badge } from "@/components/ui/badge";
import { BusinessDocumentType } from "@/lib/types";

const DOCUMENT_TYPE_LABELS: Record<BusinessDocumentType, string> = {
  RFQ: "Yêu cầu báo giá (RFQ)",
  CUSTOMER_PO: "Đơn đặt hàng (PO)",
  QUOTATION: "Báo giá",
  SIGNED_QUOTATION: "Báo giá đã ký",
  PROPOSAL: "Đề xuất / Proposal",
  CONTRACT: "Hợp đồng",
  SIGNED_CONTRACT: "Hợp đồng đã ký",
  CONTRACT_ADDENDUM: "Phụ lục hợp đồng",
  NDA: "Thỏa thuận bảo mật (NDA)",
  DELIVERY_NOTE: "Biên bản bàn giao",
  DOC_HANDOVER: "Bàn giao tài liệu",
  INSTALLATION_REPORT: "Biên bản lắp đặt",
  ACCEPTANCE_REPORT: "Biên bản nghiệm thu",
  PARTIAL_ACCEPTANCE: "Nghiệm thu từng phần",
  WARRANTY_CERT: "Giấy bảo hành",
  MAINTENANCE_RECORD: "Biên bản bảo trì",
  PAYMENT_REQUEST: "Đề nghị thanh toán",
  PAYMENT_RECEIPT: "Biên lai thu tiền",
  INVOICE: "Hóa đơn",
  AR_RECONCILIATION: "Đối soát công nợ",
  OTHER: "Khác"
};

type BadgeVariant = "default" | "neutral" | "info" | "success" | "warning" | "danger";

function getDocumentTypeTone(type: BusinessDocumentType): BadgeVariant {
  if ((["RFQ", "CUSTOMER_PO"] as BusinessDocumentType[]).includes(type)) return "info";
  if ((["CONTRACT", "SIGNED_CONTRACT", "NDA", "CONTRACT_ADDENDUM"] as BusinessDocumentType[]).includes(type))
    return "warning";
  if (
    (["INVOICE", "PAYMENT_REQUEST", "PAYMENT_RECEIPT", "AR_RECONCILIATION"] as BusinessDocumentType[]).includes(type)
  )
    return "success";
  return "neutral";
}

export function DocumentTypeBadge({ type }: { type: BusinessDocumentType }) {
  return <Badge variant={getDocumentTypeTone(type)}>{DOCUMENT_TYPE_LABELS[type]}</Badge>;
}

export { DOCUMENT_TYPE_LABELS };
