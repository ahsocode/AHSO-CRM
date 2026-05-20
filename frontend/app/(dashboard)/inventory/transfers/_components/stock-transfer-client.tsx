"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useStockTransfers } from "@/hooks/use-stock-transfers";
import { useWarehousesSelect } from "@/hooks/use-warehouses";
import { PageHeader } from "@/components/layout/page-header";
import { getApiErrorMessage } from "@/lib/api-client";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { StockDocStatus } from "@/lib/types";
import { STOCK_DOC_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { StockTransferTable } from "./stock-transfer-table";

const PAGE_SIZE = 10;

export function StockTransferClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StockDocStatus | "">("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const warehousesSelect = useWarehousesSelect();

  const query = useStockTransfers({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    status: status || undefined,
    fromWarehouseId: fromWarehouseId || undefined,
    toWarehouseId: toWarehouseId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Chuyển kho"
        description="Quản lý các phiếu chuyển vật tư giữa các kho."
        action={
          <Link href={"/inventory/transfers/new" as Route} className={cn(buttonVariants({ variant: "primary" }))}>
            Tạo phiếu chuyển kho
          </Link>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Tìm số phiếu..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-52"
        />
        <Select
          value={fromWarehouseId}
          onChange={(e) => { setFromWarehouseId(e.target.value); setPage(1); }}
          className="w-44"
        >
          <option value="">Kho nguồn (tất cả)</option>
          {(warehousesSelect.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </Select>
        <Select
          value={toWarehouseId}
          onChange={(e) => { setToWarehouseId(e.target.value); setPage(1); }}
          className="w-44"
        >
          <option value="">Kho đích (tất cả)</option>
          {(warehousesSelect.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
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
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-40" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-40" />
      </div>

      <StockTransferTable
        items={query.data?.items ?? []}
        meta={query.data?.meta}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getApiErrorMessage(query.error, "Không thể tải danh sách phiếu chuyển kho.")}
        onPageChange={setPage}
      />
    </div>
  );
}
