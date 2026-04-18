"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { useQuotes } from "@/hooks/use-quotes";
import { getApiErrorMessage } from "@/lib/api-client";
import { QuoteStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuoteFilters } from "./quote-filters";
import { QuoteOverviewCards } from "./quote-overview-cards";
import { QuoteTable } from "./quote-table";

const PAGE_SIZE = 8;

export function QuotesClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "">("");
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
  const quotesQuery = useQuotes({
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
        title="Báo giá"
        description="Quote board nối dữ liệu thật để đội sales theo dõi toàn bộ báo giá, trạng thái gửi/chốt và cửa sổ hết hạn trên một màn hình."
        action={
          <Link href="/quotes/new" className={cn(buttonVariants({ variant: "primary" }))}>
            Tạo báo giá
          </Link>
        }
      />

      <QuoteOverviewCards meta={quotesQuery.data?.meta} isLoading={quotesQuery.isLoading} />

      <QuoteFilters
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

      <QuoteTable
        errorMessage={getApiErrorMessage(quotesQuery.error, "Không thể tải danh sách báo giá.")}
        isError={quotesQuery.isError}
        isLoading={quotesQuery.isLoading}
        items={quotesQuery.data?.items ?? []}
        meta={quotesQuery.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
