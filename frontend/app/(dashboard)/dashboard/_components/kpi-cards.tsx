import { Card } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { DashboardKpis } from "@/lib/types";

export function KpiCards({
  data,
  isLoading
}: {
  data?: DashboardKpis;
  isLoading: boolean;
}) {
  if (isLoading || !data) {
    return (
      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="space-y-4 p-5">
            <LoadingSkeleton className="h-4 w-32" />
            <LoadingSkeleton className="h-8 w-28" />
            <LoadingSkeleton className="h-4 w-36" />
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Doanh số tháng này",
      value: <CurrencyDisplay amount={data.monthlyRevenue.value} short />,
      hint: `${data.monthlyRevenue.changePercent >= 0 ? "+" : ""}${data.monthlyRevenue.changePercent}% so với tháng trước`,
      tone: "text-primary"
    },
    {
      label: "Dự án đang chạy",
      value: `${data.activeProjects.value} dự án`,
      hint: "Bao gồm khảo sát, báo giá, đàm phán và triển khai",
      tone: "text-info"
    },
    {
      label: "Báo giá chờ xử lý",
      value: `${data.pendingQuotes.value} báo giá`,
      hint: `Giá trị ${data.pendingQuotes.totalValue.toLocaleString("vi-VN")} ₫`,
      tone: "text-accent"
    },
    {
      label: "Công nợ chưa thu",
      value: <CurrencyDisplay amount={data.outstandingDebt.value} short />,
      hint: `${data.outstandingDebt.overdueCustomers} hợp đồng còn số dư`,
      tone: "text-danger"
    }
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {cards.map((card) => (
        <Card className="metric-sheen noise-edge p-5" key={card.label}>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-text-muted">{card.label}</p>
          <div className={`mt-3 text-2xl font-extrabold ${card.tone}`}>{card.value}</div>
          <p className="mt-3 text-sm text-text-secondary">{card.hint}</p>
        </Card>
      ))}
    </div>
  );
}

