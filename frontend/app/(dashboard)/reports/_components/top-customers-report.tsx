import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
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
      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <LoadingSkeleton className="h-[420px] w-full" />
        <LoadingSkeleton className="h-[420px] w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Top Customers</p>
          <CardTitle>Khách hàng mang tiền về</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(customers ?? []).length > 0 ? (
            customers?.map((customer, index) => (
              <article key={customer.customerId} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                      Top {index + 1}
                    </p>
                    <p className="mt-2 font-semibold text-text-primary">{customer.name}</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {customer.projectCount} dự án · giá trị HĐ <CurrencyDisplay amount={customer.contractValue} short />
                    </p>
                  </div>
                  <p className="font-heading text-2xl font-extrabold text-text-primary">
                    <CurrencyDisplay amount={customer.paidAmount} short />
                  </p>
                </div>
              </article>
            ))
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
        <CardContent className="space-y-4">
          {(overview?.recentPayments ?? []).length > 0 ? (
            overview?.recentPayments.map((payment) => (
              <article key={payment.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-text-primary">{payment.customerName}</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {payment.contractNo} · {payment.projectName}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {payment.method ?? "Chưa rõ phương thức"}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-2xl font-extrabold text-text-primary">
                      <CurrencyDisplay amount={payment.amount} short />
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">{formatDate(payment.paidAt)}</p>
                  </div>
                </div>
              </article>
            ))
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
