"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ResponsiveSankey } from "@nivo/sankey";
import { ResponsiveHeatMap } from "@nivo/heatmap";
import { ResponsiveFunnel } from "@nivo/funnel";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  useReportsActivityHeatmap,
  useReportsCohort,
  useReportsCustomerJourney,
  useReportsFunnel,
  useReportsOverview,
  useReportsRevenueTrend,
  useReportsStatusBreakdown,
  useReportsTopCustomers
} from "@/hooks/use-reports";
import { ReportRevenueTrend } from "./report-revenue-trend";
import { ReportsOverviewCards } from "./reports-overview-cards";
import { StatusBreakdown } from "./status-breakdown";
import { TopCustomersReport } from "./top-customers-report";

const RANGE_OPTIONS = [
  { label: "3 tháng", value: 3 },
  { label: "6 tháng", value: 6 },
  { label: "12 tháng", value: 12 }
];

function CustomerJourneyCard({
  data,
  isLoading
}: {
  data?: { nodes: Array<{ id: string; label: string }>; links: Array<{ source: string; target: string; value: number }> };
  isLoading: boolean;
}) {
  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Journey Flow</p>
        <CardTitle>Luồng khách hàng từ lead tới chốt hợp đồng</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton className="h-[360px] w-full" />
        ) : data && data.links.some((item) => item.value > 0) ? (
          <div className="h-[360px]">
            <ResponsiveSankey
              data={data}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              colors={{ scheme: "set2" }}
              nodeOpacity={1}
              nodeThickness={18}
              nodeSpacing={24}
              labelTextColor="#0f172a"
              linkOpacity={0.35}
              animate={false}
            />
          </div>
        ) : (
          <EmptyState
            title="Chưa đủ dữ liệu journey"
            description="Khi có thêm lead, quote accepted và contract, biểu đồ luồng chuyển đổi sẽ hiện rõ hơn."
          />
        )}
      </CardContent>
    </Card>
  );
}

function ActivityHeatmapCard({
  data,
  isLoading
}: {
  data?: Array<{ day: string; hour: string; value: number }>;
  isLoading: boolean;
}) {
  const heatmapData = useMemo(() => {
    if (!data?.length) {
      return [];
    }

    const days = Array.from(new Set(data.map((item) => item.day)));
    return days.map((day) => ({
      id: day,
      data: data
        .filter((item) => item.day === day)
        .map((item) => ({
          x: item.hour,
          y: item.value
        }))
    }));
  }, [data]);

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Activity Density</p>
        <CardTitle>Heatmap hoạt động theo ngày và giờ</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton className="h-[360px] w-full" />
        ) : heatmapData.length ? (
          <div className="h-[360px]">
            <ResponsiveHeatMap
              data={heatmapData}
              margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
              axisTop={null}
              axisRight={null}
              colors={{ type: "sequential", scheme: "blues" }}
              emptyColor="#e2e8f0"
              enableLabels={false}
              animate={false}
            />
          </div>
        ) : (
          <EmptyState
            title="Chưa đủ hoạt động để vẽ heatmap"
            description="Khi lịch công tác và tương tác được ghi nhận dày hơn, heatmap sẽ cho thấy khung giờ cao điểm."
          />
        )}
      </CardContent>
    </Card>
  );
}

function FunnelCard({
  data,
  isLoading
}: {
  data?: Array<{ id: string; label: string; value: number }>;
  isLoading: boolean;
}) {
  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Conversion Funnel</p>
        <CardTitle>Funnel chuyển đổi theo giai đoạn dự án</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton className="h-[360px] w-full" />
        ) : data && data.some((item) => item.value > 0) ? (
          <div className="h-[360px]">
            <ResponsiveFunnel
              data={data}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              valueFormat=">-.0f"
              colors={{ scheme: "category10" }}
              borderWidth={10}
              labelColor={{ from: "color", modifiers: [["darker", 3]] }}
              animate={false}
            />
          </div>
        ) : (
          <EmptyState
            title="Funnel chưa có dữ liệu"
            description="Khi pipeline có nhiều cơ hội hơn, funnel sẽ phản ánh rõ conversion rate giữa các stage."
          />
        )}
      </CardContent>
    </Card>
  );
}

