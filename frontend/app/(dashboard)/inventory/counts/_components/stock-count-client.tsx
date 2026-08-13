"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useStockCounts } from "@/hooks/use-stock-counts";
import { useWarehousesSelect } from "@/hooks/use-warehouses";
import { PageHeader } from "@/components/layout/page-header";
import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { getApiErrorMessage } from "@/lib/api-client";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { StockDocStatus } from "@/lib/types";
import { STOCK_DOC_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { StockCountTable } from "./stock-count-table";

const PAGE_SIZE = 10;

export function StockCountClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StockDocStatus | "">("");
  const [warehouseId, setWarehouseId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const warehousesSelect = useWarehousesSelect();

  const query = useStockCounts({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    status: status || undefined,
    warehouseId: warehouseId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const canReset =
    search.length > 0 || status.length > 0 || warehouseId.length > 0 || dateFrom.length > 0 || dateTo.length > 0;
  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setWarehouseId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Kiểm kê kho"
        description="Quản lý các phiếu kiểm kê tồn kho thực tế và điều chỉnh số liệu."
        action={
          <Link href={"/inventory/counts/new" as Route} className={cn(buttonVariants({ variant: "primary" }))}>
            Tạo phiếu kiểm kê
          </Link>
        }
      />

      <StockCountTable
        items={query.data?.items ?? []}
        meta={query.data?.meta}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getApiErrorMessage(query.error, "Không thể tải danh sách phiếu kiểm kê.")}
        onPageChange={setPage}
        toolbar={
          <CompactFilterToolbar
            canReset={canReset}
            onReset={resetFilters}
            onSearchChange={(value) => { setSearch(value); setPage(1); }}
            searchAriaLabel="Tìm kiếm phiếu kiểm kê"
            searchClassName="min-w-[150px] xl:max-w-[170px]"
            searchPlaceholder="Số phiếu..."
            searchValue={search}
          >
            <Select
              aria-label="Trạng thái"
              value={status}
              onChange={(e) => { setStatus(e.target.value as StockDocStatus | ""); setPage(1); }}
              className="h-9 w-[108px] rounded-lg bg-white text-[12.5px]"
            >
              <option value="">Trạng thái</option>
              {Object.entries(STOCK_DOC_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <Select
              aria-label="Kho"
              value={warehouseId}
              onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
              className="h-9 w-[104px] rounded-lg bg-white text-[12.5px]"
            >
              <option value="">Kho</option>
              {(warehousesSelect.data ?? []).map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
            <Input
              aria-label="Từ ngày"
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="h-9 w-[116px] rounded-lg bg-white text-[12.5px]"
            />
            <Input
              aria-label="Đến ngày"
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="h-9 w-[116px] rounded-lg bg-white text-[12.5px]"
            />
          </CompactFilterToolbar>
        }
      />
    </div>
  );
}
