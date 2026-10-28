"use client";
import type { Route } from "next";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { usePermission } from "@/components/shared/permission-gate";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useBulkQuotes, useDownloadQuotePdf, useDuplicateQuote, useQuotes } from "@/hooks/use-quotes";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { PageHeader } from "@/components/layout/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { QuoteStatus } from "@/lib/types";
import {
  activeKpi,
  EXPIRING_WITHIN_DAYS,
  kpiToFilters,
  MAX_BULK_DUPLICATE,
  parseQuotePageSize,
  partitionDeletable,
  QuoteKpiKey,
  runSequential
} from "@/lib/quote-list";
import { cn, downloadBlob, downloadExcelRows } from "@/lib/utils";
import { QuoteFilters } from "./quote-filters";
import { QuoteOverviewCards } from "./quote-overview-cards";
import { QuoteTable } from "./quote-table";

const BULK_QUOTE_STATUSES: QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];

export function QuotesClient() {
  const [search, setSearch] = useState("");
  // Bộ lọc ghi nhớ qua localStorage; ô tìm kiếm cố ý không ghi nhớ.
  const [status, setStatus] = usePersistentState<QuoteStatus | "">("crm:filters:quotes:status", "");
  const [projectId, setProjectId] = usePersistentState("crm:filters:quotes:projectId", "");
  const [expiring, setExpiring] = usePersistentState("crm:filters:quotes:expiring", false);
  const [page, setPage] = useState(1);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageSize = parseQuotePageSize(searchParams.get("pageSize"));
  const queryClient = useQueryClient();
  const canDuplicate = usePermission("quotes.create");
  const canDelete = usePermission("quotes.delete");
  const canViewPdf = usePermission("quotes.view");
  const duplicateQuote = useDuplicateQuote();
  const downloadPdf = useDownloadQuotePdf();
  const [progress, setProgress] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"status" | "send">("status");
  const [bulkStatus, setBulkStatus] = useState<QuoteStatus>("SENT");
  const deferredSearch = useDeferredValue(search.trim());
  const bulkQuotes = useBulkQuotes();
  const { error: showError, success } = useToast();

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, projectId, status, expiring, pageSize]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, deferredSearch, projectId, status, expiring, pageSize]);

  const handlePageSizeChange = useCallback(
    (size: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("pageSize", String(size));
      router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleKpiSelect = (key: QuoteKpiKey) => {
    const next = kpiToFilters(key);
    setStatus(next.status);
    setExpiring(next.expiring);
  };

  const quotesQuery = useQuotes({
    page,
    limit: pageSize,
    expiringWithinDays: expiring ? EXPIRING_WITHIN_DAYS : undefined,
    search: deferredSearch || undefined,
    status: status || undefined,
    projectId: projectId || undefined
  });

  const canReset = search.length > 0 || status.length > 0 || projectId.length > 0 || expiring;
  const items = quotesQuery.data?.items ?? [];
  const visibleIds = items.map((quote) => quote.id);
  const selectedQuotes = items.filter((quote) => selectedIds.includes(quote.id));
  const busy = progress !== null;
  const refreshAfterMutation = async () => {
    await Promise.all(
      ["quotes", "projects", "dashboard", "reports"].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
    );
  };

  const handleDuplicate = async () => {
    const targets = selectedQuotes.slice(0, MAX_BULK_DUPLICATE);
    setProgress(`Nhân bản 0/${targets.length}`);
    const result = await runSequential(
      targets,
      (quote) => duplicateQuote.mutateAsync(quote.id),
      (done, total) => setProgress(`Nhân bản ${done}/${total}`)
    );
    setProgress(null);
    setSelectedIds([]);
    const message = `Đã nhân bản ${result.ok.length}/${targets.length} báo giá.`;
    if (result.failed.length > 0) {
      showError(
        `${message} Lỗi: ${result.failed.map((f) => `${f.item.quoteNo} (${f.message})`).join("; ")}`
      );
    } else {
      success(message);
    }
  };

  const handleSinglePdf = async () => {
    const quote = selectedQuotes[0];
    if (!quote) return;
    try {
      const file = await downloadPdf.mutateAsync(quote.id);
      downloadBlob(file.blob, file.filename);
    } catch (error) {
      showError(getApiErrorMessage(error, "Không thể xuất PDF."));
    }
  };

  const { deletable, skipped } = partitionDeletable(selectedQuotes);

  const handleDelete = async () => {
    setDeleteOpen(false);
    setProgress(`Xoá 0/${deletable.length}`);
    const result = await runSequential(
      deletable,
      (quote) => apiClient.delete(`/quotes/${quote.id}`),
      (done, total) => setProgress(`Xoá ${done}/${total}`)
    );
    setProgress(null);
    setSelectedIds([]);
    await refreshAfterMutation();
    const parts = [`Đã xoá ${result.ok.length} báo giá`];
    if (skipped.length > 0) {
      parts.push(`bỏ qua ${skipped.length} (chỉ xoá được Bản nháp/Từ chối): ${skipped.map((q) => q.quoteNo).join(", ")}`);
    }
    if (result.failed.length > 0) {
      parts.push(`lỗi ${result.failed.length}: ${result.failed.map((f) => f.item.quoteNo).join(", ")}`);
    }
    (result.failed.length > 0 ? showError : success)(`${parts.join("; ")}.`);
  };
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Báo giá"
        description="Trang này hiển thị toàn bộ báo giá để đội sales theo dõi trạng thái gửi/chốt và thời hạn hiệu lực trên một màn hình."
        action={
          <Link href="/quotes/new" className={cn(buttonVariants({ variant: "primary" }))}>
            Tạo báo giá
          </Link>
        }
      />

      <QuoteOverviewCards
        meta={quotesQuery.data?.meta}
        isLoading={quotesQuery.isLoading}
        active={activeKpi(status, expiring)}
        onSelect={handleKpiSelect}
      />

      {selectedIds.length > 0 ? (
        <div className="sticky top-2 z-20" role="region" aria-label="Thao tác hàng loạt">
        <BulkActionsBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
          {progress ? <span className="text-sm font-medium text-primary" aria-live="polite">{progress}</span> : null}
          {canDuplicate ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy || selectedIds.length > MAX_BULK_DUPLICATE}
              title={selectedIds.length > MAX_BULK_DUPLICATE ? `Chỉ nhân bản tối đa ${MAX_BULK_DUPLICATE} báo giá mỗi lần` : undefined}
              onClick={handleDuplicate}
            >
              Nhân bản
            </Button>
          ) : null}
          {canViewPdf ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy || selectedIds.length !== 1 || downloadPdf.isPending}
              title={selectedIds.length > 1 ? "Chỉ xuất PDF khi chọn một báo giá" : undefined}
              onClick={handleSinglePdf}
            >
              Xuất PDF
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="outline"
              className="text-danger"
              disabled={busy}
              onClick={() => setDeleteOpen(true)}
            >
              Xoá
            </Button>
          ) : null}
          <Select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as "status" | "send")}>
            <option value="status">Đổi trạng thái</option>
            <option value="send">Gửi lại báo giá</option>
          </Select>

          {bulkAction === "status" ? (
            <Select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as QuoteStatus)}>
              {BULK_QUOTE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          ) : null}

          <Button
            type="button"
            variant="outline"
            disabled={bulkQuotes.isPending}
            onClick={() => {
              bulkQuotes.mutate(
                {
                  action: bulkAction,
                  ids: selectedIds,
                  status: bulkAction === "status" ? bulkStatus : undefined
                },
                {
                  onSuccess: (data) => {
                    setSelectedIds([]);
                    const processedCount = data.processedCount ?? 0;
                    const failedCount = data.failedCount ?? 0;

                    if (failedCount > 0) {
                      showError(
                        `Đã xử lý ${processedCount} báo giá, ${failedCount} báo giá lỗi. ${data.errors?.[0]?.message ?? ""}`.trim()
                      );
                      return;
                    }
                    success(`Đã xử lý ${processedCount || selectedIds.length} báo giá.`);
                  },
                  onError: (error) => {
                    showError(error instanceof Error ? error.message : "Không thể thực hiện bulk action.");
                  }
                }
              );
            }}
          >
            Áp dụng
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={bulkQuotes.isPending}
            onClick={() => {
              bulkQuotes.mutate(
                {
                  action: "export",
                  ids: selectedIds
                },
                {
                  onSuccess: async (data) => {
                    const items = data.items ?? [];
                    if (!items.length) {
                      showError("Không có dữ liệu để xuất.");
                      return;
                    }
                    const csv = buildCsv(Object.keys(items[0]), items);
                    downloadCsv("quotes-selected.csv", csv);
                    await downloadExcelRows("quotes-selected.xlsx", items);
                    success("Đã xuất danh sách báo giá đã chọn.");
                  },
                  onError: (error) => {
                    showError(error instanceof Error ? error.message : "Không thể xuất dữ liệu.");
                  }
                }
              );
            }}
          >
            Xuất CSV + Excel
          </Button>
        </BulkActionsBar>
        </div>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Xác nhận xoá báo giá</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Sẽ xoá {deletable.length} báo giá (có thể khôi phục từ dữ liệu): {deletable.map((q) => q.quoteNo).join(", ") || "—"}.
              </p>
              {skipped.length > 0 ? (
                <p>
                  Bỏ qua {skipped.length} báo giá không ở trạng thái Bản nháp/Từ chối:{" "}
                  {skipped.map((q) => q.quoteNo).join(", ")}.
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletable.length === 0}
              onClick={handleDelete}
              className="bg-danger hover:bg-danger"
            >
              Xoá {deletable.length} báo giá
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <QuoteTable
        allVisibleSelected={allVisibleSelected}
        errorMessage={getApiErrorMessage(quotesQuery.error, "Không thể tải danh sách báo giá.")}
        isError={quotesQuery.isError}
        isLoading={quotesQuery.isLoading}
        items={quotesQuery.data?.items ?? []}
        meta={quotesQuery.data?.meta}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={handlePageSizeChange}
        toolbar={
          <QuoteFilters
            canReset={canReset}
            onProjectIdChange={setProjectId}
            onReset={() => {
              setSearch("");
              setStatus("");
              setExpiring(false);
              setProjectId("");
              setPage(1);
            }}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            projectId={projectId}
            search={search}
            status={status}
          />
        }
        onToggleSelect={(id) =>
          setSelectedIds((current) =>
            current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
          )
        }
        onToggleSelectAll={() =>
          setSelectedIds((current) =>
            allVisibleSelected
              ? current.filter((id) => !visibleIds.includes(id))
              : [...new Set([...current, ...visibleIds])]
          )
        }
        selectedIds={selectedIds}
      />
    </div>
  );
}
