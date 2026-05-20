"use client";

import type { Route } from "next";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useMaterials } from "@/hooks/use-materials";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { MaterialFilters } from "./material-filters";
import { MaterialOverviewCards } from "./material-overview-cards";
import { MaterialTable } from "./material-table";

const PAGE_SIZE = 10;

export function MaterialsClient() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, categoryId, isActive, lowStockOnly]);

  const materialsQuery = useMaterials({
    page,
    limit: PAGE_SIZE,
    search: deferredSearch || undefined,
    categoryId: categoryId || undefined,
    isActive,
    lowStockOnly: lowStockOnly || undefined,
  });

  const items = materialsQuery.data?.items ?? [];
  const canReset =
    search.length > 0 || categoryId.length > 0 || isActive !== undefined || lowStockOnly;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vật tư"
        description="Quản lý danh mục vật tư, thiết bị và linh kiện dùng trong các dự án AHSO."
        action={
          <Link
            href={"/materials/new" as Route}
            className={cn(buttonVariants({ variant: "primary" }))}
          >
            Thêm vật tư
          </Link>
        }
      />

      <MaterialOverviewCards items={items} isLoading={materialsQuery.isLoading} />

      <MaterialFilters
        search={search}
        categoryId={categoryId}
        isActive={isActive}
        lowStockOnly={lowStockOnly}
        canReset={canReset}
        onSearchChange={setSearch}
        onCategoryChange={setCategoryId}
        onIsActiveChange={setIsActive}
        onLowStockOnlyChange={setLowStockOnly}
        onReset={() => {
          setSearch("");
          setCategoryId("");
          setIsActive(undefined);
          setLowStockOnly(false);
          setPage(1);
        }}
      />

      <MaterialTable
        items={items}
        meta={materialsQuery.data?.meta}
        isLoading={materialsQuery.isLoading}
        isError={materialsQuery.isError}
        errorMessage={getApiErrorMessage(
          materialsQuery.error,
          "Không thể tải danh sách vật tư."
        )}
        onPageChange={setPage}
      />
    </div>
  );
}
