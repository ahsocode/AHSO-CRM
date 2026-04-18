"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PipelineStage } from "@/lib/types";
import { formatVNDShort } from "@/lib/format";

const STAGE_COLORS = ["#95A5A6", "#2E86C1", "#E67E22", "#17A589", "#1E8449"];

export function ProjectDonut({
  data,
  isLoading
}: {
  data?: PipelineStage[];
  isLoading: boolean;
}) {
  return (
    <Card className="h-full p-6">
      <CardHeader className="mb-6">
        <CardTitle>Cơ cấu pipeline</CardTitle>
        <CardDescription>Phân bổ cơ hội theo từng giai đoạn của chu trình bán hàng.</CardDescription>
      </CardHeader>

      {isLoading || !data ? (
        <LoadingSkeleton className="h-[320px] w-full" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_0.95fr]">
          <div className="h-[240px]">
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

          <div className="space-y-3">
            {data.map((stage, index) => (
              <div className="flex items-center justify-between rounded-xl bg-bg-hover/70 px-4 py-3" key={stage.status}>
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: STAGE_COLORS[index % STAGE_COLORS.length] }}
                  />
                  <div>
                    <p className="font-semibold text-text-primary">{stage.label}</p>
                    <p className="text-sm text-text-secondary">{stage.count} dự án</p>
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-text-primary">{formatVNDShort(stage.totalValue)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

