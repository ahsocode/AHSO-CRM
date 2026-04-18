"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { buttonVariants } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";
import { useCustomers } from "@/hooks/use-customers";
import { useUsers } from "@/hooks/use-users";
import { cn } from "@/lib/utils";
import { CustomerStatus } from "@/lib/types";
import { CustomerFilters, type VipFilterValue } from "./customer-filters";
import { CustomerOverviewCards } from "./customer-overview-cards";
import { CustomerTable } from "./customer-table";

const PAGE_SIZE = 8;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Đã xảy ra lỗi khi tải dữ liệu khách hàng.";
}

export function CustomersClient() {
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "">("");
  const [industry, setIndustry] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [vipFilter, setVipFilter] = useState<VipFilterValue>("all");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const normalizedIndustry = industry.trim();

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, status, normalizedIndustry, assignedToId, vipFilter]);

  const canManageUsers = user?.role === "ADMIN" || user?.role === "MANAGER";
  const usersQuery = useUsers(canManageUsers);
  const customersQuery = useCustomers({
    page,
    limit: PAGE_SIZE,
    search: deferredSearch || undefined,
    status: status || undefined,
    industry: normalizedIndustry || undefined,
    assignedToId: assignedToId || undefined,
    isVip: vipFilter === "all" ? undefined : vipFilter === "vip"
  });

  const canReset =
    search.length > 0 ||
    status.length > 0 ||
    normalizedIndustry.length > 0 ||
    assignedToId.length > 0 ||
    vipFilter !== "all";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Danh mục khách hàng"
        description="Không gian theo dõi lead, prospect và khách hàng đang vận hành. Giao diện này bám layout AHSO để khóa pattern cho module tuần 2."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/customers/new" className={cn(buttonVariants({ variant: "primary" }))}>
              <AppIcon name="plus" className="h-4 w-4" />
              Thêm khách hàng
            </Link>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              Về dashboard
            </Link>
          </div>
        }
      />

      <CustomerOverviewCards meta={customersQuery.data?.meta} isLoading={customersQuery.isLoading} />

      <CustomerFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        industry={industry}
        onIndustryChange={setIndustry}
        assignedToId={assignedToId}
        onAssignedToIdChange={setAssignedToId}
        vipFilter={vipFilter}
        onVipFilterChange={setVipFilter}
        onReset={() => {
          setSearch("");
          setStatus("");
          setIndustry("");
          setAssignedToId("");
          setVipFilter("all");
          setPage(1);
        }}
        canReset={canReset}
        users={usersQuery.data ?? []}
        usersUnavailable={!canManageUsers || usersQuery.isError}
      />

      <CustomerTable
        items={customersQuery.data?.items ?? []}
        meta={customersQuery.data?.meta}
        isLoading={customersQuery.isLoading}
        isError={customersQuery.isError}
        errorMessage={getErrorMessage(customersQuery.error)}
        onPageChange={setPage}
      />
    </div>
  );
}
