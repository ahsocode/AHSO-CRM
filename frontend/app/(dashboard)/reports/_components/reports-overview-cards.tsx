import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { V2MetricCard } from "@/components/shared/composite-cards";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ReportsOverview } from "@/lib/types";

export function ReportsOverviewCards({
  data,
  isLoading
}: {
  data?: ReportsOverview;
  isLoading: boolean;
}) {
  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="metric-sheen noise-edge border border-white/70">
            <CardHeader>
              <LoadingSkeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent className="space-y-3">
              <LoadingSkeleton className="h-8 w-24" />
              <LoadingSkeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Thu tiền theo kỳ",
      value: <CurrencyDisplay amount={data.collectionsValue} short />,
      helper: "Tổng payment ghi nhận trong khoảng tháng đang xem",
      tone: "primary" as const
    },
    {
      label: "Pipeline mở",
      value: <CurrencyDisplay amount={data.openPipelineValue} short />,
      helper: "Estimated value của các project chưa đóng",
      tone: "info" as const
    },
    {
      label: "Công nợ còn lại",
      value: <CurrencyDisplay amount={data.outstandingDebt} short />,
      helper: "Giá trị hợp đồng chưa thu đủ",
      tone: "danger" as const
    },
    {
      label: "Tỷ lệ chốt quote",
      value: `${data.quoteAcceptanceRate}%`,
      helper: "Accepted / quote đã phát hành trong kỳ",
      tone: "accent" as const
    },
    {
      label: "HĐ hiệu lực",
      value: data.activeContracts,
      helper: "Số hợp đồng đang còn hiệu lực",
      tone: "success" as const
    },
    {
      label: "KH hoạt động",
      value: data.activeCustomers,
      helper: "Số khách hàng trạng thái ACTIVE",
      tone: "primary" as const
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <V2MetricCard key={card.label} label={card.label} value={card.value} hint={card.helper} tone={card.tone} />
      ))}
    </div>
  );
}
