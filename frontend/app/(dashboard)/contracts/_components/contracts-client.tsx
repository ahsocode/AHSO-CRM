"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useContracts } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";
import { ContractSortField, ContractStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContractFilters } from "./contract-filters";
import { ContractOverviewCards } from "./contract-overview-cards";
import { ContractTable } from "./contract-table";

const PAGE_SIZE = 8;

export function ContractsClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ContractStatus | "">("");
  const [projectId, setProjectId] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [sortBy, setSortBy] = useState<ContractSortField | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, projectId, status, includeCancelled, sortBy, sortDir]);

  const contractsQuery = useContracts({
    page,
    limit: PAGE_SIZE,
    search: deferredSearch || undefined,
    status: status || undefined,
    projectId: projectId || undefined,
    includeCancelled: includeCancelled || undefined,
    sortBy: sortBy || undefined,
    sortDir: sortBy ? sortDir : undefined
  });

  const handleSort = (field: ContractSortField) => {
    if (sortBy === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(field);
    setSortDir(field === "contractNo" ? "asc" : "desc");
  };

  const canReset =
    search.length > 0 || status.length > 0 || projectId.length > 0 || includeCancelled || sortBy !== "";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hợp đồng"
        description="Trang này tổng hợp hợp đồng, công nợ và tiến độ triển khai để đội vận hành theo dõi sát hơn."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/quotes" className={cn(buttonVariants({ variant: "outline" }))}>
              Về báo giá
            </Link>
            <Link href="/contracts/new" className={cn(buttonVariants({ variant: "primary" }))}>
              Tạo hợp đồng
            </Link>
          </div>
        }
      />

      <ContractOverviewCards meta={contractsQuery.data?.meta} isLoading={contractsQuery.isLoading} />

      <ContractTable
        errorMessage={getApiErrorMessage(contractsQuery.error, "Không thể tải danh sách hợp đồng.")}
        isError={contractsQuery.isError}
        isLoading={contractsQuery.isLoading}
        items={contractsQuery.data?.items ?? []}
        meta={contractsQuery.data?.meta}
        onPageChange={setPage}
        onSort={handleSort}
        sortBy={sortBy}
        sortDir={sortDir}
        toolbar={
          <ContractFilters
            canReset={canReset}
            onProjectIdChange={setProjectId}
            onReset={() => {
              setSearch("");
              setStatus("");
              setProjectId("");
              setIncludeCancelled(false);
              setSortBy("");
              setSortDir("desc");
              setPage(1);
            }}
            includeCancelled={includeCancelled}
            onIncludeCancelledChange={setIncludeCancelled}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            projectId={projectId}
            search={search}
            status={status}
          />
        }
      />
    </div>
  );
}
