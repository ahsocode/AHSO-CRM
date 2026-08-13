"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useWarehouses } from "@/hooks/use-warehouses";
import { PageHeader } from "@/components/layout/page-header";
import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { getApiErrorMessage } from "@/lib/api-client";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { WarehouseTable } from "./warehouse-table";

export function WarehouseClient() {
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);

  const query = useWarehouses({
    page,
    limit: 20,
    search: search.trim() || undefined,
    isActive: isActive === "" ? undefined : isActive === "true",
  });
  const canReset = search.length > 0 || isActive.length > 0;
  const resetFilters = () => {
    setSearch("");
    setIsActive("");
    setPage(1);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Danh sách kho"
        description="Quản lý các kho hàng và phân quyền quản lý kho."
        action={
          <Link href={"/inventory/warehouses/new" as Route} className={cn(buttonVariants({ variant: "primary" }))}>
            Thêm kho mới
          </Link>
        }
      />

      <WarehouseTable
        items={query.data?.items ?? []}
        meta={query.data?.meta}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getApiErrorMessage(query.error, "Không thể tải danh sách kho.")}
        onPageChange={setPage}
        toolbar={
          <CompactFilterToolbar
            canReset={canReset}
            onReset={resetFilters}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchAriaLabel="Tìm kiếm kho"
            searchPlaceholder="Mã hoặc tên kho..."
            searchValue={search}
          >
            <Select
              aria-label="Trạng thái"
              value={isActive}
              onChange={(e) => {
                setIsActive(e.target.value as "" | "true" | "false");
                setPage(1);
              }}
              className="h-9 w-[132px] rounded-lg bg-white text-[12.5px]"
            >
              <option value="">Trạng thái</option>
              <option value="true">Hoạt động</option>
              <option value="false">Ngừng</option>
            </Select>
          </CompactFilterToolbar>
        }
      />
    </div>
  );
}
