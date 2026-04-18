import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { AppIcon } from "@/components/shared/app-icon";
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
    <Card className="h-full p-6">
      <CardHeader className="mb-6">
        <CardTitle>Việc cần làm hôm nay</CardTitle>
        <CardDescription>Các hoạt động được lên lịch trong ngày theo dữ liệu backend thật.</CardDescription>
      </CardHeader>

      {isLoading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <LoadingSkeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {data.length > 0 ? (
            data.map((task) => (
              <div className="flex items-start gap-3 rounded-2xl bg-bg-hover/70 p-4" key={task.id}>
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                  <AppIcon name="clock" className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary">{task.title}</p>
                  <p className="mt-1 text-sm text-text-secondary">{task.customerName}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-secondary">
                    <span>{task.assigneeName}</span>
                    <span>{formatTime(task.scheduledAt)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-white/60 px-4 py-6 text-center text-sm text-text-muted">
              Hôm nay chưa có việc nào được lên lịch.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

