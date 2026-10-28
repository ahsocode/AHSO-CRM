"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCards } from "./_components/kpi-cards";
import { RevenueChart } from "./_components/revenue-chart";
import { TopProjects } from "./_components/top-projects";
import { PipelinePreview } from "./_components/pipeline-preview";
import { PriorityActions } from "./_components/priority-actions";
import { ActivityFeed } from "./_components/activity-feed";
import {
  DashboardDateRangeFilter,
  getDefaultDashboardDateRange
} from "./_components/dashboard-date-range-filter";
import {
  useDashboardKpis,
  usePipelinePreview,
  useRecentActivity,
  useRevenueChart,
  useActionItems
} from "@/hooks/use-dashboard";

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState(() => getDefaultDashboardDateRange());
  const dashboardFilters = useMemo(() => dateRange, [dateRange]);

  const kpisQuery = useDashboardKpis(dashboardFilters);
  const revenueChartQuery = useRevenueChart(dashboardFilters);
  const pipelineQuery = usePipelinePreview(dashboardFilters);
  const actionItemsQuery = useActionItems();
  const activityQuery = useRecentActivity(dashboardFilters);

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        eyebrow="Tổng quan"
        title="Dashboard điều phối"
        action={
          <DashboardDateRangeFilter
            range={dateRange}
            onRangeChange={setDateRange}
          />
        }
      />

      <KpiCards data={kpisQuery.data} isLoading={kpisQuery.isLoading} />

      {/* Mobile priority: action items + activity first */}
      <div className="grid gap-4 md:hidden">
        <PriorityActions data={actionItemsQuery.data} isLoading={actionItemsQuery.isLoading} />
        <ActivityFeed data={activityQuery.data} isLoading={activityQuery.isLoading} />
      </div>

      {/* Desktop: charts */}
      <div className="hidden md:grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <RevenueChart data={revenueChartQuery.data} isLoading={revenueChartQuery.isLoading} />
        <TopProjects />
      </div>

      <div className="hidden md:block">
        <PipelinePreview data={pipelineQuery.data} isLoading={pipelineQuery.isLoading} />
      </div>

      {/* Desktop: action items + activity */}
      <div className="hidden md:grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <PriorityActions data={actionItemsQuery.data} isLoading={actionItemsQuery.isLoading} />
        <ActivityFeed data={activityQuery.data} isLoading={activityQuery.isLoading} />
      </div>
    </div>
  );
}
