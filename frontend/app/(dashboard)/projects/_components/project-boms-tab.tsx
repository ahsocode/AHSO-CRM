"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { BomStatusBadge } from "@/components/bom/bom-status-badge";
import { PermissionGate } from "@/components/shared/permission-gate";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeleteBom, useProjectBoms } from "@/hooks/use-boms";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatVND } from "@/lib/format";
import type { BomListItem } from "@/types/bom";
import { BomCreateDialog } from "./bom-create-dialog";

export function ProjectBomsTab({ projectId }: { projectId: string }) {
  const bomsQuery = useProjectBoms(projectId);
  const deleteMutation = useDeleteBom();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<BomListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const boms = bomsQuery.data ?? [];

  function handleDelete() {
    if (!deleting) return;
    setDeleteError(null);
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        toast.success("Đã xóa BOM.");
        setDeleting(null);
      },
      onError: (error) => setDeleteError(getApiErrorMessage(error, "Không thể xóa BOM."))
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Mỗi máy hoặc hạng mục của dự án có một BOM dự toán. Giá vốn dự kiến dùng cho báo giá và so sánh với thực tế.
        </p>
        <PermissionGate permission="projects.edit">
          <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
            Tạo BOM
          </Button>
        </PermissionGate>
      </div>

      {bomsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : bomsQuery.isError ? (
        <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
          {getApiErrorMessage(bomsQuery.error, "Không thể tải danh sách BOM.")}
        </div>
      ) : boms.length === 0 ? (
        <EmptyState title="Dự án chưa có BOM" description="Tạo BOM trống, từ mẫu máy hoặc sao chép từ BOM dự án khác." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                <th className="px-4 py-2">Mã BOM</th>
                <th className="px-4 py-2">Tên</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2 text-right">Số dòng</th>
                <th className="px-4 py-2 text-right">Tổng dự kiến</th>
                <th className="px-4 py-2">Cập nhật</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {boms.map((bom) => (
                <tr key={bom.id} className="bg-bg-subtle" data-testid="project-bom-row">
                  <td className="rounded-l-xl px-4 py-3 font-sans text-sm text-text-secondary">{bom.code}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${projectId}/boms/${bom.id}` as Route}
                      className="font-semibold text-text-primary hover:text-primary"
                    >
                      {bom.name}
                    </Link>
                    <p className="text-xs text-text-muted">Phiên bản v{bom.version}</p>
                  </td>
                  <td className="px-4 py-3">
                    <BomStatusBadge status={bom.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-text-secondary">{bom.lineCount}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-text-primary">
                    {formatVND(bom.total)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(bom.updatedAt)}</td>
                  <td className="rounded-r-xl px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/projects/${projectId}/boms/${bom.id}` as Route}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Mở
                      </Link>
                      {bom.status === "DRAFT" ? (
                        <PermissionGate permission="projects.edit">
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleting(bom);
                            }}
                            className="text-xs font-semibold text-text-muted hover:text-danger hover:underline"
                          >
                            Xóa
                          </button>
                        </PermissionGate>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BomCreateDialog open={createOpen} onOpenChange={setCreateOpen} projectId={projectId} />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => (open ? null : setDeleting(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa BOM</DialogTitle>
            <DialogDescription>
              Xóa {deleting?.code} · {deleting?.name}? BOM đang được báo giá, phân bổ hoặc BOM khác sử dụng sẽ không xóa
              được.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{deleteError}</div> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              Hủy
            </Button>
            <Button type="button" variant="primary" disabled={deleteMutation.isPending} onClick={handleDelete}>
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa BOM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
