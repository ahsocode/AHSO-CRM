import Link from "next/link";
import { AppIcon } from "@/components/shared/app-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardActionItems } from "@/lib/types";
import {
  ACTION_KIND_CONFIG,
  getActionItemBadge,
  getActionItemHref
} from "./action-items-helpers";

export function PriorityActions({
  data,
  isLoading
}: {
  data?: DashboardActionItems;
  isLoading: boolean;
}) {
  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Ưu tiên xử lý</p>
        <div className="flex items-center gap-2">
          <CardTitle>Cần làm ngay</CardTitle>
          {data && data.items.length > 0 ? (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">
              {data.items.length}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <LoadingSkeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : data.items.length > 0 ? (
          <ul>
            {data.items.map((item) => {
              const config = ACTION_KIND_CONFIG[item.kind];
              return (
                <li key={`${item.kind}-${item.id}`} className="even:bg-bg-subtle/70 rounded-lg">
                  <Link
                    href={getActionItemHref(item)}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="inline-flex w-[104px] shrink-0 items-center gap-1.5 rounded-lg bg-primary-bg px-1.5 py-1 text-xs font-semibold text-primary">
                      <AppIcon name={config.icon} className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{config.label}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text-primary">{item.title}</span>
                      <span className="block truncate text-xs text-text-muted">{item.context}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.overdue ? "bg-danger-bg text-danger" : "bg-bg-hover text-text-secondary"
                      }`}
                    >
                      {getActionItemBadge(item)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="Không có việc tồn đọng"
            description="Không có báo giá nháp lâu, dự án trễ hạn, công nợ hay công việc chờ xử lý."
          />
        )}
      </CardContent>
    </Card>
  );
}
