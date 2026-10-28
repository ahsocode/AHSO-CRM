import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuoteKpiKey } from "@/lib/quote-list";
import { QuoteListMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

const CARD_CONFIG = [
  {
    key: "all",
    valueKey: "totalValue",
    label: "Tổng giá trị",
    description: "Tổng giá trị báo giá theo tìm kiếm/dự án hiện tại. Bấm để bỏ lọc trạng thái."
  },
  {
    key: "draft",
    valueKey: "draftCount",
    label: "Bản nháp",
    description: "Số báo giá còn ở draft cần hoàn thiện trước khi gửi. Bấm để lọc."
  },
  {
    key: "sent",
    valueKey: "sentCount",
    label: "Đã gửi",
    description: "Những báo giá đã ra ngoài và đang chờ phản hồi. Bấm để lọc."
  },
  {
    key: "expiring",
    valueKey: "expiringSoonCount",
    label: "Sắp hết hạn",
    description: "Báo giá còn hiệu lực nhưng sắp chạm ngày hết hạn. Bấm để lọc."
  }
] as const;

export function QuoteOverviewCards({
  meta,
  isLoading,
  active,
  onSelect
}: {
  meta?: QuoteListMeta;
  isLoading: boolean;
  active: QuoteKpiKey | null;
  onSelect: (key: QuoteKpiKey) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {CARD_CONFIG.map((card) => {
        const value =
          card.valueKey === "totalValue" ? (
            <CurrencyDisplay amount={meta?.summary.totalValue ?? 0} short />
          ) : (
            `${meta?.summary[card.valueKey] ?? 0}`
          );
        const isActive = active === card.key;

        return (
          <button
            key={card.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(card.key)}
            className="rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Card
              className={cn(
                "h-full border border-white/70 transition-colors hover:border-primary/40",
                isActive && "border-primary bg-primary/5 ring-2 ring-primary/40"
              )}
            >
              <CardHeader className="mb-0 gap-2">
                <CardTitle>{card.label}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <LoadingSkeleton className="h-9 w-28" />
                ) : (
                  <div className="font-heading text-3xl font-extrabold text-text-primary">{value}</div>
                )}
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
