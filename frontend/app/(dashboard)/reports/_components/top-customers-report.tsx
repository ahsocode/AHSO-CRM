import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatVNDShort } from "@/lib/format";
import { ReportTopCustomer, ReportsOverview } from "@/lib/types";

export function TopCustomersReport({
  customers,
  overview,
  isLoading
}: {
  customers?: ReportTopCustomer[];
  overview?: ReportsOverview;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <LoadingSkeleton className="h-[360px] w-full" />
        <LoadingSkeleton className="h-[360px] w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Top Customers</p>
          <CardTitle>Khách hàng mang tiền về</CardTitle>
        </CardHeader>
        <CardContent>
          {(customers ?? []).length > 0 ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={customers}
                  layout="vertical"
                  margin={{ top: 8, right: 72, bottom: 8, left: 8 }}
                  barCategoryGap={12}
                >
                  <CartesianGrid stroke="rgba(213,216,220,0.8)" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => formatVNDShort(Number(value))}
                    stroke="#5d6d7e"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 13 }}
                    stroke="#5d6d7e"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(46,134,193,0.08)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(213,216,220,0.8)",
                      fontSize: 12
                    }}
                    formatter={(value: number) => formatVNDShort(Number(value))}
                  />
                  <Bar dataKey="paidAmount" fill="#1a5276" radius={[0, 6, 6, 0]}>
                    <LabelList
                      dataKey="paidAmount"
                      position="right"
                      formatter={(value: number) => formatVNDShort(value)}
                      style={{ fill: "#1c2833", fontSize: 11, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-white/60 px-4 py-6 text-center text-sm text-text-muted">
              Chưa có dữ liệu top customer cho khoảng thời gian đang chọn.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Recent Collections</p>
          <CardTitle>Thu tiền gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          {(overview?.recentPayments ?? []).length > 0 ? (
            <ul>
              {overview?.recentPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between border-b border-border/40 py-2.5 last:border-0"
                >
                  <div className="flex min-w-0 items-center">
                    <span className="w-20 shrink-0 text-xs text-text-muted">{formatDate(payment.paidAt)}</span>
                    <span className="ml-3 truncate text-sm font-medium text-text-primary">
                      {payment.customerName}
                    </span>
                    <span className="ml-1 shrink-0 text-xs text-text-secondary">· {payment.contractNo}</span>
                  </div>
                  <CurrencyDisplay
                    amount={payment.amount}
                    short
                    className="ml-4 shrink-0 text-sm font-bold text-text-primary"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-white/60 px-4 py-6 text-center text-sm text-text-muted">
              Chưa có payment nào trong khoảng báo cáo hiện tại.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
