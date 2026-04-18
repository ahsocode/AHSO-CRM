import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuoteListMeta } from "@/lib/types";

const CARD_CONFIG = [
  {
    key: "totalValue",
    label: "Tổng giá trị",
    description: "Tổng pipeline báo giá đang nhìn thấy theo bộ lọc hiện tại."
  },
  {
    key: "draftCount",
    label: "Bản nháp",
    description: "Số báo giá còn ở draft cần hoàn thiện trước khi gửi."
  },
  {
    key: "sentCount",
    label: "Đã gửi",
    description: "Những báo giá đã ra ngoài và đang chờ phản hồi."
  },
  {
    key: "expiringSoonCount",
    label: "Sắp hết hạn",
    description: "Báo giá còn hiệu lực nhưng sắp chạm ngày hết hạn."
  }
] as const;

export function QuoteOverviewCards({
  meta,
  isLoading
}: {
  meta?: QuoteListMeta;
  isLoading: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {CARD_CONFIG.map((card) => {
        const value =
          card.key === "totalValue" ? (
            <CurrencyDisplay amount={meta?.summary.totalValue ?? 0} short />
          ) : (
            `${meta?.summary[card.key] ?? 0}`
          );

        return (
          <Card key={card.key} className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-primary/10 text-primary">Quote Signal</p>
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
        );
      })}
    </div>
  );
}
