"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGroup, RoleUpsertInput, UserRole } from "@/lib/types";
import { PermissionTree } from "./permission-tree";

const roleFormSchema = z.object({
  name: z.string().trim().min(1, "Tên role không được để trống").max(100, "Tên role quá dài"),
  description: z.string().trim().max(500, "Mô tả không được vượt quá 500 ký tự").optional().or(z.literal("")),
  permissionIds: z.array(z.string())
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

function normalizeRole(role?: UserRole | null): RoleFormValues {
  return {
    name: role?.name ?? "",
    description: role?.description ?? "",
    permissionIds: role?.permissions.map((permission) => permission.id) ?? []
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-danger">{message}</p>;
}

export function RoleForm({
  mode,
  role,
  permissionGroups,
  isSaving,
  isDeleting,
  onSubmit,
  onDelete
}: {
  mode: "create" | "edit";
  role?: UserRole | null;
  permissionGroups: PermissionGroup[];
  isSaving: boolean;
  isDeleting?: boolean;
  onSubmit: (values: RoleUpsertInput) => void;
  onDelete?: () => void;
}) {
  const isSystemRole = mode === "edit" && role?.isSystem;
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: normalizeRole(role)
  });

  useEffect(() => {
    form.reset(normalizeRole(role));
  }, [form, role]);

  return (
    <Card className="border border-white/70 bg-white/88">
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>{mode === "create" ? "Tạo role mới" : "Chỉnh sửa role"}</CardTitle>
          {isSystemRole ? <Badge variant="info">Hệ thống</Badge> : null}
        </div>
        <CardDescription>
          {mode === "create"
            ? "Tạo custom role mới và chọn permission ngay từ đầu."
            : isSystemRole
              ? "System role chỉ để tham chiếu, không cho phép chỉnh sửa hoặc xoá."
              : "Cập nhật tên hiển thị, mô tả và permission của role này."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit((values) => {
            onSubmit({
              name: values.name.trim(),
              description: values.description?.trim() || undefined,
              permissionIds: values.permissionIds
            });
          })}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary" htmlFor="role-name">
                Tên role
              </label>
              <Input id="role-name" disabled={isSystemRole || isSaving} {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary" htmlFor="role-description">
                Mô tả
              </label>
              <Textarea
                id="role-description"
                rows={4}
                disabled={isSystemRole || isSaving}
                {...form.register("description")}
              />
              <FieldError message={form.formState.errors.description?.message} />
            </div>
          </div>

          <PermissionTree
            groups={permissionGroups}
            disabled={isSystemRole || isSaving}
            selectedPermissionIds={form.watch("permissionIds")}
            onChange={(permissionIds) => form.setValue("permissionIds", permissionIds, { shouldDirty: true })}
          />

          <div className="flex flex-wrap items-center justify-end gap-3">
            {mode === "edit" ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isSystemRole || isDeleting || isSaving}
                onClick={onDelete}
              >
                {isDeleting ? "Đang xoá..." : "Xoá role"}
              </Button>
            ) : null}

            <Button type="submit" disabled={isSystemRole || isSaving}>
              {isSaving ? "Đang lưu..." : mode === "create" ? "Tạo role" : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
