"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { AppIcon } from "@/components/shared/app-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/hooks/use-auth";
import { useUpdateUser, useUsers } from "@/hooks/use-users";
import { getApiErrorMessage } from "@/lib/api-client";
import { AUTH_USER_KEY, ROLE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { Role, UserListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UserOverviewCards } from "./user-overview-cards";
import { UserTable } from "./user-table";

const userEditorSchema = z.object({
  name: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự").max(100, "Tên quá dài"),
  role: z.enum(["ADMIN", "MANAGER", "STAFF"]),
  status: z.enum(["active", "inactive"]),
  avatarUrl: z.string().trim().url("Avatar URL không hợp lệ").or(z.literal(""))
});

type UserEditorValues = z.infer<typeof userEditorSchema>;
type ActivityFilterValue = "all" | "active" | "inactive";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Đã xảy ra lỗi khi tải danh sách người dùng.";
}

function matchesSearch(user: UserListItem, search: string) {
  if (!search) {
    return true;
  }

  const normalized = search.toLowerCase();

  return [user.name, user.email, ROLE_LABELS[user.role], user.role]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalized));
}

function filterUsers(users: UserListItem[], search: string, role: Role | "", activity: ActivityFilterValue) {
  return users.filter((user) => {
    if (!matchesSearch(user, search)) {
      return false;
    }

    if (role && user.role !== role) {
      return false;
    }

    if (activity === "active" && !user.isActive) {
      return false;
    }

    if (activity === "inactive" && user.isActive) {
      return false;
    }

    return true;
  });
}

function getDefaultValues(user?: UserListItem | null): UserEditorValues {
  return {
    name: user?.name ?? "",
    role: user?.role ?? "STAFF",
    status: user?.isActive ? "active" : "inactive",
    avatarUrl: user?.avatarUrl ?? ""
  };
}

