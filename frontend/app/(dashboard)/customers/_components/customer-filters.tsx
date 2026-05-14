"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { AppIcon } from "@/components/shared/app-icon";
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
    <Card className="border border-white/70 p-0">
      <CardContent className="space-y-3 p-4">
        <div className="relative">
          <AppIcon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            aria-label="Tìm kiếm khách hàng"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 rounded-lg border-border pl-10 text-[13.5px]"
            placeholder="Tìm theo tên công ty, mã số thuế, email..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-[180px]">
            <span className="sr-only">Trạng thái</span>
            <Select
              value={status}
              onChange={(event) => onStatusChange(event.target.value as CustomerStatus | "")}
              className="h-9 rounded-full text-[12.5px]"
            >
              <option value="">Trạng thái: Tất cả</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Trạng thái: {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="min-w-[170px]">
            <span className="sr-only">Ngành hàng</span>
            <div className="relative">
              <Input
                value={industry}
                onChange={(event) => onIndustryChange(event.target.value)}
                className="h-9 rounded-full text-[12.5px]"
                placeholder="Ngành: Tất cả"
              />
            </div>
          </label>

          <label className="min-w-[180px]">
            <span className="sr-only">Phụ trách</span>
            <Select
              value={assignedToId}
              onChange={(event) => onAssignedToIdChange(event.target.value)}
              disabled={usersUnavailable}
              className="h-9 rounded-full text-[12.5px]"
            >
              <option value="">Phụ trách: Tất cả</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  Phụ trách: {user.name}
                </option>
              ))}
            </Select>
          </label>

          <button
            type="button"
            className={cn("v2-chip", vipFilter === "vip" && "border-accent bg-accent-bg text-accent")}
            onClick={() => onVipFilterChange(vipFilter === "vip" ? "all" : "vip")}
          >
            ★ VIP
          </button>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-text-muted md:inline">
              {usersUnavailable
                ? "Bộ lọc nhân sự không khả dụng."
                : "Danh sách cập nhật theo dữ liệu customers/contacts."}
            </span>
            <Button variant="ghost" onClick={onReset} disabled={!canReset}>
              Xóa bộ lọc
            </Button>
          </div>
        </div>

        {usersUnavailable ? (
          <p className="text-xs text-text-muted">
            {usersUnavailable
              ? "Bộ lọc nhân sự không khả dụng với tài khoản hiện tại hoặc chưa tải được danh sách người dùng."
              : "Danh sách được cập nhật theo thời gian thực từ backend customers/contacts."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
