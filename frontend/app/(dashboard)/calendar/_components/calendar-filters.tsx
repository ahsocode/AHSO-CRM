import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { ActivityType, UserListItem } from "@/lib/types";
import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Input } from "@/components/ui/input";
import {
  SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function parseSearchAsDate(value: string): string | null {
  // Try YYYY-MM-DD format (exact date picker format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  // Try DD/MM/YYYY format
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

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
  const handleSearchChange = (value: string) => {
    onSearchChange(value);
    // Auto-detect date format and jump if matches
    const detectedDate = parseSearchAsDate(value);
    if (detectedDate) {
      onJumpToDate?.(detectedDate);
    }
  };

  return (
    <CompactFilterToolbar
      canReset={canReset}
      onReset={onReset}
      onSearchChange={handleSearchChange}
      searchAriaLabel="Tìm kiếm lịch công việc"
      searchId="calendar-search"
      searchPlaceholder="Tiêu đề, khách hàng, dự án hoặc ngày..."
      searchValue={search}
    >
      <Input
        aria-label="Từ ngày"
        className="h-9 w-[132px] rounded-lg bg-white text-[12.5px]"
        id="calendar-date-from"
        type="date"
        value={dateFrom}
        onChange={(event) => onDateFromChange(event.target.value)}
      />

      <Input
        aria-label="Đến ngày"
        className="h-9 w-[132px] rounded-lg bg-white text-[12.5px]"
        id="calendar-date-to"
        type="date"
        value={dateTo}
        onChange={(event) => onDateToChange(event.target.value)}
      />

      <div className="w-[132px]">
        <SelectRoot
          value={type || "all"}
          onValueChange={(value) => onTypeChange(value === "all" ? "" : (value as ActivityType))}
        >
          <SelectTrigger aria-label="Loại việc" className="h-9 rounded-lg bg-white text-[12.5px]">
            <SelectValue placeholder="Loại việc" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Loại việc</SelectItem>
            {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      </div>

      <div className="w-[132px]">
        <SelectRoot
          value={completion}
          onValueChange={(value) => onCompletionChange(value as "all" | "open" | "completed")}
        >
          <SelectTrigger aria-label="Trạng thái" className="h-9 rounded-lg bg-white text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Trạng thái</SelectItem>
            <SelectItem value="open">Chưa hoàn tất</SelectItem>
            <SelectItem value="completed">Đã hoàn tất</SelectItem>
          </SelectContent>
        </SelectRoot>
      </div>

      {canFilterAssignee ? (
        <div className="w-[150px]">
          <SelectRoot
            disabled={assigneesUnavailable}
            value={assigneeId || "all"}
            onValueChange={(value) => onAssigneeIdChange(value === "all" ? "" : value)}
          >
            <SelectTrigger aria-label="Người phụ trách" className="h-9 rounded-lg bg-white text-[12.5px]">
              <SelectValue placeholder={assigneesUnavailable ? "Không tải được user" : "Phụ trách"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{assigneesUnavailable ? "Không tải được user" : "Phụ trách"}</SelectItem>
              {assignees.map((assignee) => (
                <SelectItem key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        </div>
      ) : null}
    </CompactFilterToolbar>
  );
}
