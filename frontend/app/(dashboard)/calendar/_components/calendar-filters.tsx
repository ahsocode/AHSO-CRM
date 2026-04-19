import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { ActivityType, UserListItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CalendarFilters({
  search,
  dateFrom,
  dateTo,
  type,
  completion,
  assigneeId,
  assignees,
  assigneesUnavailable,
  canFilterAssignee,
  canReset,
  onSearchChange,
  onDateFromChange,
  onDateToChange,
  onTypeChange,
  onCompletionChange,
  onAssigneeIdChange,
  onReset,
  onJumpToDate,
}: {
  search: string;
  dateFrom: string;
  dateTo: string;
  type: ActivityType | "";
  completion: "all" | "open" | "completed";
  assigneeId: string;
  assignees: UserListItem[];
  assigneesUnavailable: boolean;
  canFilterAssignee: boolean;
  canReset: boolean;
  onSearchChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onTypeChange: (value: ActivityType | "") => void;
  onCompletionChange: (value: "all" | "open" | "completed") => void;
  onAssigneeIdChange: (value: string) => void;
  onReset: () => void;
  onJumpToDate?: (value: string) => void;
}) {
  return (
    <Card className="border border-white/70">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-text-primary">Nhảy tới ngày:</span>
          <input
            type="date"
            defaultValue={new Date().toISOString().split("T")[0]}
            onChange={(e) => onJumpToDate?.(e.target.value)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.1fr_170px_170px_170px_200px_auto]">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="calendar-search">
              Tìm kiếm
            </label>
            <Input
              id="calendar-search"
              placeholder="Tìm theo tiêu đề, khách hàng, dự án hoặc người phụ trách..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="calendar-date-from">
              Từ ngày
            </label>
            <Input id="calendar-date-from" type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="calendar-date-to">
              Đến ngày
            </label>
            <Input id="calendar-date-to" type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary">
              Loại việc
            </label>
            <SelectRoot
              value={type || "all"}
              onValueChange={(value) => onTypeChange(value === "all" ? "" : (value as ActivityType))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tất cả loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary">
              Trạng thái
            </label>
            <SelectRoot
              value={completion}
              onValueChange={(value) => onCompletionChange(value as "all" | "open" | "completed")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="open">Chưa hoàn tất</SelectItem>
                <SelectItem value="completed">Đã hoàn tất</SelectItem>
              </SelectContent>
            </SelectRoot>
          </div>

          {canFilterAssignee ? (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">
                Người phụ trách
              </label>
              <SelectRoot
                disabled={assigneesUnavailable}
                value={assigneeId || "all"}
                onValueChange={(value) => onAssigneeIdChange(value === "all" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={assigneesUnavailable ? "Không tải được user" : "Tất cả phụ trách"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{assigneesUnavailable ? "Không tải được user" : "Tất cả phụ trách"}</SelectItem>
                  {assignees.map((assignee) => (
                    <SelectItem key={assignee.id} value={assignee.id}>
                      {assignee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </div>
          ) : null}

          <div className="flex items-end">
            <Button className="w-full xl:w-auto" disabled={!canReset} onClick={onReset} type="button" variant="outline">
              Xóa bộ lọc
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