export function UsersClient() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const canManageUsers = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [activityFilter, setActivityFilter] = useState<ActivityFilterValue>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const usersQuery = useUsers(canManageUsers);
  const updateUserMutation = useUpdateUser();

  const users = usersQuery.data ?? [];
  const filteredUsers = filterUsers(users, deferredSearch, roleFilter, activityFilter);
  const selectedUser = filteredUsers.find((candidate) => candidate.id === selectedUserId) ?? null;
  const form = useForm<UserEditorValues>({
    resolver: zodResolver(userEditorSchema),
    defaultValues: getDefaultValues(selectedUser)
  });

  useEffect(() => {
    if (!selectedUserId && filteredUsers[0]) {
      setSelectedUserId(filteredUsers[0].id);
      return;
    }

    if (selectedUserId && !filteredUsers.some((candidate) => candidate.id === selectedUserId)) {
      setSelectedUserId(filteredUsers[0]?.id ?? null);
    }
  }, [filteredUsers, selectedUserId]);

  useEffect(() => {
    form.reset(getDefaultValues(selectedUser));
    setSuccessMessage(null);
  }, [form, selectedUser]);

  const hasActiveFilters = deferredSearch.length > 0 || roleFilter.length > 0 || activityFilter !== "all";

  const saveMutation = useMutation({
    mutationFn: async (values: UserEditorValues) => {
      if (!selectedUser) {
        throw new Error("Chưa chọn người dùng để cập nhật");
      }

      return updateUserMutation.mutateAsync({
        userId: selectedUser.id,
        payload: {
          name: values.name.trim(),
          role: values.role,
          isActive: values.status === "active",
          avatarUrl: values.avatarUrl.trim() ? values.avatarUrl.trim() : null
        }
      });
    },
    onSuccess: async (updatedUser) => {
      setSuccessMessage(`Đã cập nhật hồ sơ cho ${updatedUser.name}.`);
      setSelectedUserId(updatedUser.id);

      if (user && updatedUser.id === user.id) {
        const nextUser = {
          ...user,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          avatarUrl: updatedUser.avatarUrl ?? null,
          isActive: updatedUser.isActive
        };

        useAuthStore.setState({
          user: nextUser
        });

        if (typeof window !== "undefined") {
          window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
        }

        if (!updatedUser.isActive) {
          await logout();
          return;
        }

        if (updatedUser.role === "STAFF") {
          router.replace("/dashboard");
        }
      }
    }
  });

  if (!canManageUsers) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Quản trị người dùng"
          description="Màn hình này chỉ dành cho ADMIN và MANAGER để điều phối quyền truy cập nội bộ."
          action={
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              Về dashboard
            </Link>
          }
        />

        <Card className="border border-warning/25 bg-warning-bg/35">
          <CardHeader>
            <CardTitle>Bạn không có quyền truy cập module này</CardTitle>
            <CardDescription>
              Nếu cần thay đổi vai trò hoặc kích hoạt tài khoản, hãy liên hệ quản trị hệ thống để được hỗ trợ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="primary" onClick={() => router.push("/dashboard")}>
              <AppIcon name="arrow-right" className="h-4 w-4" />
              Quay lại dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Quản trị người dùng"
        description="Điều phối vai trò, trạng thái hoạt động và hồ sơ nội bộ của các tài khoản đang dùng AHSO CRM."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void usersQuery.refetch()}>
              Làm mới danh sách
            </Button>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "primary" }))}>
              Về dashboard
            </Link>
          </div>
        }
      />

      <UserOverviewCards users={users} isLoading={usersQuery.isLoading} />

      <Card className="bg-white/88">
        <CardHeader>
          <CardTitle>Bộ lọc vận hành</CardTitle>
          <CardDescription>
            Tìm nhanh theo tên, email, vai trò hoặc trạng thái hoạt động trước khi cập nhật hồ sơ.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
          <Input
            placeholder="Tìm theo tên người dùng, email hoặc vai trò..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as Role | "")}>
            <option value="">Tất cả vai trò</option>
            <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
            <option value="MANAGER">{ROLE_LABELS.MANAGER}</option>
            <option value="STAFF">{ROLE_LABELS.STAFF}</option>
          </Select>

          <Select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value as ActivityFilterValue)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Tạm khóa</option>
          </Select>

          <Button
            variant="ghost"
            disabled={!hasActiveFilters}
            onClick={() => {
              setSearch("");
              setRoleFilter("");
              setActivityFilter("all");
            }}
          >
            Xóa bộ lọc
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <UserTable
          items={filteredUsers}
          selectedUserId={selectedUserId}
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          errorMessage={getErrorMessage(usersQuery.error)}
          onSelectUser={setSelectedUserId}
        />

        <Card className="bg-white/92">
          <CardHeader>
            <CardTitle>Biên tập hồ sơ</CardTitle>
            <CardDescription>
              Cập nhật thông tin hiển thị, vai trò và trạng thái hoạt động của từng tài khoản.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedUser ? (
              <EmptyState
                title="Chưa chọn người dùng"
                description="Chọn một dòng ở bảng bên trái để xem chi tiết và cập nhật hồ sơ."
              />
            ) : (
              <div className="space-y-5">
                <div className="flex items-start gap-4 rounded-2xl bg-slate-50/90 p-4 ring-1 ring-border/50">
                  <AvatarInitials name={selectedUser.name} className="h-14 w-14 rounded-2xl text-base" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-text-primary">{selectedUser.name}</h3>
                      <Badge variant={selectedUser.isActive ? "success" : "danger"}>
                        {selectedUser.isActive ? "Đang hoạt động" : "Tạm khóa"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{selectedUser.email}</p>
                    <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
                      <p>Vai trò hiện tại: {ROLE_LABELS[selectedUser.role]}</p>
                      <p>Tạo lúc: {formatDate(selectedUser.createdAt)}</p>
                      <p>Cập nhật cuối: {selectedUser.updatedAt ? formatDateTime(selectedUser.updatedAt) : "Chưa có"}</p>
                      <p>Avatar URL: {selectedUser.avatarUrl ? "Đã cấu hình" : "Chưa có"}</p>
                    </div>
                  </div>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={form.handleSubmit((values) => {
                    saveMutation.mutate(values);
                  })}
                >
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary" htmlFor="user-name">
                      Họ tên hiển thị
                    </label>
                    <Input id="user-name" {...form.register("name")} />
                    {form.formState.errors.name ? (
                      <p className="text-sm text-danger">{form.formState.errors.name.message}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-text-primary" htmlFor="user-role">
                        Vai trò
                      </label>
                      <Select id="user-role" {...form.register("role")}>
                        <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                        <option value="MANAGER">{ROLE_LABELS.MANAGER}</option>
                        <option value="STAFF">{ROLE_LABELS.STAFF}</option>
                      </Select>
                      {form.formState.errors.role ? (
                        <p className="text-sm text-danger">{form.formState.errors.role.message}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-text-primary" htmlFor="user-status">
                        Trạng thái hoạt động
                      </label>
                      <Select id="user-status" {...form.register("status")}>
                        <option value="active">Đang hoạt động</option>
                        <option value="inactive">Tạm khóa</option>
                      </Select>
                      {form.formState.errors.status ? (
                        <p className="text-sm text-danger">{form.formState.errors.status.message}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary" htmlFor="user-avatar">
                      Avatar URL
                    </label>
                    <Input
                      id="user-avatar"
                      placeholder="https://cdn.ahso.vn/avatar/user.png"
                      {...form.register("avatarUrl")}
                    />
                    <p className="text-xs text-text-secondary">
                      Để trống nếu muốn dùng avatar chữ cái mặc định của hệ thống.
                    </p>
                    {form.formState.errors.avatarUrl ? (
                      <p className="text-sm text-danger">{form.formState.errors.avatarUrl.message}</p>
                    ) : null}
                  </div>

                  {saveMutation.isError ? (
                    <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
                      {getApiErrorMessage(saveMutation.error, "Không thể cập nhật người dùng lúc này.")}
                    </div>
                  ) : null}

                  {successMessage ? (
                    <div className="rounded-xl bg-success-bg/70 px-4 py-3 text-sm text-success">
                      {successMessage}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={saveMutation.isPending}>
                      <AppIcon name="arrow-right" className="h-4 w-4" />
                      {saveMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        form.reset(getDefaultValues(selectedUser));
                        setSuccessMessage(null);
                      }}
                    >
                      Khôi phục giá trị hiện tại
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
