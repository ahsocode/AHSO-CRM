import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { AppIcon } from "@/components/shared/app-icon";
import { formatDateTime } from "@/lib/format";
import { RecentActivityItem } from "@/lib/types";

export function ActivityFeed({
  data,
  isLoading
}: {
  data?: RecentActivityItem[];
  isLoading: boolean;
}) {
  return (
    <Card className="h-full p-6">
      <CardHeader className="mb-6">
        <CardTitle>Hoạt động gần đây</CardTitle>
        <CardDescription>Log tương tác và cập nhật nội bộ mới nhất từ các nhóm phụ trách.</CardDescription>
      </CardHeader>

      {isLoading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <LoadingSkeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((item) => (
            <div className="flex items-start gap-3 border-b border-border/50 pb-4 last:border-b-0 last:pb-0" key={item.id}>
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <AppIcon name="activity" className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <h4 className="font-semibold text-text-primary">{item.title}</h4>
                  <span className="text-xs text-text-secondary">{formatDateTime(item.createdAt)}</span>
                </div>
                {item.content ? <p className="mt-2 text-sm text-text-secondary">{item.content}</p> : null}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                  <span>{item.userName}</span>
                  {item.customerName ? <span>{item.customerName}</span> : null}
                  {item.projectName ? <span>{item.projectName}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

