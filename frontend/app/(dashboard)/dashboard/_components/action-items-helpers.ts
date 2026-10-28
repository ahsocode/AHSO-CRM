import { formatVNDShort } from "@/lib/format";
import type { DashboardActionItem } from "@/lib/types";

export const ACTION_KIND_CONFIG = {
  PROJECT: { label: "Dự án trễ hạn", icon: "factory", base: "/projects" },
  CONTRACT: { label: "Công nợ", icon: "contract", base: "/contracts" },
  ACTIVITY: { label: "Công việc", icon: "calendar", base: "/activities" },
  QUOTE: { label: "Báo giá nháp", icon: "description", base: "/quotes" }
} as const;

export function getActionItemHref(item: Pick<DashboardActionItem, "kind" | "id">): string {
  return `${ACTION_KIND_CONFIG[item.kind].base}/${item.id}`;
}

/** Text badge (never colour alone): overdue items say "Trễ N ngày", waiting items say "N ngày". */
export function getActionItemBadge(item: Pick<DashboardActionItem, "overdue" | "ageDays" | "amount" | "kind">): string {
  if (item.kind === "CONTRACT" && item.amount !== null) {
    return `Còn ${formatVNDShort(item.amount)}`;
  }
  if (item.ageDays <= 0) {
    return item.overdue ? "Trễ hôm nay" : "Hôm nay";
  }
  return item.overdue ? `Trễ ${item.ageDays} ngày` : `${item.ageDays} ngày`;
}

/** Revenue bar label: empty for zero/invalid so the chart is not cluttered. */
export function formatBarLabel(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount !== 0 ? formatVNDShort(amount) : "";
}

export function summarizeRevenue(points: Array<{ month: string; revenue: number }>): string {
  const filled = points.filter((point) => point.revenue > 0);
  if (filled.length === 0) return "Chưa có doanh thu trong kỳ.";
  return `Doanh thu theo tháng: ${filled.map((point) => `${point.month} ${formatVNDShort(point.revenue)}`).join(", ")}.`;
}
