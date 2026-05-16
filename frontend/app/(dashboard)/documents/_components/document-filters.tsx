"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="surface-card grid gap-4 border border-white/70 p-5 md:grid-cols-2 xl:grid-cols-[1.5fr_240px_200px_auto]">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="doc-search">
          Tìm kiếm
        </label>
        <Input
          id="doc-search"
          placeholder="Tìm theo tên, số hiệu tài liệu..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="doc-type">
          Loại tài liệu
        </label>
        <Select
          id="doc-type"
          value={type}
          onChange={(event) => onTypeChange(event.target.value as BusinessDocumentType | "")}
        >
          <option value="">Tất cả loại</option>
          {(Object.entries(DOCUMENT_TYPE_LABELS) as [BusinessDocumentType, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="doc-status">
          Trạng thái
        </label>
        <Select
          id="doc-status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as BusinessDocumentStatus | "")}
        >
          <option value="">Tất cả trạng thái</option>
          {(Object.entries(DOCUMENT_STATUS_LABELS) as [BusinessDocumentStatus, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end">
        <Button className="w-full xl:w-auto" disabled={!canReset} onClick={onReset} type="button" variant="outline">
          Xóa bộ lọc
        </Button>
      </div>
    </div>
  );
}
