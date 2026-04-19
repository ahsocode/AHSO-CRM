"use client";

import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { UserRole } from "@/lib/types";

export function RoleTable({
  roles,
  isLoading
}: {
  roles: UserRole[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <LoadingSkeleton className="h-[420px] w-full" />;
  }

  if (roles.length === 0) {
    return (
      <EmptyState
        title="Chưa có role nào"
        description="Hệ thống chưa có custom role nào ngoài các role mặc định."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-white/70 bg-white/88">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên role</TableHead>
            <TableHead>Mô tả</TableHead>
            <TableHead># Users</TableHead>
            <TableHead># Permissions</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-semibold text-text-primary">{role.name}</TableCell>
              <TableCell className="text-text-secondary">{role.description || "Chưa có mô tả"}</TableCell>
              <TableCell>{role._count?.users ?? role.users?.length ?? 0}</TableCell>
              <TableCell>{role.permissions.length}</TableCell>
              <TableCell>
                {role.isSystem ? <Badge variant="info">Hệ thống</Badge> : <Badge variant="neutral">Tuỳ biến</Badge>}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  className="text-sm font-semibold text-primary hover:text-primary-hover"
                  href={`/admin/roles/${role.id}` as Route}
                >
                  Sửa
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
