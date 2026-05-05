"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useBulkQuotes, useQuotes } from "@/hooks/use-quotes";
import { PageHeader } from "@/components/layout/page-header";
import { useProjects } from "@/hooks/use-projects";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { QuoteStatus } from "@/lib/types";
import { cn, downloadExcelRows } from "@/lib/utils";
import { QuoteFilters } from "./quote-filters";
import { QuoteOverviewCards } from "./quote-overview-cards";
import { QuoteTable } from "./quote-table";

const PAGE_SIZE = 8;
const BULK_QUOTE_STATUSES: QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];

export function QuotesClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "">("");
  const [projectId, setProjectId] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"status" | "send">("status");
  const [bulkStatus, setBulkStatus] = useState<QuoteStatus>("SENT");
  const deferredSearch = useDeferredValue(search.trim());
  const bulkQuotes = useBulkQuotes();
  const { error: showError, success } = useToast();

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, projectId, status]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, deferredSearch, projectId, status]);

  const projectsQuery = useProjects({
    page: 1,
    limit: 100
  });
  const quotesQuery = useQuotes({
    page,
    limit: PAGE_SIZE,
    search: deferredSearch || undefined,
    status: status || undefined,
    projectId: projectId || undefined
  });

  const canReset = search.length > 0 || status.length > 0 || projectId.length > 0;
  const visibleIds = quotesQuery.data?.items.map((quote) => quote.id) ?? [];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Báo giá"
        description="Quote board nối dữ liệu thật để đội sales theo dõi toàn bộ báo giá, trạng thái gửi/chốt và cửa sổ hết hạn trên một màn hình."
        action={
          <Link href="/quotes/new" className={cn(buttonVariants({ variant: "primary" }))}>
            Tạo báo giá
          </Link>
        }
      />

      <QuoteOverviewCards meta={quotesQuery.data?.meta} isLoading={quotesQuery.isLoading} />

      <QuoteFilters
        canReset={canReset}
        onProjectIdChange={setProjectId}
        onReset={() => {
          setSearch("");
          setStatus("");
          setProjectId("");
          setPage(1);
        }}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        projectId={projectId}
        projects={projectsQuery.data?.items ?? []}
        projectsUnavailable={projectsQuery.isError}
        search={search}
        status={status}
      />

      {selectedIds.length > 0 ? (
        <BulkActionsBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
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
                  onSuccess: () => {
                    setSelectedIds([]);
                    success(`Đã xử lý ${selectedIds.length} báo giá.`);
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
                      showError("Không có dữ liệu để export.");
                      return;
                    }
                    const csv = buildCsv(Object.keys(items[0]), items);
                    downloadCsv("quotes-selected.csv", csv);
                    await downloadExcelRows("quotes-selected.xlsx", items);
                    success("Đã xuất danh sách báo giá đã chọn.");
                  },
                  onError: (error) => {
                    showError(error instanceof Error ? error.message : "Không thể export dữ liệu.");
                  }
                }
              );
            }}
          >
            Export CSV + Excel
          </Button>
        </BulkActionsBar>
      ) : null}

      <QuoteTable
        allVisibleSelected={allVisibleSelected}
        errorMessage={getApiErrorMessage(quotesQuery.error, "Không thể tải danh sách báo giá.")}
        isError={quotesQuery.isError}
        isLoading={quotesQuery.isLoading}
        items={quotesQuery.data?.items ?? []}
        meta={quotesQuery.data?.meta}
        onPageChange={setPage}
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
