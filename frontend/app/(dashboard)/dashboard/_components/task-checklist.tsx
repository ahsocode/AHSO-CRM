import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { formatTime } from "@/lib/format";
import { DashboardTask } from "@/lib/types";

export function TaskChecklist({
  data,
  isLoading
}: {
  data?: DashboardTask[];
  isLoading: boolean;
}) {
  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Công việc hôm nay</p>
        <div className="flex items-center gap-2">
          <CardTitle>Việc cần làm</CardTitle>
          {data && data.length > 0 ? (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">
              {data.length}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <LoadingSkeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : data.length > 0 ? (
          <ul>
            {data.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 border-b border-border/30 py-2.5 last:border-0"
              >
                <span className="w-14 shrink-0 rounded-lg bg-primary-bg px-1.5 py-1 text-center text-xs font-semibold text-primary">
                  {formatTime(task.scheduledAt)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                  {task.title}
                </span>
                <span className="ml-auto max-w-[120px] shrink-0 truncate text-xs text-text-muted">
                  {task.customerName}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-white/60 px-4 py-6 text-center text-sm text-text-muted">
            Hôm nay chưa có việc nào được lên lịch.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
