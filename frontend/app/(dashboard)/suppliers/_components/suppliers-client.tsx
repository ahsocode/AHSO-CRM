"use client";

import type { Route } from "next";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useSuppliers } from "@/hooks/use-suppliers";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import type { SupplierListItem } from "@/lib/types";
import { cn, downloadExcelRows } from "@/lib/utils";
import { toast } from "sonner";
import { SupplierFilters } from "./supplier-filters";
import { SupplierOverviewCards } from "./supplier-overview-cards";
import { SupplierTable } from "./supplier-table";

const PAGE_SIZE = 10;

export function SuppliersClient() {
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());

  async function handleExport() {
    setIsExporting(true);
    try {
      const res = await apiClient.get<{ data: SupplierListItem[] }>("/suppliers", {
        params: { page: 1, limit: 9999, search: deferredSearch || undefined, isActive },
      });
      const items = res.data.data ?? [];
      if (!items.length) { toast.warning("Không có dữ liệu để xuất."); return; }
      const rows = items.map((s) => ({
        "Mã NCC": s.code,
        "Tên nhà cung cấp": s.name,
        "Mã số thuế": s.taxCode ?? "",
        "Điện thoại": s.phone ?? "",
        "Email": s.email ?? "",
        "Người liên hệ": s.contactName ?? "",
        "Trạng thái": s.isActive ? "Hoạt động" : "Ngưng",
      }));
      await downloadExcelRows("nha-cung-cap.xlsx", rows);
      toast.success(`Đã xuất ${rows.length} nhà cung cấp.`);
    } catch {
      toast.error("Không thể xuất dữ liệu.");
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, isActive]);

  const suppliersQuery = useSuppliers({
    page,
    limit: PAGE_SIZE,
    search: deferredSearch || undefined,
    isActive,
  });

  const items = suppliersQuery.data?.items ?? [];
  const activeCount = items.filter((s) => s.isActive).length;
  const canReset = search.length > 0 || isActive !== undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Nhà cung cấp"
        description="Quản lý danh sách nhà cung cấp vật tư, thiết bị và dịch vụ cho AHSO."
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
            <Link
              href={"/suppliers/new" as Route}
              className={cn(buttonVariants({ variant: "primary" }))}
            >
              Thêm nhà cung cấp
            </Link>
          </div>
        }
      />

      <SupplierOverviewCards
        total={suppliersQuery.data?.meta?.total ?? 0}
        activeCount={suppliersQuery.data?.items.filter((s) => s.isActive).length ?? 0}
        isLoading={suppliersQuery.isLoading}
      />

      <SupplierFilters
        search={search}
        isActive={isActive}
        canReset={canReset}
        onSearchChange={setSearch}
        onIsActiveChange={setIsActive}
        onReset={() => {
          setSearch("");
          setIsActive(undefined);
          setPage(1);
        }}
      />

      <SupplierTable
        items={items}
        meta={suppliersQuery.data?.meta}
        isLoading={suppliersQuery.isLoading}
        isError={suppliersQuery.isError}
        errorMessage={getApiErrorMessage(
          suppliersQuery.error,
          "Không thể tải danh sách nhà cung cấp."
        )}
        onPageChange={setPage}
      />
    </div>
  );
}
