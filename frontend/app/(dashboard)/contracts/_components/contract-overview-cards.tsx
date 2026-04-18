import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ContractListMeta } from "@/lib/types";

export function ContractOverviewCards({
  meta,
  isLoading
}: {
  meta?: ContractListMeta;
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
      label: "Tổng giá trị hợp đồng",
      value: <CurrencyDisplay amount={meta?.summary.totalValue ?? 0} short />,
      helper: "Tổng giá trị trên tập hợp đồng đang lọc"
    },
    {
      label: "Đang hiệu lực",
      value: meta?.summary.activeCount ?? 0,
      helper: "Các hợp đồng còn hiệu lực và đang theo dõi"
    },
    {
      label: "Đã hoàn tất",
      value: meta?.summary.completedCount ?? 0,
      helper: "Các hợp đồng đã đóng đủ tiến độ hoặc hoàn tất hồ sơ"
    },
    {
      label: "Công nợ còn lại",
      value: <CurrencyDisplay amount={meta?.summary.outstandingAmount ?? 0} short />,
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
