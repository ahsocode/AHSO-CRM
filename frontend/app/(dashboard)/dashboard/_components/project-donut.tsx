"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PipelineStage } from "@/lib/types";
import { formatVNDShort } from "@/lib/format";
import { CHART_STAGE_SERIES } from "@/lib/constants";

const STAGE_COLORS = [...CHART_STAGE_SERIES];

export function ProjectDonut({
  data,
  isLoading
}: {
  data?: PipelineStage[];
  isLoading: boolean;
}) {
  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Pipeline</p>
        <CardTitle>Cơ cấu pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <LoadingSkeleton className="h-[240px] w-full" />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.95fr]">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    innerRadius={56}
                    outerRadius={84}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {data.map((stage, index) => (
                      <Cell key={stage.status} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, _label, payload) => [`${value} cơ hội`, payload?.payload?.label]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1">
              {data.map((stage, index) => (
                <div className="flex items-center gap-2 py-1.5" key={stage.status}>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STAGE_COLORS[index % STAGE_COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{stage.label}</span>
                  <span className="shrink-0 rounded-full bg-bg-hover px-2 py-0.5 text-xs font-semibold text-text-secondary">
                    {stage.count}
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs text-text-muted">
                    {formatVNDShort(stage.totalValue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
