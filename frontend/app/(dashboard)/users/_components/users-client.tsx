"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useUploadAvatar } from "@/hooks/use-upload";
import { useCreateUser, useUpdateUser, useUsers } from "@/hooks/use-users";
import { useRoles } from "@/hooks/use-roles";
import { isLeadershipRole, resolveAssetUrl } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import { getRoleLabelByName } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { UserListItem, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UserOverviewCards } from "./user-overview-cards";
import { UserTable } from "./user-table";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

function isValidAvatarUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return true;
  }

  if (trimmed.startsWith("/uploads/avatars/") && !trimmed.includes("..")) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const avatarUrlSchema = z
  .string()
  .trim()
  .refine(isValidAvatarUrl, "Avatar URL không hợp lệ");

const userEditorSchema = z.object({
  name: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự").max(100, "Tên quá dài"),
  roleId: z.string().trim().min(1, "Vai trò không được để trống"),
  status: z.enum(["active", "inactive"]),
  avatarUrl: avatarUrlSchema
});

const userCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự").max(100, "Tên quá dài"),
    email: z.string().trim().email("Email không hợp lệ"),
    roleId: z.string().trim().min(1, "Vai trò không được để trống"),
    password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự").max(100, "Mật khẩu quá dài"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
    status: z.enum(["active", "inactive"]),
    avatarUrl: avatarUrlSchema
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận không khớp"
  });

type UserEditorValues = z.infer<typeof userEditorSchema>;
type UserCreateValues = z.infer<typeof userCreateSchema>;
type ActivityFilterValue = "all" | "active" | "inactive";
type PanelMode = "edit" | "create";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Đã xảy ra lỗi khi tải danh sách người dùng.";
}

function getRoleOptions(roles: UserRole[]) {
  return [...roles].sort((left, right) => {
    if (left.isSystem !== right.isSystem) {
      return left.isSystem ? -1 : 1;
    }

    return getRoleLabelByName(left.name).localeCompare(getRoleLabelByName(right.name), "vi");
  });
}

function getPreferredRoleId(roles: UserRole[]) {
  return roles.find((role) => role.name === "STAFF")?.id ?? roles[0]?.id ?? "";
}

function matchesSearch(user: UserListItem, search: string) {
  if (!search) {
    return true;
  }

  const normalized = search.toLowerCase();

  return [user.name, user.email, getRoleLabelByName(user.role), user.role]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalized));
}

