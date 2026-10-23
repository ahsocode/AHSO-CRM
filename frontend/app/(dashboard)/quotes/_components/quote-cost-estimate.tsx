import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND } from "@/lib/format";
import type { QuoteDetail } from "@/lib/types";

export function QuoteCostEstimate({ quote }: { quote: QuoteDetail }) {
  const estimate = quote.costEstimate;
  if (!estimate) return null;

  return (
    <Card className="border-0 bg-bg-subtle print:hidden" data-testid="quote-cost-estimate">
      <CardHeader className="mb-0 gap-2">
        <CardTitle>Giá vốn dự kiến · Lãi gộp dự kiến</CardTitle>
        <p className="text-sm text-text-secondary">Nội bộ — không in ra báo giá</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <EstimateMetric label="Giá vốn dự kiến" value={formatVND(estimate.cost)} />
          <EstimateMetric label="Lãi gộp dự kiến" value={formatVND(estimate.margin)} />
          <EstimateMetric label="Tỷ suất lãi gộp dự kiến" value={formatPercent(estimate.marginPct)} />
        </div>
        {!estimate.isComplete ? (
          <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
            Đã gắn BOM cho {estimate.coveredItemCount}/{estimate.itemCount} hạng mục.
            Giá vốn và lãi gộp chỉ tính các hạng mục đã gắn BOM, theo doanh thu trước VAT.
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="px-3 py-2">Hạng mục / BOM</th>
                <th className="px-3 py-2 text-right">Giá vốn dự kiến</th>
                <th className="px-3 py-2 text-right">Lãi gộp dự kiến</th>
                <th className="px-3 py-2 text-right">Tỷ suất lãi gộp</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.filter((item) => item.costEstimate).map((item) => (
                <tr key={item.id} className="bg-bg-card">
                  <td className="rounded-l-lg px-3 py-2">
                    <p className="font-semibold text-text-primary">{item.name}</p>
                    {item.bom ? <p className="text-xs text-text-secondary">{item.bom.code} · {item.bom.name} · v{item.bom.version}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatVND(item.costEstimate!.cost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatVND(item.costEstimate!.margin)}</td>
                  <td className="rounded-r-lg px-3 py-2 text-right tabular-nums">{formatPercent(item.costEstimate!.marginPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function EstimateMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg-card px-4 py-3">
      <p className="text-xs font-semibold text-text-secondary">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">{value}</p>
    </div>
  );
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)}%`;
}
