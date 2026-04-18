"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppIcon } from "@/components/shared/app-icon";
import { CustomerStatus, UserListItem } from "@/lib/types";

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
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="industrial-chip bg-primary/10 text-primary">Filter Workspace</p>
        <CardTitle>Bộ lọc khách hàng</CardTitle>
        <p className="text-sm text-text-secondary">
          Kết hợp tìm kiếm nhanh, phân công phụ trách và mức ưu tiên để đọc đúng danh sách cần xử lý.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1.45fr_repeat(4,minmax(0,1fr))]">
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Tìm kiếm</span>
            <div className="relative">
              <AppIcon
                name="search"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              />
              <Input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                className="pl-11"
                placeholder="Tên công ty, MST, email, điện thoại..."
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Trạng thái</span>
            <Select
              value={status}
              onChange={(event) => onStatusChange(event.target.value as CustomerStatus | "")}
            >
              <option value="">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Ngành hàng</span>
            <Input
              value={industry}
              onChange={(event) => onIndustryChange(event.target.value)}
              placeholder="Ví dụ: Y tế, Thực phẩm..."
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Phụ trách</span>
            <Select
              value={assignedToId}
              onChange={(event) => onAssignedToIdChange(event.target.value)}
              disabled={usersUnavailable}
            >
              <option value="">Tất cả nhân sự</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Nhóm ưu tiên</span>
            <Select
              value={vipFilter}
              onChange={(event) => onVipFilterChange(event.target.value as VipFilterValue)}
            >
              <option value="all">Tất cả khách hàng</option>
              <option value="vip">Chỉ VIP</option>
              <option value="standard">Chuẩn</option>
            </Select>
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/60 pt-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-text-secondary">
            {usersUnavailable
              ? "Bộ lọc nhân sự không khả dụng với tài khoản hiện tại hoặc chưa tải được danh sách người dùng."
              : "Danh sách được cập nhật theo thời gian thực từ backend customers/contacts."}
          </p>
          <Button variant="ghost" onClick={onReset} disabled={!canReset}>
            Xóa bộ lọc
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
