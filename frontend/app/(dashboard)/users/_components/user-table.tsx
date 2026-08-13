"use client";

import type { ReactNode } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { EmptyState } from "@/components/shared/empty-state";
import { LedgerHeader } from "@/components/shared/ledger-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRoleLabelByName } from "@/lib/constants";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { resolveAssetUrl } from "@/lib/auth";
import { UserListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function UserTable({
  items,
  selectedUserId,
  isLoading,
  isError,
  errorMessage,
  onSelectUser,
  toolbar
}: {
  items: UserListItem[];
  selectedUserId: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  onSelectUser: (userId: string) => void;
  toolbar?: ReactNode;
}) {
  const header = (
    <LedgerHeader
      eyebrow="User Ledger"
      metaText={`${items.length} người dùng`}
      title="Người dùng"
      toolbar={toolbar}
    />
  );

  if (isLoading) {
    return (
      <div className="surface-card overflow-hidden border border-white/60 bg-white/88">
        {header}
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl border border-white/60 bg-white/80" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="surface-card overflow-hidden border border-danger/20 bg-danger-bg/40">
        {header}
        <div className="p-6 text-sm text-danger">{errorMessage}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="surface-card overflow-hidden border border-white/60 bg-white/88">
        {header}
        <div className="p-6">
          <EmptyState
            title="Không có người dùng phù hợp"
            description="Hãy thử nới bộ lọc hoặc tìm bằng email/tên đầy đủ để đưa danh sách quay lại."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card overflow-hidden border border-white/60 bg-white/88">
      {header}
      <div className="overflow-x-auto">
        <table className="min-w-[620px] divide-y divide-border/60">
          <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.18em] text-text-muted">
            <tr>
              <th className="px-3 py-4">Người dùng</th>
              <th className="px-3 py-4">Vai trò</th>
              <th className="px-3 py-4">Trạng thái</th>
              <th className="px-3 py-4">Tạo lúc</th>
              <th className="w-16 px-3 py-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((item) => {
              const isSelected = item.id === selectedUserId;

              return (
                <tr
                  key={item.id}
                  className={cn(
                    "transition-colors",
                    isSelected ? "bg-primary/5" : "hover:bg-slate-50/80"
                  )}
                >
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <AvatarInitials name={item.name} src={resolveAssetUrl(item.avatarUrl)} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-text-primary">{item.name}</p>
                        <p className="truncate text-sm text-text-secondary">{item.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="space-y-1">
                      <p className="font-medium text-text-primary">{getRoleLabelByName(item.role)}</p>
                      <p className="text-sm text-text-secondary">{item.role}</p>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <Badge variant={item.isActive ? "success" : "danger"}>
                      {item.isActive ? "Đang hoạt động" : "Tạm khóa"}
                    </Badge>
                  </td>
                  <td className="px-3 py-4 text-sm text-text-secondary">
                    <p>{formatDate(item.createdAt)}</p>
                    <p className="mt-1">{formatRelativeTime(item.createdAt)}</p>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <Button
                      aria-label={isSelected ? `Đang chỉnh sửa ${item.name}` : `Chỉnh sửa ${item.name}`}
                      className="h-9 w-9 p-0"
                      onClick={() => onSelectUser(item.id)}
                      size="sm"
                      title={isSelected ? "Đang chỉnh sửa" : "Chỉnh sửa"}
                      variant={isSelected ? "primary" : "outline"}
                    >
                      <AppIcon name={isSelected ? "check-circle" : "pencil"} className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
