"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useReportsOverview, useReportsRevenueTrend, useReportsStatusBreakdown, useReportsTopCustomers } from "@/hooks/use-reports";
import { ReportRevenueTrend } from "./report-revenue-trend";
import { ReportsOverviewCards } from "./reports-overview-cards";
import { StatusBreakdown } from "./status-breakdown";
import { TopCustomersReport } from "./top-customers-report";

const RANGE_OPTIONS = [
  { label: "3 tháng", value: 3 },
  { label: "6 tháng", value: 6 },
  { label: "12 tháng", value: 12 }
];

export function ReportsClient() {
  const [months, setMonths] = useState(6);
  const filters = { months, topLimit: 5 };
  const overviewQuery = useReportsOverview(filters);
  const revenueTrendQuery = useReportsRevenueTrend(filters);
  const statusBreakdownQuery = useReportsStatusBreakdown(filters);
  const topCustomersQuery = useReportsTopCustomers(filters);

  const errorMessage =
    getApiErrorMessage(overviewQuery.error, "") ||
    getApiErrorMessage(revenueTrendQuery.error, "") ||
    getApiErrorMessage(statusBreakdownQuery.error, "") ||
    getApiErrorMessage(topCustomersQuery.error, "");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Báo cáo"
        description="Màn hình tổng hợp hiệu quả kinh doanh, dòng tiền và phân bổ trạng thái để đọc nhanh sức khỏe toàn bộ pipeline."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Select value={String(months)} onChange={(event) => setMonths(Number(event.target.value))}>
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              Về dashboard
            </Link>
          </div>
        }
      />

      {overviewQuery.isError ||
      revenueTrendQuery.isError ||
      statusBreakdownQuery.isError ||
      topCustomersQuery.isError ? (
        <div className="rounded-2xl border border-danger/20 bg-danger-bg/70 px-5 py-4 text-sm text-danger">
          {errorMessage || "Không thể tải dữ liệu báo cáo."}
        </div>
      ) : null}

      <ReportsOverviewCards data={overviewQuery.data} isLoading={overviewQuery.isLoading} />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <ReportRevenueTrend data={revenueTrendQuery.data} isLoading={revenueTrendQuery.isLoading} />
        <StatusBreakdown data={statusBreakdownQuery.data} isLoading={statusBreakdownQuery.isLoading} />
      </div>

      <TopCustomersReport
        customers={topCustomersQuery.data}
        overview={overviewQuery.data}
        isLoading={topCustomersQuery.isLoading || overviewQuery.isLoading}
      />
    </div>
  );
}
