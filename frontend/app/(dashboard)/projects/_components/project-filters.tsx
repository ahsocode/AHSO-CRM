"use client";

import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Priority, ProjectStatus, UserListItem } from "@/lib/types";

export function ProjectFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  assignedToId,
  onAssignedToIdChange,
  onReset,
  canReset,
  users,
  usersUnavailable
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: ProjectStatus | "";
  onStatusChange: (value: ProjectStatus | "") => void;
  priority: Priority | "";
  onPriorityChange: (value: Priority | "") => void;
  assignedToId: string;
  onAssignedToIdChange: (value: string) => void;
  onReset: () => void;
  canReset: boolean;
  users: UserListItem[];
  usersUnavailable: boolean;
}) {
  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="industrial-chip bg-primary/10 text-primary">Pipeline Filter</p>
        <CardTitle>Bộ lọc dự án</CardTitle>
        <p className="text-sm text-text-secondary">
          Lọc nhanh theo trạng thái pipeline, độ ưu tiên và người phụ trách phía customer owner.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Tìm kiếm</span>
            <div className="relative">
              <AppIcon
                name="search"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              />
              <Input
                className="pl-11"
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Mã dự án, tên dự án hoặc khách hàng..."
                value={search}
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Trạng thái</span>
            <Select value={status} onChange={(event) => onStatusChange(event.target.value as ProjectStatus | "")}>
              <option value="">Tất cả trạng thái</option>
              <option value="SURVEY">Khảo sát</option>
              <option value="QUOTING">Báo giá</option>
              <option value="NEGOTIATING">Đàm phán</option>
              <option value="WON">Đã thắng</option>
              <option value="LOST">Thất bại</option>
              <option value="DELIVERING">Triển khai</option>
              <option value="COMPLETED">Hoàn thành</option>
            </Select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Ưu tiên</span>
            <Select value={priority} onChange={(event) => onPriorityChange(event.target.value as Priority | "")}>
              <option value="">Tất cả mức ưu tiên</option>
              <option value="LOW">Thấp</option>
              <option value="NORMAL">Chuẩn</option>
              <option value="HIGH">Cao</option>
            </Select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Phụ trách</span>
            <Select
              disabled={usersUnavailable}
              value={assignedToId}
              onChange={(event) => onAssignedToIdChange(event.target.value)}
            >
              <option value="">Tất cả nhân sự</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/60 pt-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-text-secondary">
            {usersUnavailable
              ? "Bộ lọc nhân sự không khả dụng với tài khoản hiện tại hoặc chưa tải được danh sách người dùng."
              : "Danh sách dự án đang lấy trực tiếp từ backend projects module."}
          </p>
          <Button disabled={!canReset} onClick={onReset} variant="ghost">
            Xóa bộ lọc
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
