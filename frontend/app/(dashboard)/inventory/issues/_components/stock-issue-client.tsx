"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useStockIssues } from "@/hooks/use-stock-issues";
import { useWarehousesSelect } from "@/hooks/use-warehouses";
import { useProjects } from "@/hooks/use-projects";
import { PageHeader } from "@/components/layout/page-header";
import { getApiErrorMessage } from "@/lib/api-client";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { StockDocStatus } from "@/lib/types";
import { STOCK_DOC_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { StockIssueTable } from "./stock-issue-table";

const PAGE_SIZE = 10;

export function StockIssueClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StockDocStatus | "">("");
  const [warehouseId, setWarehouseId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const warehousesSelect = useWarehousesSelect();
  const projectsQuery = useProjects({ page: 1, limit: 100 });

  const query = useStockIssues({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    status: status || undefined,
    warehouseId: warehouseId || undefined,
    projectId: projectId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Phiếu xuất kho"
        description="Quản lý toàn bộ phiếu xuất kho, theo dõi trạng thái và vật tư cấp cho dự án."
        action={
          <Link href={"/inventory/issues/new" as Route} className={cn(buttonVariants({ variant: "primary" }))}>
            Tạo phiếu xuất kho
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Tìm số phiếu..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-52"
        />
        <Select
          value={warehouseId}
          onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
          className="w-44"
        >
          <option value="">Tất cả kho</option>
          {(warehousesSelect.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </Select>
        <Select
          value={projectId}
          onChange={(e) => { setProjectId(e.target.value); setPage(1); }}
          className="w-48"
        >
          <option value="">Tất cả dự án</option>
          {(projectsQuery.data?.items ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => { setStatus(e.target.value as StockDocStatus | ""); setPage(1); }}
          className="w-44"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STOCK_DOC_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="w-40"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="w-40"
        />
      </div>

      <StockIssueTable
        items={query.data?.items ?? []}
        meta={query.data?.meta}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getApiErrorMessage(query.error, "Không thể tải danh sách phiếu xuất kho.")}
        onPageChange={setPage}
      />
    </div>
  );
}
