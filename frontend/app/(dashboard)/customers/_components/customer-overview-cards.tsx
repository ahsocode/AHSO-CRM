import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { V2MetricCard } from "@/components/shared/composite-cards";
import { CustomerListItem, CustomerListMeta } from "@/lib/types";

export function CustomerOverviewCards({
  meta,
  items = [],
  isLoading
}: {
  meta?: CustomerListMeta;
  items?: CustomerListItem[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
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
      label: "Tổng khách hàng",
      value: meta?.total ?? 0,
      helper: `Trang ${meta?.page ?? 1}/${meta?.totalPages ?? 1}`,
      tone: "primary" as const
    },
    {
      label: "Khách mới 30 ngày",
      value: meta?.summary.newCustomersLast30Days ?? 0,
      helper: "Dùng để theo dõi nhịp mở rộng danh mục",
      tone: "info" as const
    },
    {
      label: "Tỷ lệ duy trì",
      value: `${meta?.summary.retentionRate ?? 0}%`,
      helper: "Tỷ lệ khách đang ở trạng thái hoạt động",
      tone: "success" as const
    },
    {
      label: "VIP trên trang",
      value: items.filter((customer) => customer.isVip).length,
      helper: "Khách ưu tiên trong trang hiện tại",
      tone: "accent" as const
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <V2MetricCard key={card.label} label={card.label} value={card.value} hint={card.helper} tone={card.tone} />
      ))}
    </div>
  );
}
