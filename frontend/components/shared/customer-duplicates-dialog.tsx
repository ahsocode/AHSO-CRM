"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CustomerDuplicateGroup,
  CustomerDuplicateRecord,
  useDuplicateCustomers,
  useMergeCustomers
} from "@/hooks/use-customers";

const STATUS_LABELS: Record<string, string> = {
  LEAD: "Tiềm năng",
  PROSPECT: "Đang tiếp cận",
  ACTIVE: "Đang hợp tác",
  INACTIVE: "Ngừng hợp tác"
};

function RecordCard({
  customer,
  isPrimary,
  onSelectPrimary
}: {
  customer: CustomerDuplicateRecord;
  isPrimary: boolean;
  onSelectPrimary: () => void;
}) {
  return (
    <div
      className={cn(
        "flex-1 min-w-[240px] rounded-2xl border p-4 transition-all cursor-pointer",
        isPrimary
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border/60 bg-white/80 hover:border-primary/40"
      )}
      onClick={onSelectPrimary}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-text-primary truncate">{customer.name}</p>
          {customer.taxCode ? (
            <p className="text-xs text-text-secondary mt-0.5">MST: {customer.taxCode}</p>
          ) : null}
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="radio"
            checked={isPrimary}
            onChange={onSelectPrimary}
            className="accent-primary"
          />
          <span className="text-xs font-semibold text-primary">Giữ</span>
        </label>
      </div>

      <div className="mt-3 space-y-1 text-xs text-text-secondary">
        {customer.phone ? <p>📞 {customer.phone}</p> : null}
        {customer.email ? <p>✉ {customer.email}</p> : null}
        {customer.address ? <p className="truncate">📍 {customer.address}</p> : null}
        {customer.industry ? <p>🏭 {customer.industry}</p> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full bg-bg-hover px-2 py-0.5 text-text-secondary">
          {STATUS_LABELS[customer.status] ?? customer.status}
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
          {customer._count.projects} dự án
        </span>
        <span className="rounded-full bg-bg-hover px-2 py-0.5 text-text-secondary">
          {customer._count.contacts} liên hệ
        </span>
        <span className="rounded-full bg-bg-hover px-2 py-0.5 text-text-secondary">
          {customer._count.activities} hoạt động
        </span>
      </div>

      <p className="mt-2 text-[11px] text-text-muted">
        Tạo: {formatDate(customer.createdAt)} · {customer.assignedTo.name}
      </p>
    </div>
  );
}

function DuplicateGroupCard({
  group,
  index,
  onMerged
}: {
  group: CustomerDuplicateGroup;
  index: number;
  onMerged: () => void;
}) {
  const [primaryId, setPrimaryId] = useState(group.customers[0].id);
  const [merged, setMerged] = useState(false);
  const mergeMutation = useMergeCustomers();

  if (merged) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success-bg/40 px-5 py-4">
        <p className="text-sm font-semibold text-success">✓ Đã gộp nhóm {index + 1}</p>
      </div>
    );
  }

  const primary = group.customers.find((c) => c.id === primaryId) ?? group.customers[0];
  const duplicates = group.customers.filter((c) => c.id !== primaryId);

  const handleMerge = async () => {
    try {
      await mergeMutation.mutateAsync({
        primaryId,
        duplicateIds: duplicates.map((c) => c.id)
      });
      setMerged(true);
      onMerged();
    } catch {
      // error shown inline
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-white/70 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
            Nhóm {index + 1}
          </p>
          <p className="font-semibold text-text-primary">{group.customers.length} bản ghi trùng tên</p>
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={mergeMutation.isPending}
          onClick={handleMerge}
        >
          {mergeMutation.isPending ? "Đang gộp..." : `Gộp ${duplicates.length} bản trùng`}
        </Button>
      </div>

      <p className="text-xs text-text-secondary">
        Chọn bản ghi <strong>Giữ</strong> (primary). Tất cả dự án, liên hệ, hoạt động của các bản còn lại sẽ được
        chuyển vào đây. Các bản trùng sẽ bị xoá mềm.
      </p>

      <div className="flex flex-wrap gap-3">
        {group.customers.map((customer) => (
          <RecordCard
            key={customer.id}
            customer={customer}
            isPrimary={customer.id === primaryId}
            onSelectPrimary={() => setPrimaryId(customer.id)}
          />
        ))}
      </div>

      {mergeMutation.error ? (
        <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">
          {getApiErrorMessage(mergeMutation.error, "Không thể gộp bản ghi.")}
        </div>
      ) : null}
    </div>
  );
}

export function CustomerDuplicatesDialog({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mergedCount, setMergedCount] = useState(0);
  const duplicatesQuery = useDuplicateCustomers();

  if (!open) return null;

  const groups = duplicatesQuery.data ?? [];
  const totalDuplicateRecords = groups.reduce((sum, g) => sum + g.customers.length - 1, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-bg-card shadow-xl">
        <div className="flex items-start justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Xử lý khách hàng trùng lặp</h2>
            {duplicatesQuery.isSuccess ? (
              <p className="mt-1 text-sm text-text-secondary">
                {groups.length === 0
                  ? "Không tìm thấy bản ghi trùng lặp."
                  : `${groups.length} nhóm trùng lặp · ${totalDuplicateRecords} bản ghi cần gộp`}
                {mergedCount > 0 ? ` · Đã xử lý ${mergedCount} nhóm` : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {duplicatesQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <LoadingSkeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : duplicatesQuery.isError ? (
            <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">
              {getApiErrorMessage(duplicatesQuery.error, "Không thể tải danh sách trùng lặp.")}
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-bg-hover/30 py-16 text-center">
              <p className="text-lg font-semibold text-text-primary">Không có bản ghi trùng lặp</p>
              <p className="mt-2 text-sm text-text-secondary">
                Hệ thống phát hiện trùng lặp theo tên khách hàng (không phân biệt hoa/thường, bỏ dấu).
              </p>
            </div>
          ) : (
            groups.map((group, index) => (
              <DuplicateGroupCard
                key={group.customers.map((c) => c.id).join("-")}
                group={group}
                index={index}
                onMerged={() => setMergedCount((n) => n + 1)}
              />
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/60 bg-bg-hover/30 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}
