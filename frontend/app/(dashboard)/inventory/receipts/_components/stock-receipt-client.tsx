"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useStockReceipts } from "@/hooks/use-stock-receipts";
import { useWarehousesSelect } from "@/hooks/use-warehouses";
import { useSuppliersSelect } from "@/hooks/use-suppliers";
import { PageHeader } from "@/components/layout/page-header";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { StockDocStatus, StockReceiptListItem } from "@/lib/types";
import { STOCK_DOC_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn, downloadExcelRows } from "@/lib/utils";
import { toast } from "sonner";
import { StockReceiptTable } from "./stock-receipt-table";

const PAGE_SIZE = 10;

export function StockReceiptClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StockDocStatus | "">("");
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const warehousesSelect = useWarehousesSelect();

  async function handleExport() {
    setIsExporting(true);
    try {
      const res = await apiClient.get<{ data: StockReceiptListItem[] }>("/stock-receipts", {
        params: {
          page: 1, limit: 500,
          search: search.trim() || undefined,
          status: status || undefined,
          warehouseId: warehouseId || undefined,
          supplierId: supplierId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
      const items = res.data.data ?? [];
      if (!items.length) { toast.warning("Không có dữ liệu để xuất."); return; }
      const rows = items.map((r) => ({
        "Số phiếu": r.receiptNo,
        "Ngày": formatDate(r.date),
        "Kho": r.warehouse.name,
        "Nhà cung cấp": r.supplier?.name ?? "",
        "Số mặt hàng": r.itemCount,
        "Tổng tiền": r.totalAmount,
        "Trạng thái": STOCK_DOC_STATUS_LABELS[r.status],
      }));
      await downloadExcelRows("phieu-nhap-kho.xlsx", rows);
      toast.success(`Đã xuất ${rows.length} phiếu nhập kho.`);
    } catch {
      toast.error("Không thể xuất dữ liệu.");
    } finally {
      setIsExporting(false);
    }
  }
  const suppliersSelect = useSuppliersSelect();

  const query = useStockReceipts({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    status: status || undefined,
    warehouseId: warehouseId || undefined,
    supplierId: supplierId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Phiếu nhập kho"
        description="Quản lý toàn bộ phiếu nhập kho, theo dõi trạng thái và giá trị nhập hàng."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {isExporting ? "Đang xuất..." : "Xuất Excel"}
            </button>
            <Link href={"/inventory/receipts/new" as Route} className={cn(buttonVariants({ variant: "primary" }))}>
              Tạo phiếu nhập kho
            </Link>
          </div>
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
          value={supplierId}
          onChange={(e) => { setSupplierId(e.target.value); setPage(1); }}
          className="w-44"
        >
          <option value="">Tất cả NCC</option>
          {(suppliersSelect.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
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

      <StockReceiptTable
        items={query.data?.items ?? []}
        meta={query.data?.meta}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getApiErrorMessage(query.error, "Không thể tải danh sách phiếu nhập kho.")}
        onPageChange={setPage}
      />
    </div>
  );
}