function filterUsers(users: UserListItem[], search: string, roleId: string, activity: ActivityFilterValue) {
  return users.filter((user) => {
    if (!matchesSearch(user, search)) {
      return false;
    }

    if (roleId && user.roleId !== roleId) {
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

function getEditorDefaultValues(user?: UserListItem | null): UserEditorValues {
  return {
    name: user?.name ?? "",
    roleId: user?.roleId ?? "",
    status: user?.isActive ? "active" : "inactive",
    avatarUrl: user?.avatarUrl ?? ""
  };
}

function getCreateDefaultValues(roleId: string): UserCreateValues {
  return {
    name: "",
    email: "",
    roleId,
    password: "",
    confirmPassword: "",
    status: "active",
    avatarUrl: ""
  };
}

function AvatarUploader({
  inputId,
  name,
  value,
  disabled,
  onUploaded
}: {
  inputId: string;
  name: string;
  value?: string | null;
  disabled?: boolean;
  onUploaded: (url: string) => void;
}) {
  const uploadAvatar = useUploadAvatar();
  const { error: showError, success } = useToast();
  const [progress, setProgress] = useState(0);
  const previewUrl = resolveAssetUrl(value);

  const handleFile = async (file?: File | null) => {
    if (!file) {
      return;
    }

    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      showError("Avatar chỉ chấp nhận PNG, JPG hoặc WEBP.");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      showError("Kích thước avatar vượt quá 5MB.");
      return;
    }

    try {
      setProgress(0);
      const result = await uploadAvatar.mutateAsync({
        file,
        onProgress: setProgress
      });
      onUploaded(result.url);
      success("Đã tải avatar lên. Bấm Lưu thay đổi để áp dụng vào hồ sơ.");
    } catch (error) {
      showError(getApiErrorMessage(error, "Không thể tải avatar lên."));
    } finally {
      setProgress(0);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (disabled || uploadAvatar.isPending) {
      return;
    }

    void handleFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="rounded-2xl border border-dashed border-border bg-slate-50/70 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <AvatarInitials
          name={name || "Avatar"}
          src={previewUrl}
          className="h-20 w-20 rounded-2xl text-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary">Upload avatar</p>
          <p className="mt-1 text-sm text-text-secondary">
            Kéo thả ảnh vào đây hoặc chọn file. Hỗ trợ PNG, JPG, WEBP và tối đa 5MB.
          </p>
          {value ? (
            <p className="mt-2 truncate text-xs text-text-secondary">Đường dẫn hiện tại: {value}</p>
          ) : null}
          {uploadAvatar.isPending ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-hover">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          id={inputId}
          type="file"
          accept={AVATAR_MIME_TYPES.join(",")}
          onChange={handleInputChange}
          disabled={disabled || uploadAvatar.isPending}
          className="hidden"
        />
        <label
          htmlFor={inputId}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-border bg-bg-card px-4 text-sm font-medium text-text-primary transition hover:bg-bg-hover"
        >
          {uploadAvatar.isPending ? "Đang tải..." : "Chọn ảnh avatar"}
        </label>
        {value ? (
          <Button type="button" variant="ghost" onClick={() => onUploaded("")} disabled={disabled || uploadAvatar.isPending}>
            Xóa avatar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function UsersClient() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const canManageUsers = isLeadershipRole(user?.role);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState<ActivityFilterValue>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("edit");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const usersQuery = useUsers(canManageUsers);
  const rolesQuery = useRoles();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const roleOptions = useMemo(() => getRoleOptions(rolesQuery.data ?? []), [rolesQuery.data]);
  const filteredUsers = useMemo(
    () => filterUsers(users, deferredSearch, roleFilter, activityFilter),
    [activityFilter, deferredSearch, roleFilter, users]
  );
  const selectedUser = useMemo(
    () => users.find((candidate) => candidate.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );
  const selectedVisibleUser = useMemo(
    () => filteredUsers.find((candidate) => candidate.id === selectedUserId) ?? null,
    [filteredUsers, selectedUserId]
  );

  const editForm = useForm<UserEditorValues>({
    resolver: zodResolver(userEditorSchema),
    defaultValues: getEditorDefaultValues(selectedUser)
  });
  const createForm = useForm<UserCreateValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: getCreateDefaultValues(getPreferredRoleId(roleOptions))
  });
  const createAvatarUrl = createForm.watch("avatarUrl");
  const createName = createForm.watch("name");
  const editAvatarUrl = editForm.watch("avatarUrl");
  const editName = editForm.watch("name");

  useEffect(() => {
    if (!selectedUserId && users[0]) {
      setSelectedUserId(users[0].id);
      return;
    }

    if (selectedUserId && !users.some((candidate) => candidate.id === selectedUserId)) {
      setSelectedUserId(users[0]?.id ?? null);
    }
  }, [selectedUserId, users]);

  useEffect(() => {
    if (panelMode === "edit") {
      editForm.reset(getEditorDefaultValues(selectedUser));
    }
  }, [editForm, panelMode, selectedUser]);

  useEffect(() => {
    if (panelMode === "create" && !createForm.getValues("roleId") && roleOptions.length > 0) {
      createForm.reset(getCreateDefaultValues(getPreferredRoleId(roleOptions)));
    }
  }, [createForm, panelMode, roleOptions]);

  const hasActiveFilters = deferredSearch.length > 0 || roleFilter.length > 0 || activityFilter !== "all";
  const createErrorMessage = createUserMutation.isError
    ? getApiErrorMessage(createUserMutation.error, "Không thể tạo người dùng lúc này.")
    : null;
  const updateErrorMessage = updateUserMutation.isError
    ? getApiErrorMessage(updateUserMutation.error, "Không thể cập nhật người dùng lúc này.")
    : null;

  const openCreatePanel = () => {
    setPanelMode("create");
    setSuccessMessage(null);
    createForm.reset(getCreateDefaultValues(getPreferredRoleId(roleOptions)));
  };

  const closeCreatePanel = () => {
    setPanelMode("edit");
    setSuccessMessage(null);
    createForm.reset(getCreateDefaultValues(getPreferredRoleId(roleOptions)));
  };

  const handleUpdateSubmit = async (values: UserEditorValues) => {
    if (!selectedUser) {
      return;
    }

    try {
      const updatedUser = await updateUserMutation.mutateAsync({
        userId: selectedUser.id,
        payload: {
          name: values.name.trim(),
          roleId: values.roleId,
          isActive: values.status === "active",
          avatarUrl: values.avatarUrl.trim() ? values.avatarUrl.trim() : null
        }
      });

      setSuccessMessage(`Đã cập nhật hồ sơ cho ${updatedUser.name}.`);
      setSelectedUserId(updatedUser.id);

      if (user && updatedUser.id === user.id) {
        if (!updatedUser.isActive) {
          await logout();
          return;
        }

        try {
          await useAuthStore.getState().refreshSession();
        } catch {
          await logout();
          return;
        }

        if (updatedUser.role === "STAFF") {
          router.replace("/dashboard");
        }
      }
    } catch {
      // Error surfaced by mutation state.
    }
  };

  const handleCreateSubmit = async (values: UserCreateValues) => {
    try {
      const createdUser = await createUserMutation.mutateAsync({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        roleId: values.roleId,
        avatarUrl: values.avatarUrl.trim() ? values.avatarUrl.trim() : undefined,
        isActive: values.status === "active"
      });

      const hadActiveFilters = hasActiveFilters;
      setSearch("");
      setRoleFilter("");
      setActivityFilter("all");
      setSelectedUserId(createdUser.id);
      setPanelMode("edit");
      setSuccessMessage(
        hadActiveFilters
          ? `Đã tạo tài khoản cho ${createdUser.name}. Bộ lọc đã được đặt lại để hiển thị người dùng mới.`
          : `Đã tạo tài khoản cho ${createdUser.name}.`
      );
      await usersQuery.refetch();
    } catch {
      // Error surfaced by mutation state.
    }
  };

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
            <Button onClick={openCreatePanel} disabled={rolesQuery.isLoading || roleOptions.length === 0}>
              <AppIcon name="plus" className="h-4 w-4" />
              Thêm người dùng
            </Button>
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

          <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">Tất cả vai trò</option>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {getRoleLabelByName(role.name)}
              </option>
            ))}
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
          selectedUserId={panelMode === "edit" ? selectedVisibleUser?.id ?? null : null}
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          errorMessage={getErrorMessage(usersQuery.error)}
          onSelectUser={(userId) => {
            setSelectedUserId(userId);
            setPanelMode("edit");
            setSuccessMessage(null);
          }}
        />

        <Card className="bg-white/92">
          <CardHeader>
            <CardTitle>{panelMode === "create" ? "Thêm người dùng" : "Biên tập hồ sơ"}</CardTitle>
            <CardDescription>
              {panelMode === "create"
                ? "Tạo tài khoản nội bộ mới với mật khẩu tạm và vai trò phù hợp cho từng thành viên."
                : "Cập nhật thông tin hiển thị, vai trò và trạng thái hoạt động của từng tài khoản."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {panelMode === "create" ? (
              <div className="space-y-5">
                <div className="flex items-start gap-4 rounded-2xl bg-slate-50/90 p-4 ring-1 ring-border/50">
                  <AvatarInitials
                    name={createName || "Tài khoản mới"}
                    src={resolveAssetUrl(createAvatarUrl)}
                    className="h-14 w-14 rounded-2xl text-base"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-text-primary">Tài khoản mới</h3>
                      <Badge variant="info">Chưa tạo</Badge>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">
                      Tài khoản sẽ được thêm vào danh sách ngay sau khi lưu thành công.
                    </p>
                    <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
                      <p>Quyền tạo mới: ADMIN và MANAGER</p>
                      <p>Email chào mừng sẽ được gửi tự động nếu SMTP đang sẵn sàng.</p>
                    </div>
                  </div>
                </div>

                {rolesQuery.isError ? (
                  <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
                    {getApiErrorMessage(rolesQuery.error, "Không thể tải danh sách vai trò để tạo người dùng.")}
                  </div>
                ) : null}

                <form className="space-y-4" onSubmit={createForm.handleSubmit(handleCreateSubmit)}>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary" htmlFor="create-user-name">
                      Họ tên hiển thị
                    </label>
                    <Input id="create-user-name" {...createForm.register("name")} />
                    {createForm.formState.errors.name ? (
                      <p className="text-sm text-danger">{createForm.formState.errors.name.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary" htmlFor="create-user-email">
                      Email đăng nhập
                    </label>
                    <Input id="create-user-email" type="email" placeholder="ten@ahso.vn" {...createForm.register("email")} />
                    {createForm.formState.errors.email ? (
                      <p className="text-sm text-danger">{createForm.formState.errors.email.message}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-text-primary" htmlFor="create-user-role">
                        Vai trò
                      </label>
                      <Select id="create-user-role" {...createForm.register("roleId")} disabled={rolesQuery.isLoading}>
                        <option value="">Chọn vai trò</option>
                        {roleOptions.map((role) => (
                          <option key={role.id} value={role.id}>
                            {getRoleLabelByName(role.name)}
                          </option>
                        ))}
                      </Select>
                      {createForm.formState.errors.roleId ? (
                        <p className="text-sm text-danger">{createForm.formState.errors.roleId.message}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-text-primary" htmlFor="create-user-status">
                        Trạng thái hoạt động
                      </label>
                      <Select id="create-user-status" {...createForm.register("status")}>
                        <option value="active">Đang hoạt động</option>
                        <option value="inactive">Tạm khóa</option>
                      </Select>
                      {createForm.formState.errors.status ? (
                        <p className="text-sm text-danger">{createForm.formState.errors.status.message}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-text-primary" htmlFor="create-user-password">
                        Mật khẩu tạm
                      </label>
                      <Input id="create-user-password" type="password" {...createForm.register("password")} />
                      {createForm.formState.errors.password ? (
                        <p className="text-sm text-danger">{createForm.formState.errors.password.message}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-text-primary" htmlFor="create-user-confirm-password">
                        Xác nhận mật khẩu
                      </label>
                      <Input
                        id="create-user-confirm-password"
                        type="password"
                        {...createForm.register("confirmPassword")}
                      />
                      {createForm.formState.errors.confirmPassword ? (
                        <p className="text-sm text-danger">{createForm.formState.errors.confirmPassword.message}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <AvatarUploader
                      inputId="create-user-avatar-file"
                      name={createName || "Tài khoản mới"}
                      value={createAvatarUrl}
                      disabled={createUserMutation.isPending}
                      onUploaded={(url) => {
                        createForm.setValue("avatarUrl", url, {
                          shouldDirty: true,
                          shouldValidate: true
                        });
                      }}
                    />
                    <label className="text-sm font-semibold text-text-primary" htmlFor="create-user-avatar">
                      Avatar URL thủ công
                    </label>
                    <Input
                      id="create-user-avatar"
                      placeholder="/uploads/avatars/avatar.png hoặc https://cdn.ahso.vn/avatar/user.png"
                      {...createForm.register("avatarUrl")}
                    />
                    <p className="text-xs text-text-secondary">
                      Có thể để trống để hệ thống dùng avatar chữ cái mặc định.
                    </p>
                    {createForm.formState.errors.avatarUrl ? (
                      <p className="text-sm text-danger">{createForm.formState.errors.avatarUrl.message}</p>
                    ) : null}
                  </div>

                  {createErrorMessage ? (
                    <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{createErrorMessage}</div>
                  ) : null}

                  {successMessage ? (
                    <div className="rounded-xl bg-success-bg/70 px-4 py-3 text-sm text-success">{successMessage}</div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="submit"
                      disabled={createUserMutation.isPending || rolesQuery.isLoading || roleOptions.length === 0}
                    >
                      <AppIcon name="plus" className="h-4 w-4" />
                      {createUserMutation.isPending ? "Đang tạo..." : "Tạo người dùng"}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeCreatePanel}>
                      Hủy tạo mới
                    </Button>
                  </div>
                </form>
              </div>
            ) : !selectedUser ? (
              <EmptyState
                title="Chưa chọn người dùng"
                description="Chọn một dòng ở bảng bên trái để xem chi tiết và cập nhật hồ sơ."
              />
            ) : (
              <div className="space-y-5">
                <div className="flex items-start gap-4 rounded-2xl bg-slate-50/90 p-4 ring-1 ring-border/50">
                  <AvatarInitials
                    name={editName || selectedUser.name}
                    src={resolveAssetUrl(editAvatarUrl || selectedUser.avatarUrl)}
                    className="h-14 w-14 rounded-2xl text-base"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-text-primary">{selectedUser.name}</h3>
                      <Badge variant={selectedUser.isActive ? "success" : "danger"}>
                        {selectedUser.isActive ? "Đang hoạt động" : "Tạm khóa"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{selectedUser.email}</p>
                    <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
                      <p>Vai trò hiện tại: {getRoleLabelByName(selectedUser.role)}</p>
                      <p>Tạo lúc: {formatDate(selectedUser.createdAt)}</p>
                      <p>Cập nhật cuối: {selectedUser.updatedAt ? formatDateTime(selectedUser.updatedAt) : "Chưa có"}</p>
                      <p>Avatar URL: {selectedUser.avatarUrl ? "Đã cấu hình" : "Chưa có"}</p>
                    </div>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={editForm.handleSubmit(handleUpdateSubmit)}>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary" htmlFor="user-name">
                      Họ tên hiển thị
                    </label>
                    <Input id="user-name" {...editForm.register("name")} />
                    {editForm.formState.errors.name ? (
                      <p className="text-sm text-danger">{editForm.formState.errors.name.message}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-text-primary" htmlFor="user-role">
                        Vai trò
                      </label>
                      <Select id="user-role" {...editForm.register("roleId")} disabled={rolesQuery.isLoading}>
                        <option value="">Chọn vai trò</option>
                        {roleOptions.map((role) => (
                          <option key={role.id} value={role.id}>
                            {getRoleLabelByName(role.name)}
                          </option>
                        ))}
                      </Select>
                      {editForm.formState.errors.roleId ? (
                        <p className="text-sm text-danger">{editForm.formState.errors.roleId.message}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-text-primary" htmlFor="user-status">
                        Trạng thái hoạt động
                      </label>
                      <Select id="user-status" {...editForm.register("status")}>
                        <option value="active">Đang hoạt động</option>
                        <option value="inactive">Tạm khóa</option>
                      </Select>
                      {editForm.formState.errors.status ? (
                        <p className="text-sm text-danger">{editForm.formState.errors.status.message}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <AvatarUploader
                      inputId={`user-avatar-file-${selectedUser.id}`}
                      name={editName || selectedUser.name}
                      value={editAvatarUrl}
                      disabled={updateUserMutation.isPending}
                      onUploaded={(url) => {
                        editForm.setValue("avatarUrl", url, {
                          shouldDirty: true,
                          shouldValidate: true
                        });
                        setSuccessMessage(null);
                      }}
                    />
                    <label className="text-sm font-semibold text-text-primary" htmlFor="user-avatar">
                      Avatar URL thủ công
                    </label>
                    <Input
                      id="user-avatar"
                      placeholder="/uploads/avatars/avatar.png hoặc https://cdn.ahso.vn/avatar/user.png"
                      {...editForm.register("avatarUrl")}
                    />
                    <p className="text-xs text-text-secondary">
                      Để trống nếu muốn dùng avatar chữ cái mặc định của hệ thống.
                    </p>
                    {editForm.formState.errors.avatarUrl ? (
                      <p className="text-sm text-danger">{editForm.formState.errors.avatarUrl.message}</p>
                    ) : null}
                  </div>

                  {updateErrorMessage ? (
                    <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{updateErrorMessage}</div>
                  ) : null}

                  {successMessage ? (
                    <div className="rounded-xl bg-success-bg/70 px-4 py-3 text-sm text-success">{successMessage}</div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={updateUserMutation.isPending}>
                      <AppIcon name="arrow-right" className="h-4 w-4" />
                      {updateUserMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        editForm.reset(getEditorDefaultValues(selectedUser));
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
