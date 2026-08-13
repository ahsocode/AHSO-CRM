"use client";

import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Select } from "@/components/ui/select";
import { CustomerStatus, UserListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export type VipFilterValue = "all" | "vip" | "standard";

const STATUS_OPTIONS: Array<{ label: string; value: CustomerStatus }> = [
  { label: "Tiềm năng", value: "LEAD" },
  { label: "Đang quan tâm", value: "PROSPECT" },
  { label: "Hoạt động", value: "ACTIVE" },
  { label: "Không hoạt động", value: "INACTIVE" }
];

export function CustomerFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  industry,
  onIndustryChange,
  assignedToId,
  onAssignedToIdChange,
  vipFilter,
  onVipFilterChange,
  onReset,
  canReset,
  users,
  usersUnavailable
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: CustomerStatus | "";
  onStatusChange: (value: CustomerStatus | "") => void;
  industry: string;
  onIndustryChange: (value: string) => void;
  assignedToId: string;
  onAssignedToIdChange: (value: string) => void;
  vipFilter: VipFilterValue;
  onVipFilterChange: (value: VipFilterValue) => void;
  onReset: () => void;
  canReset: boolean;
  users: UserListItem[];
  usersUnavailable: boolean;
}) {
  return (
    <CompactFilterToolbar
      canReset={canReset}
      onReset={onReset}
      onSearchChange={onSearchChange}
      searchAriaLabel="Tìm kiếm khách hàng"
      searchClassName="xl:max-w-[230px]"
      searchPlaceholder="Tên công ty, MST, email..."
      searchValue={search}
    >
      <label className="w-[112px]">
        <span className="sr-only">Trạng thái</span>
        <Select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as CustomerStatus | "")}
          className="h-9 rounded-lg bg-white text-[12.5px]"
        >
          <option value="">Trạng thái</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="w-[100px]">
        <span className="sr-only">Ngành hàng</span>
        <input
          value={industry}
          onChange={(event) => onIndustryChange(event.target.value)}
          className="flex h-9 w-full rounded-lg border border-border bg-white px-4 py-2 text-[12.5px] text-text-primary outline-none transition focus:border-border-focus focus:ring-2 focus:ring-info/15"
          placeholder="Ngành"
        />
      </label>

      <label className="w-[112px]">
        <span className="sr-only">Phụ trách</span>
        <Select
          value={assignedToId}
          onChange={(event) => onAssignedToIdChange(event.target.value)}
          disabled={usersUnavailable}
          className="h-9 rounded-lg bg-white text-[12.5px]"
        >
          <option value="">Phụ trách</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
      </label>

      <button
        type="button"
        className={cn("v2-chip h-9 whitespace-nowrap rounded-lg px-3", vipFilter === "vip" && "border-accent bg-accent-bg text-accent")}
        onClick={() => onVipFilterChange(vipFilter === "vip" ? "all" : "vip")}
      >
        VIP
      </button>
    </CompactFilterToolbar>
  );
}
