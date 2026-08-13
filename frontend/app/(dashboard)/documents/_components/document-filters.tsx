"use client";

import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Select } from "@/components/ui/select";
import { BusinessDocumentStatus, BusinessDocumentType } from "@/lib/types";

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

const DOCUMENT_STATUS_LABELS: Record<BusinessDocumentStatus, string> = {
  DRAFT: "Nháp",
  ISSUED: "Đã phát hành",
  RECEIVED: "Đã nhận",
  SIGNED: "Đã ký",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Từ chối",
  SUPERSEDED: "Đã thay thế",
  CANCELLED: "Đã hủy",
  ARCHIVED: "Lưu trữ"
};

export function DocumentFilters({
  search,
  type,
  status,
  canReset,
  onSearchChange,
  onTypeChange,
  onStatusChange,
  onReset
}: {
  search: string;
  type: BusinessDocumentType | "";
  status: BusinessDocumentStatus | "";
  canReset: boolean;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: BusinessDocumentType | "") => void;
  onStatusChange: (value: BusinessDocumentStatus | "") => void;
  onReset: () => void;
}) {
  return (
    <CompactFilterToolbar
      canReset={canReset}
      onReset={onReset}
      onSearchChange={onSearchChange}
      searchAriaLabel="Tìm kiếm tài liệu"
      searchId="doc-search"
      searchPlaceholder="Tên, số hiệu tài liệu..."
      searchValue={search}
    >
      <label className="w-[150px]" htmlFor="doc-type">
        <span className="sr-only">Loại tài liệu</span>
        <Select
          id="doc-type"
          value={type}
          onChange={(event) => onTypeChange(event.target.value as BusinessDocumentType | "")}
          className="h-9 rounded-lg bg-white text-[12.5px]"
        >
          <option value="">Loại</option>
          {(Object.entries(DOCUMENT_TYPE_LABELS) as [BusinessDocumentType, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </label>

      <label className="w-[128px]" htmlFor="doc-status">
        <span className="sr-only">Trạng thái</span>
        <Select
          id="doc-status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as BusinessDocumentStatus | "")}
          className="h-9 rounded-lg bg-white text-[12.5px]"
        >
          <option value="">Trạng thái</option>
          {(Object.entries(DOCUMENT_STATUS_LABELS) as [BusinessDocumentStatus, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </label>
    </CompactFilterToolbar>
  );
}
