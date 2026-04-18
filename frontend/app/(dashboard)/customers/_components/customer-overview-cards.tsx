import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { CustomerListMeta } from "@/lib/types";

export function CustomerOverviewCards({
  meta,
  isLoading
}: {
  meta?: CustomerListMeta;
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
      label: "Doanh thu quý đang lọc",
      value: <CurrencyDisplay amount={meta?.summary.quarterlyRevenue ?? 0} short />,
      helper: "Tổng thanh toán gắn với tập khách hàng hiện tại"
    },
    {
      label: "Khách mới 30 ngày",
      value: meta?.summary.newCustomersLast30Days ?? 0,
      helper: "Dùng để theo dõi nhịp mở rộng danh mục"
    },
    {
      label: "Tỷ lệ duy trì",
      value: `${meta?.summary.retentionRate ?? 0}%`,
      helper: "Tỷ lệ khách đang ở trạng thái hoạt động"
    },
    {
      label: "Tổng khách hàng",
      value: meta?.total ?? 0,
      helper: `Trang ${meta?.page ?? 1}/${meta?.totalPages ?? 1}`
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
