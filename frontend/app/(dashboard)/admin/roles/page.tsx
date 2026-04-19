"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCreateRole, useRoles } from "@/hooks/use-roles";
import { usePermissions } from "@/hooks/use-permissions";
import { RoleUpsertInput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RoleForm } from "./_components/role-form";
import { RoleTable } from "./_components/role-table";

export default function RolesPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const rolesQuery = useRoles();
  const permissionsQuery = usePermissions();
  const createRoleMutation = useCreateRole();
  const { error, success } = useToast();

  const handleCreateRole = async (values: RoleUpsertInput) => {
    try {
      await createRoleMutation.mutateAsync(values);
      success(`Đã tạo role ${values.name}`);
      setShowCreateForm(false);
    } catch {
      error("Không thể tạo role");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Roles"
        description="Danh sách role hệ thống và custom role, kèm quyền chi tiết để quản lý RBAC."
        action={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={cn(buttonVariants({ variant: showCreateForm ? "outline" : "primary" }))}
              onClick={() => setShowCreateForm((current) => !current)}
            >
              {showCreateForm ? "Ẩn form tạo" : "Tạo mới"}
            </button>
            <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }))}>
              Về quản trị
            </Link>
          </div>
        }
      />

      {showCreateForm ? (
        <RoleForm
          mode="create"
          permissionGroups={permissionsQuery.data ?? []}
          isSaving={createRoleMutation.isPending}
          onSubmit={handleCreateRole}
        />
      ) : null}

      <RoleTable roles={rolesQuery.data ?? []} isLoading={rolesQuery.isLoading} />
    </div>
  );
}
