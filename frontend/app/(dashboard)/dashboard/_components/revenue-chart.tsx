"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="h-full p-6">
      <CardHeader className="mb-6">
        <CardTitle>Doanh thu 6 tháng</CardTitle>
        <CardDescription>Theo dõi dòng tiền từ các hợp đồng và đợt thanh toán đã ghi nhận.</CardDescription>
      </CardHeader>

      {isLoading || !data ? (
        <LoadingSkeleton className="h-[320px] w-full" />
      ) : (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(93, 109, 126, 0.18)" vertical={false} />
              <XAxis dataKey="month" stroke="#5d6d7e" tickLine={false} axisLine={false} />
              <YAxis
                stroke="#5d6d7e"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatVNDShort(Number(value))}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 16,
                  border: "1px solid rgba(213, 216, 220, 0.8)",
                  boxShadow: "0 10px 28px rgba(28, 40, 51, 0.08)"
                }}
                formatter={(value: number) => formatVNDShort(Number(value))}
              />
              <Bar dataKey="target" fill="rgba(230, 126, 34, 0.18)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="revenue" fill="#1a5276" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

