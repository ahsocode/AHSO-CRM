"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Revenue Trend</p>
        <CardTitle>Doanh thu 6 tháng</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <LoadingSkeleton className="h-[280px] w-full" />
        ) : (
          <div className="space-y-3">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(213,216,220,0.5)" vertical={false} />
                  <XAxis dataKey="month" stroke="#5d6d7e" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis
                    stroke="#5d6d7e"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatVNDShort(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid rgba(213,216,220,0.8)", fontSize: 12 }}
                    formatter={(value: number) => formatVNDShort(Number(value))}
                  />
                  <Area
                    dataKey="revenue"
                    type="monotone"
                    stroke="#1a5276"
                    strokeWidth={2}
                    fill="#1a5276"
                    fillOpacity={0.1}
                  />
                  <Line
                    dataKey="target"
                    type="monotone"
                    stroke="#e67e22"
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
