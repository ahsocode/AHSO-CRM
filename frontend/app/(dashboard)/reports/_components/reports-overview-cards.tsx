import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
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
      helper: "Tổng payment ghi nhận trong khoảng tháng đang xem"
    },
    {
      label: "Pipeline mở",
      value: <CurrencyDisplay amount={data.openPipelineValue} short />,
      helper: "Estimated value của các project chưa đóng"
    },
    {
      label: "Công nợ còn lại",
      value: <CurrencyDisplay amount={data.outstandingDebt} short />,
      helper: "Giá trị hợp đồng chưa thu đủ"
    },
    {
      label: "Tỷ lệ chốt quote",
      value: `${data.quoteAcceptanceRate}%`,
      helper: "Accepted / tổng quote trong kỳ"
    },
    {
      label: "HĐ hiệu lực",
      value: data.activeContracts,
      helper: "Số hợp đồng đang còn hiệu lực"
    },
    {
      label: "KH hoạt động",
      value: data.activeCustomers,
      helper: "Số khách hàng trạng thái ACTIVE"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label} className="metric-sheen noise-edge border border-white/70">
          <CardHeader className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary">{card.label}</p>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-extrabold text-text-primary">{card.value}</p>
            <p className="mt-2 text-sm text-text-secondary">{card.helper}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
