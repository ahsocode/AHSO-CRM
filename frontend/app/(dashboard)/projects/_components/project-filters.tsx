"use client";

import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  usersUnavailable,
  variant = "card"
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
  variant?: "card" | "ledger";
}) {
  if (variant === "ledger") {
    return (
      <CompactFilterToolbar
        canReset={canReset}
        onReset={onReset}
        onSearchChange={onSearchChange}
        searchAriaLabel="Tìm kiếm dự án"
        searchClassName="xl:max-w-[230px]"
        searchPlaceholder="Mã, tên dự án, khách hàng..."
        searchValue={search}
      >
        <label className="w-[112px]">
          <span className="sr-only">Trạng thái</span>
          <Select
            value={status}
            onChange={(event) => onStatusChange(event.target.value as ProjectStatus | "")}
            className="h-9 rounded-lg bg-white text-[12.5px]"
          >
            <option value="">Trạng thái</option>
            <option value="SURVEY">Khảo sát</option>
            <option value="QUOTING">Báo giá</option>
            <option value="NEGOTIATING">Đàm phán</option>
            <option value="WON">Đã thắng</option>
            <option value="LOST">Thất bại</option>
            <option value="DELIVERING">Triển khai</option>
            <option value="COMPLETED">Hoàn thành</option>
          </Select>
        </label>

        <label className="w-[96px]">
          <span className="sr-only">Ưu tiên</span>
          <Select
            value={priority}
            onChange={(event) => onPriorityChange(event.target.value as Priority | "")}
            className="h-9 rounded-lg bg-white text-[12.5px]"
          >
            <option value="">Ưu tiên</option>
            <option value="LOW">Thấp</option>
            <option value="NORMAL">Chuẩn</option>
            <option value="HIGH">Cao</option>
          </Select>
        </label>

        <label className="w-[112px]">
          <span className="sr-only">Phụ trách</span>
          <Select
            disabled={usersUnavailable}
            value={assignedToId}
            onChange={(event) => onAssignedToIdChange(event.target.value)}
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

      </CompactFilterToolbar>
    );
  }

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-1 pb-3">
        <p className="industrial-chip bg-primary/10 text-primary">Pipeline Filter</p>
        <CardTitle>Bộ lọc dự án</CardTitle>
      </CardHeader>
      <CardContent>
        <CompactFilterToolbar
          canReset={canReset}
          onReset={onReset}
          onSearchChange={onSearchChange}
          searchAriaLabel="Tìm kiếm dự án"
          searchPlaceholder="Mã dự án, tên dự án hoặc khách hàng..."
          searchValue={search}
        >
          <label className="w-[112px]">
            <span className="sr-only">Trạng thái</span>
            <Select
              value={status}
              onChange={(event) => onStatusChange(event.target.value as ProjectStatus | "")}
              className="h-9 rounded-lg bg-white text-[12.5px]"
            >
              <option value="">Trạng thái</option>
              <option value="SURVEY">Khảo sát</option>
              <option value="QUOTING">Báo giá</option>
              <option value="NEGOTIATING">Đàm phán</option>
              <option value="WON">Đã thắng</option>
              <option value="LOST">Thất bại</option>
              <option value="DELIVERING">Triển khai</option>
              <option value="COMPLETED">Hoàn thành</option>
            </Select>
          </label>

          <label className="w-[96px]">
            <span className="sr-only">Ưu tiên</span>
            <Select
              value={priority}
              onChange={(event) => onPriorityChange(event.target.value as Priority | "")}
              className="h-9 rounded-lg bg-white text-[12.5px]"
            >
              <option value="">Ưu tiên</option>
              <option value="LOW">Thấp</option>
              <option value="NORMAL">Chuẩn</option>
              <option value="HIGH">Cao</option>
            </Select>
          </label>

          <label className="w-[112px]">
            <span className="sr-only">Phụ trách</span>
            <Select
              disabled={usersUnavailable}
              value={assignedToId}
              onChange={(event) => onAssignedToIdChange(event.target.value)}
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
        </CompactFilterToolbar>
      </CardContent>
    </Card>
  );
}
