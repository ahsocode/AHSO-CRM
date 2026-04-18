import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
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
      helper: "Số activity trong khoảng ngày đang lọc"
    },
    {
      label: "Cần xử lý",
      value: meta?.summary.openCount ?? 0,
      helper: "Các việc chưa hoàn tất"
    },
    {
      label: "Đã hoàn tất",
      value: meta?.summary.completedCount ?? 0,
      helper: "Những việc đã được đánh dấu xong"
    },
    {
      label: "Quá hạn",
      value: meta?.summary.overdueCount ?? 0,
      helper: `${meta?.summary.todayCount ?? 0} việc rơi vào hôm nay`
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
