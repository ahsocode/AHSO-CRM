"use client";

import { useState } from "react";
import { usePermission } from "@/components/shared/permission-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeleteProjectCost, useProjectCostSummary, useProjectCosts } from "@/hooks/use-project-costs";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { COST_GROUP_LABELS } from "@/lib/constants";
import { formatDate, formatVND } from "@/lib/format";
import type { ProjectCost } from "@/types/bom";
import { CostSummaryView } from "./project-finance/cost-summary-view";
import { ProjectCostDialog } from "./project-finance/project-cost-dialog";

export function ProjectCostsTab({ projectId }: { projectId: string }) {
  const costsQuery = useProjectCosts(projectId);
  const summaryQuery = useProjectCostSummary(projectId);
  const deleteCost = useDeleteProjectCost(projectId);
  const canEdit = usePermission("projects.edit");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectCost | null>(null);
  const [deleting, setDeleting] = useState<ProjectCost | null>(null);

  const costs = costsQuery.data ?? [];
  const summary = summaryQuery.data;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(cost: ProjectCost) {
    setEditing(cost);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteCost.mutateAsync(deleting.id);
      toast("Đã xóa chi phí.");
      setDeleting(null);
    } catch (error) {
      toast({
        title: "Không thể xóa chi phí",
        description: getApiErrorMessage(error, "Chi phí đã gắn vào đợt phân bổ đã xác nhận thì không xóa được."),
        variant: "destructive"
      });
    }
  }

  if (costsQuery.isLoading || summaryQuery.isLoading) {
    return <div className="p-4 text-sm text-text-secondary">Đang tải...</div>;
  }

  return (
    <div className="space-y-8">
      {costsQuery.isError || summaryQuery.isError ? (
        <p role="alert" className="text-sm text-danger">
          {getApiErrorMessage(costsQuery.error ?? summaryQuery.error, "Không thể tải chi phí dự án. Vui lòng thử lại.")}
        </p>
      ) : null}
      {summary ? <CostSummaryView summary={summary} /> : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading text-base font-bold text-text-primary">Chi phí trực tiếp</h3>
          {canEdit ? (
            <Button type="button" onClick={openCreate}>
              Thêm chi phí
            </Button>
          ) : null}
        </div>

        {costs.length === 0 ? (
          <div className="rounded-lg bg-bg-subtle px-4 py-6 text-center text-sm text-text-secondary">
            Chưa có chi phí trực tiếp nào (nhân công, gia công thuê ngoài, vận chuyển, phần mềm…).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="project-costs-table">
              <thead className="text-left text-text-secondary">
                <tr>
                  <th className="pb-2 pr-4">Nhóm</th>
                  <th className="pb-2 pr-4">Mô tả</th>
                  <th className="pb-2 pr-4">Nhà cung cấp</th>
                  <th className="pb-2 pr-4">Hóa đơn</th>
                  <th className="pb-2 pr-4 text-right">Trước VAT</th>
                  <th className="pb-2 pr-4 text-right">VAT</th>
                  <th className="pb-2 pr-4">Dòng BOM</th>
                  <th className="pb-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((cost) => {
                  const locked = cost.allocation?.status === "CONFIRMED";
                  return (
                    <tr key={cost.id} className="odd:bg-bg-subtle" data-testid="project-cost-row">
                      <td className="py-2 pr-4">{COST_GROUP_LABELS[cost.group]}</td>
                      <td className="py-2 pr-4">
                        <p className="font-semibold text-text-primary">{cost.description}</p>
                        {cost.notes ? <p className="text-xs text-text-secondary">{cost.notes}</p> : null}
                      </td>
                      <td className="py-2 pr-4">{cost.supplier?.name ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {cost.invoiceNo ?? "—"}
                        <p className="text-xs text-text-secondary">{formatDate(cost.invoiceDate)}</p>
                      </td>
                      <td className="py-2 pr-4 text-right">{formatVND(cost.amount)}</td>
                      <td className="py-2 pr-4 text-right">{cost.vatRate !== null ? `${cost.vatRate}%` : "—"}</td>
                      <td className="py-2 pr-4">{cost.bomLine ? `${cost.bomLine.bomCode} · ${cost.bomLine.name}` : "—"}</td>
                      <td className="py-2 text-right">
                        {canEdit ? (
                          locked ? (
                            <span className="text-xs text-text-secondary">
                              Đã khóa theo đợt phân bổ đã xác nhận
                              {cost.allocation?.salesInvoiceNo ? ` · Hóa đơn ${cost.allocation.salesInvoiceNo}` : ""}
                            </span>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" onClick={() => openEdit(cost)}>
                                Sửa
                              </Button>
                              <Button type="button" variant="outline" onClick={() => setDeleting(cost)}>
                                Xóa
                              </Button>
                            </div>
                          )
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProjectCostDialog
        projectId={projectId}
        open={dialogOpen}
        cost={editing}
        bomLines={summary?.byLine ?? []}
        onClose={() => setDialogOpen(false)}
      />

      <Dialog open={deleting !== null} onOpenChange={(isOpen) => !isOpen && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa chi phí này?</DialogTitle>
            <DialogDescription>
              {deleting ? `${deleting.description} · ${formatVND(deleting.amount)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              Giữ lại
            </Button>
            <Button type="button" disabled={deleteCost.isPending} onClick={handleDelete}>
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
