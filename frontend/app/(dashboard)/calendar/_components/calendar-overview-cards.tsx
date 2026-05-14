import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { V2MetricCard } from "@/components/shared/composite-cards";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CalendarListMeta } from "@/lib/types";

export function CalendarOverviewCards({
  meta,
  isLoading
}: {
  meta?: CalendarListMeta;
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
      label: "Tổng công việc",
      value: meta?.summary.total ?? 0,
      helper: "Số activity trong khoảng ngày đang lọc",
      tone: "primary" as const
    },
    {
      label: "Cần xử lý",
      value: meta?.summary.openCount ?? 0,
      helper: "Các việc chưa hoàn tất",
      tone: "accent" as const
    },
    {
      label: "Đã hoàn tất",
      value: meta?.summary.completedCount ?? 0,
      helper: "Những việc đã được đánh dấu xong",
      tone: "success" as const
    },
    {
      label: "Quá hạn",
      value: meta?.summary.overdueCount ?? 0,
      helper: `${meta?.summary.todayCount ?? 0} việc rơi vào hôm nay`,
      tone: "danger" as const
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
