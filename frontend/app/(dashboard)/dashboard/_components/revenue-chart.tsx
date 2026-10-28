"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { formatVNDShort } from "@/lib/format";
import { RevenueChartPoint } from "@/lib/types";
import { CHART_COLORS } from "@/lib/constants";
import { formatBarLabel, summarizeRevenue } from "./action-items-helpers";

export function RevenueChart({
  data,
  isLoading
}: {
  data?: RevenueChartPoint[];
  isLoading: boolean;
}) {
  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <CardTitle>Doanh thu theo tháng</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <LoadingSkeleton className="h-[280px] w-full" />
        ) : (
          <div className="space-y-3">
            <p className="sr-only">{summarizeRevenue(data)}</p>
            <div className="h-[200px] md:h-[280px]" role="img" aria-label={summarizeRevenue(data)}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(213,216,220,0.5)" vertical={false} />
                  <XAxis dataKey="month" stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis
                    stroke={CHART_COLORS.axis}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatVNDShort(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid rgba(213,216,220,0.8)", fontSize: 12 }}
                    formatter={(value: number) => formatVNDShort(Number(value))}
                  />
                  <Bar
                    dataKey="revenue"
                    fill={CHART_COLORS.primaryMid}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  >
                    <LabelList
                      dataKey="revenue"
                      position="top"
                      formatter={formatBarLabel}
                      fill={CHART_COLORS.label}
                      fontSize={11}
                    />
                  </Bar>
                  <Line
                    dataKey="target"
                    type="linear"
                    stroke={CHART_COLORS.accent}
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-5 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Thu thực
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-px w-5 border-t-2 border-dashed border-accent" />
                Mục tiêu
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
