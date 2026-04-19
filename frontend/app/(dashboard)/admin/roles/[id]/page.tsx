"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useDeleteRole, useRole, useUpdateRole } from "@/hooks/use-roles";
import { RoleUpsertInput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RoleForm } from "../_components/role-form";

export default function RoleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roleId = params?.id ?? "";
  const roleQuery = useRole(roleId);
  const permissionsQuery = usePermissions();
  const updateRoleMutation = useUpdateRole(roleId);
  const deleteRoleMutation = useDeleteRole();
  const { error, success } = useToast();

  const handleSave = async (values: RoleUpsertInput) => {
    try {
      await updateRoleMutation.mutateAsync(values);
      success("Đã cập nhật role");
    } catch {
      error("Không thể cập nhật role");
    }
  };

  const handleDelete = async () => {
    if (!roleQuery.data || roleQuery.data.isSystem) {
      return;
    }

    if (!window.confirm(`Xoá role ${roleQuery.data.name}?`)) {
      return;
    }

    try {
      await deleteRoleMutation.mutateAsync(roleId);
      success("Đã xoá role");
      router.push("/admin/roles");
    } catch {
      error("Không thể xoá role");
    }
  };

  if (roleQuery.isLoading || permissionsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-16 w-full" />
        <LoadingSkeleton className="h-[720px] w-full" />
      </div>
    );
  }

  if (!roleQuery.data) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Role detail"
          description="Không tìm thấy role bạn đang truy cập."
          action={
            <Link href="/admin/roles" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách role
            </Link>
          }
        />
        <EmptyState
          title="Role không tồn tại"
          description="Role này có thể đã bị xoá hoặc ID không còn hợp lệ."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Role: ${roleQuery.data.name}`}
        description="Xem chi tiết role, chỉnh sửa custom role hoặc tham chiếu cấu hình của system role."
        action={
          <Link href="/admin/roles" className={cn(buttonVariants({ variant: "outline" }))}>
            Về danh sách role
          </Link>
        }
      />

      <RoleForm
        mode="edit"
        role={roleQuery.data}
        permissionGroups={permissionsQuery.data ?? []}
        isSaving={updateRoleMutation.isPending}
        isDeleting={deleteRoleMutation.isPending}
        onSubmit={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
