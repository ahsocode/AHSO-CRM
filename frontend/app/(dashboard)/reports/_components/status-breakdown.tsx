"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVNDShort } from "@/lib/format";
import { ReportStatusBreakdown, ReportStatusBucket } from "@/lib/types";

const PROJECT_COLORS = ["#95A5A6", "#5DADE2", "#E67E22", "#2E86C1", "#C0392B", "#17A589", "#1E8449"];
const QUOTE_COLORS = ["#95A5A6", "#2E86C1", "#1E8449", "#C0392B"];
const CONTRACT_COLORS = ["#E67E22", "#2E86C1", "#1E8449", "#95A5A6"];

export function StatusBreakdown({
  data,
  isLoading
}: {
  data?: ReportStatusBreakdown;
  isLoading: boolean;
}) {
  if (isLoading || !data) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Phân bổ trạng thái</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-56 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Status Ledger</p>
        <CardTitle>Phân bổ trạng thái</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <StatusSection items={data.projects} title="Project Status" colors={PROJECT_COLORS} />
        <StatusSection items={data.quotes} title="Quote Status" colors={QUOTE_COLORS} />
        <StatusSection items={data.contracts} title="Contract Status" colors={CONTRACT_COLORS} />
      </CardContent>
    </Card>
  );
}

function StatusSection({
  title,
  items,
  colors
}: {
  title: string;
  items: ReportStatusBucket[];
  colors: string[];
}) {
  const chartHeight = Math.max(180, items.length * 44);
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  const totalValue = items.reduce((sum, item) => sum + item.totalValue, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-text-secondary">{title}</p>
        <p className="text-sm text-text-secondary">
          Tổng {totalCount} bản ghi · <CurrencyDisplay amount={totalValue} short />
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-white/60 p-6 text-center text-sm text-text-secondary">
          Chưa có dữ liệu
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={items}
                layout="vertical"
                margin={{ top: 8, right: 48, bottom: 8, left: 12 }}
                barCategoryGap={12}
              >
                <XAxis
                  type="number"
                  stroke="#5d6d7e"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  dataKey="label"
                  type="category"
                  stroke="#5d6d7e"
                  tickLine={false}
                  axisLine={false}
                  width={110}
                  tick={{ fontSize: 13, fontWeight: 500 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(46, 134, 193, 0.08)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgba(213, 216, 220, 0.8)",
                    boxShadow: "0 10px 28px rgba(28, 40, 51, 0.08)",
                    fontSize: 12
                  }}
                  formatter={(value: number, _name, payload) => {
                    const bucket = payload?.payload as ReportStatusBucket | undefined;
                    return [
                      `${value} bản ghi · ${formatVNDShort(bucket?.totalValue ?? 0)}`,
                      bucket?.label ?? ""
                    ];
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 6, 6]}>
                  {items.map((item, index) => (
                    <Cell key={item.key} fill={colors[index % colors.length]} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    formatter={(value: number) => `${value}`}
                    style={{ fill: "#1c2833", fontSize: 12, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-2 border-t border-border/40 pt-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item, index) => (
              <div
                className="flex items-center justify-between rounded-xl bg-bg-hover/70 px-3 py-2"
                key={item.key}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <span className="text-sm font-medium text-text-primary">{item.label}</span>
                </div>
                <span className="text-xs font-semibold text-text-secondary">
                  {item.count} · <CurrencyDisplay amount={item.totalValue} short />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
