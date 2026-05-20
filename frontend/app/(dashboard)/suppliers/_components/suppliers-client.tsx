"use client";

import type { Route } from "next";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useSuppliers } from "@/hooks/use-suppliers";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SupplierFilters } from "./supplier-filters";
import { SupplierOverviewCards } from "./supplier-overview-cards";
import { SupplierTable } from "./supplier-table";

const PAGE_SIZE = 10;

export function SuppliersClient() {
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

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
          <Link
            href={"/suppliers/new" as Route}
            className={cn(buttonVariants({ variant: "primary" }))}
          >
            Thêm nhà cung cấp
          </Link>
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
