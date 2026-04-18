"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useContracts } from "@/hooks/use-contracts";
import { useProjects } from "@/hooks/use-projects";
import { getApiErrorMessage } from "@/lib/api-client";
import { ContractStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContractFilters } from "./contract-filters";
import { ContractOverviewCards } from "./contract-overview-cards";
import { ContractTable } from "./contract-table";

const PAGE_SIZE = 8;

export function ContractsClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ContractStatus | "">("");
  const [projectId, setProjectId] = useState("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, projectId, status]);

  const projectsQuery = useProjects({
    page: 1,
    limit: 100
  });
  const contractsQuery = useContracts({
    page,
    limit: PAGE_SIZE,
    search: deferredSearch || undefined,
    status: status || undefined,
    projectId: projectId || undefined
  });

  const canReset = search.length > 0 || status.length > 0 || projectId.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hợp đồng"
        description="Contract board gom hợp đồng, công nợ và tiến độ delivery trên cùng một bề mặt để đội vận hành theo dõi sát hơn."
        action={
          <Link href="/quotes" className={cn(buttonVariants({ variant: "outline" }))}>
            Về báo giá
          </Link>
        }
      />

      <ContractOverviewCards meta={contractsQuery.data?.meta} isLoading={contractsQuery.isLoading} />

      <ContractFilters
        canReset={canReset}
        onProjectIdChange={setProjectId}
        onReset={() => {
          setSearch("");
          setStatus("");
          setProjectId("");
          setPage(1);
        }}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        projectId={projectId}
        projects={projectsQuery.data?.items ?? []}
        projectsUnavailable={projectsQuery.isError}
        search={search}
        status={status}
      />

      <ContractTable
        errorMessage={getApiErrorMessage(contractsQuery.error, "Không thể tải danh sách hợp đồng.")}
        isError={contractsQuery.isError}
        isLoading={contractsQuery.isLoading}
        items={contractsQuery.data?.items ?? []}
        meta={contractsQuery.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
