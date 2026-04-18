"use client";

import { PageHeader } from "@/components/layout/page-header";
import { KpiCards } from "./_components/kpi-cards";
import { RevenueChart } from "./_components/revenue-chart";
import { ProjectDonut } from "./_components/project-donut";
import { PipelinePreview } from "./_components/pipeline-preview";
import { TaskChecklist } from "./_components/task-checklist";
import { ActivityFeed } from "./_components/activity-feed";
import {
  useDashboardKpis,
  usePipelinePreview,
  useRecentActivity,
  useRevenueChart,
  useTasksToday
} from "@/hooks/use-dashboard";

export default function DashboardPage() {
  const kpisQuery = useDashboardKpis();
  const revenueChartQuery = useRevenueChart();
  const pipelineQuery = usePipelinePreview();
  const tasksQuery = useTasksToday();
  const activityQuery = useRecentActivity();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tổng quan hoạt động"
        description="Bảng điều phối theo phong cách thiết kế AHSO để theo dõi doanh thu, pipeline và nhịp công việc của đội ngũ."
      />

      <KpiCards data={kpisQuery.data} isLoading={kpisQuery.isLoading} />

      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <RevenueChart data={revenueChartQuery.data} isLoading={revenueChartQuery.isLoading} />
        <ProjectDonut data={pipelineQuery.data} isLoading={pipelineQuery.isLoading} />
      </div>

      <PipelinePreview data={pipelineQuery.data} isLoading={pipelineQuery.isLoading} />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <TaskChecklist data={tasksQuery.data} isLoading={tasksQuery.isLoading} />
        <ActivityFeed data={activityQuery.data} isLoading={activityQuery.isLoading} />
      </div>
    </div>
  );
}