function CohortCard({
  data,
  isLoading
}: {
  data?: Array<{ cohort: string; values: Array<{ month: string; retained: number }> }>;
  isLoading: boolean;
}) {
  const months = Array.from(new Set((data ?? []).flatMap((item) => item.values.map((value) => value.month))));

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Retention Matrix</p>
        <CardTitle>Cohort retention theo tháng</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton className="h-[360px] w-full" />
        ) : data?.length ? (
          <div className="overflow-x-auto">
            <div className="min-w-[640px] space-y-2">
              <div className="grid grid-cols-[160px_repeat(auto-fit,minmax(88px,1fr))] gap-2">
                <div className="rounded-xl bg-bg-hover/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  Cohort
                </div>
                {months.map((month) => (
                  <div key={month} className="rounded-xl bg-bg-hover/60 px-3 py-2 text-center text-xs font-semibold text-text-secondary">
                    {month}
                  </div>
                ))}
              </div>
              {data.map((row) => (
                <div key={row.cohort} className="grid grid-cols-[160px_repeat(auto-fit,minmax(88px,1fr))] gap-2">
                  <div className="rounded-xl border border-border/60 bg-white px-3 py-3 text-sm font-semibold text-text-primary">
                    {row.cohort}
                  </div>
                  {months.map((month) => {
                    const cell = row.values.find((value) => value.month === month);
                    const retained = cell?.retained ?? 0;
                    return (
                      <div
                        key={`${row.cohort}-${month}`}
                        className={cn(
                          "rounded-xl px-3 py-3 text-center text-sm font-semibold",
                          retained ? "bg-primary/12 text-primary" : "bg-slate-100 text-text-muted"
                        )}
                      >
                        {retained ? "Giữ" : "—"}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="Chưa có cohort retention"
            description="Cần thêm dữ liệu khách hàng và thanh toán theo thời gian để phân tích retention chính xác."
          />
        )}
      </CardContent>
    </Card>
  );
}

export function ReportsClient() {
  const [months, setMonths] = useState(6);
  const filters = { months, topLimit: 5 };
  const overviewQuery = useReportsOverview(filters);
  const revenueTrendQuery = useReportsRevenueTrend(filters);
  const statusBreakdownQuery = useReportsStatusBreakdown(filters);
  const topCustomersQuery = useReportsTopCustomers(filters);
  const customerJourneyQuery = useReportsCustomerJourney(filters);
  const activityHeatmapQuery = useReportsActivityHeatmap(filters);
  const funnelQuery = useReportsFunnel(filters);
  const cohortQuery = useReportsCohort(filters);

  const errorMessage =
    getApiErrorMessage(overviewQuery.error, "") ||
    getApiErrorMessage(revenueTrendQuery.error, "") ||
    getApiErrorMessage(statusBreakdownQuery.error, "") ||
    getApiErrorMessage(topCustomersQuery.error, "") ||
    getApiErrorMessage(customerJourneyQuery.error, "") ||
    getApiErrorMessage(activityHeatmapQuery.error, "") ||
    getApiErrorMessage(funnelQuery.error, "") ||
    getApiErrorMessage(cohortQuery.error, "");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Báo cáo"
        description="Màn hình tổng hợp hiệu quả kinh doanh, dòng tiền, chuyển đổi pipeline và mật độ hoạt động theo thời gian."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Select value={String(months)} onChange={(event) => setMonths(Number(event.target.value))}>
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Link href="/reports/builder" className={cn(buttonVariants({ variant: "primary" }))}>
              Mở Report Builder
            </Link>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              Về dashboard
            </Link>
          </div>
        }
      />

      {overviewQuery.isError ||
      revenueTrendQuery.isError ||
      statusBreakdownQuery.isError ||
      topCustomersQuery.isError ||
      customerJourneyQuery.isError ||
      activityHeatmapQuery.isError ||
      funnelQuery.isError ||
      cohortQuery.isError ? (
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

      <div className="grid gap-6 xl:grid-cols-2">
        <CustomerJourneyCard data={customerJourneyQuery.data} isLoading={customerJourneyQuery.isLoading} />
        <FunnelCard data={funnelQuery.data} isLoading={funnelQuery.isLoading} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ActivityHeatmapCard data={activityHeatmapQuery.data} isLoading={activityHeatmapQuery.isLoading} />
        <CohortCard data={cohortQuery.data} isLoading={cohortQuery.isLoading} />
      </div>
    </div>
  );
}
