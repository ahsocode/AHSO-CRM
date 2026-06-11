"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVNDShort } from "@/lib/format";
import { RevenueChartPoint } from "@/lib/types";
import { CHART_COLORS } from "@/lib/constants";

export function ReportRevenueTrend({
  data,
  isLoading
}: {
  data?: RevenueChartPoint[];
  isLoading: boolean;
}) {
  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Revenue Trend</p>
        <CardTitle>Xu hướng thu tiền theo tháng</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <LoadingSkeleton className="h-[360px] w-full" />
        ) : (
          <div className="space-y-3">
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(213,216,220,0.8)" vertical={false} />
                  <XAxis dataKey="month" stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke={CHART_COLORS.axis}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatVNDShort(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid rgba(213,216,220,0.8)"
                    }}
                    formatter={(value: number) => formatVNDShort(Number(value))}
                  />
                  <Bar dataKey="revenue" fill={CHART_COLORS.primaryMid} radius={[6, 6, 0, 0]} />
                  <Line
                    dataKey="target"
                    type="monotone"
                    stroke={CHART_COLORS.accent}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-5 text-sm text-text-secondary">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                Thu thực
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                Mục tiêu
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
