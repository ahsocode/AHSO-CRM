import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { formatDate, formatTime } from "@/lib/format";
import { RecentActivityItem } from "@/lib/types";

const LEADING_EMOJI = /^\p{Extended_Pictographic}\s*/u;

// "dd/MM HH:mm" on a single line (drops the year from formatDate)
function formatShortDateTime(value: string) {
  const day = formatDate(value).split("/").slice(0, 2).join("/");
  return `${day} ${formatTime(value)}`;
}

export function ActivityFeed({
  data,
  isLoading
}: {
  data?: RecentActivityItem[];
  isLoading: boolean;
}) {
  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Nhịp nội bộ</p>
        <CardTitle>Hoạt động gần đây</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <LoadingSkeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <ul>
            {data.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-lg px-2 py-2 even:bg-bg-subtle/70"
              >
                <span className="w-[88px] shrink-0 whitespace-nowrap pt-0.5 text-[11px] leading-tight text-text-muted">
                  {formatShortDateTime(item.createdAt)}
                </span>
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{item.title.replace(LEADING_EMOJI, "")}</p>
                  <p className="truncate text-xs text-text-muted">
                    {item.userName}
                    {item.customerName ? ` · ${item.customerName}` : ""}
                    {item.projectName ? ` · ${item.projectName}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
