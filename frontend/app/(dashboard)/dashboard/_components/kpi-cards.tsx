import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { V2MetricCard } from "@/components/shared/composite-cards";
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
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="px-4 py-3 md:px-5 md:py-4">
              <LoadingSkeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-2 px-4 py-3 md:space-y-3 md:px-5 md:py-4">
              <LoadingSkeleton className="h-8 w-28" />
              <LoadingSkeleton className="h-4 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Doanh số tháng",
      value: <CurrencyDisplay amount={data.monthlyRevenue.value} short />,
      hint: `${data.monthlyRevenue.changePercent >= 0 ? "+" : ""}${data.monthlyRevenue.changePercent}% tháng trước`,
      tone: "primary" as const
    },
    {
      label: "Dự án đang chạy",
      value: `${data.activeProjects.value} dự án`,
      hint: "Khảo sát → triển khai",
      tone: "info" as const
    },
    {
      label: "Báo giá chờ",
      value: `${data.pendingQuotes.value} báo giá`,
      hint: <CurrencyDisplay amount={data.pendingQuotes.totalValue} short />,
      tone: "accent" as const
    },
    {
      label: "Công nợ",
      value: <CurrencyDisplay amount={data.outstandingDebt.value} short />,
      hint: `${data.outstandingDebt.overdueCustomers} hợp đồng`,
      tone: "danger" as const
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
      {cards.map((card) => (
        <V2MetricCard
          key={card.label}
          label={card.label}
          value={card.value}
          hint={card.hint}
          tone={card.tone}
          className="px-4 py-3 md:px-5 md:py-4"
        />
      ))}
    </div>
  );
}
