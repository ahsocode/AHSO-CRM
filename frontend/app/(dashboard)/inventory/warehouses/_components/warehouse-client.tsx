"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useWarehouses } from "@/hooks/use-warehouses";
import { PageHeader } from "@/components/layout/page-header";
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Tìm theo mã hoặc tên kho..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-60"
        />
        <Select
          value={isActive}
          onChange={(e) => {
            setIsActive(e.target.value as "" | "true" | "false");
            setPage(1);
          }}
          className="w-40"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Ngừng hoạt động</option>
        </Select>
      </div>

      <WarehouseTable
        items={query.data?.items ?? []}
        meta={query.data?.meta}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getApiErrorMessage(query.error, "Không thể tải danh sách kho.")}
        onPageChange={setPage}
      />
    </div>
  );
}
