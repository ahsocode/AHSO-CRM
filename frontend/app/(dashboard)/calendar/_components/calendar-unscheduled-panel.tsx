import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { CalendarListMeta } from "@/lib/types";

/**
 * "Chưa lên lịch": pending activities with no scheduledAt. They never match the
 * calendar's date range, so they are listed here (and counted in "Cần xử lý").
 */
export function CalendarUnscheduledPanel({ unscheduled }: { unscheduled?: CalendarListMeta["unscheduled"] }) {
  if (!unscheduled || unscheduled.total === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text-primary">
            Chưa lên lịch ({unscheduled.total})
          </h2>
          <Link href={"/activities" as Route} className="text-sm font-medium text-primary hover:underline">
            Xem tất cả
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {unscheduled.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <Badge variant="neutral">{ACTIVITY_TYPE_LABELS[item.type] ?? item.type}</Badge>
              <Link
                href={`/activities/${item.id}` as Route}
                className="min-w-0 flex-1 truncate font-medium text-text-primary hover:text-primary"
              >
                {item.title}
              </Link>
              <span className="text-text-secondary">
                {[item.customer?.name, item.project ? `${item.project.code} ${item.project.name}` : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
              <span className="text-text-secondary">{item.user.name}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
