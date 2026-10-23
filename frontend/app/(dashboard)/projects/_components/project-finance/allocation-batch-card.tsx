"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCancelMaterialAllocation, useConfirmMaterialAllocation } from "@/hooks/use-project-costs";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { COST_GROUP_LABELS, STOCK_DOC_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatVND } from "@/lib/format";
import type { ProjectMaterialAllocation } from "@/lib/types";
import { exportAllocationCostSheet } from "./export-cost-sheet";

const STATUS_VARIANT = {
  DRAFT: "neutral",
  CONFIRMED: "success",
  CANCELLED: "danger"
} as const;

interface AllocationBatchCardProps {
  projectId: string;
  allocation: ProjectMaterialAllocation;
  canEdit: boolean;
  onEdit: (allocation: ProjectMaterialAllocation) => void;
}

export function AllocationBatchCard({ projectId, allocation, canEdit, onEdit }: AllocationBatchCardProps) {
  const confirmAllocation = useConfirmMaterialAllocation(projectId);
  const cancelAllocation = useCancelMaterialAllocation(projectId);
  const [expanded, setExpanded] = useState(allocation.status === "CONFIRMED");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isDraft = allocation.status === "DRAFT";
  const isConfirmed = allocation.status === "CONFIRMED";
  const costTotal = allocation.costTotal ?? 0;
  const isBusy = confirmAllocation.isPending || cancelAllocation.isPending;

  async function handleConfirm() {
    try {
      await confirmAllocation.mutateAsync(allocation.id);
      toast("Đã xác nhận đợt phân bổ và xuất kho cho dự án.");
    } catch (error) {
      toast({
        title: "Không thể xác nhận đợt phân bổ",
        description: getApiErrorMessage(error, "Kiểm tra tồn lô và ngày hóa đơn bán ra."),
        variant: "destructive"
      });
    }
  }

  async function handleCancel() {
    try {
      await cancelAllocation.mutateAsync(allocation.id);
      setCancelOpen(false);
      toast("Đã hủy đợt phân bổ nháp.");
    } catch (error) {
      toast({
        title: "Không thể hủy đợt phân bổ",
        description: getApiErrorMessage(error, "Chỉ hủy được đợt nháp."),
        variant: "destructive"
      });
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportAllocationCostSheet(allocation.id);
    } catch (error) {
      toast({
        title: "Không thể xuất bảng kê giá vốn",
        description: getApiErrorMessage(error, "Vui lòng thử lại."),
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl bg-bg-subtle p-4" data-testid="allocation-batch" data-status={allocation.status} data-allocation-id={allocation.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-base font-bold text-text-primary">
              Hóa đơn bán {allocation.salesInvoiceNo ? `số ${allocation.salesInvoiceNo}` : "chưa có số"}
            </h3>
            <Badge variant={STATUS_VARIANT[allocation.status]}>{STOCK_DOC_STATUS_LABELS[allocation.status]}</Badge>
          </div>
          <p className="text-sm text-text-secondary">
            Ngày hóa đơn bán: {formatDate(allocation.salesInvoiceDate)} · {allocation.items.length} lô vật tư
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-text-secondary">Tổng giá vốn</p>
          <p className="font-heading text-xl font-bold text-primary">{formatVND(allocation.totalAmount + costTotal)}</p>
          {costTotal > 0 ? (
            <p className="text-xs text-text-secondary">
              Vật tư {formatVND(allocation.totalAmount)} · Chi phí {formatVND(costTotal)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Ẩn chi tiết" : "Xem chi tiết"}
        </Button>
        {isDraft && canEdit ? (
          <>
            <Button type="button" variant="outline" disabled={isBusy} onClick={() => onEdit(allocation)}>
              Sửa đợt nháp
            </Button>
            <Button type="button" disabled={isBusy} onClick={handleConfirm}>
              Xác nhận xuất kho
            </Button>
            <Button type="button" variant="outline" disabled={isBusy} onClick={() => setCancelOpen(true)}>
              Hủy đợt
            </Button>
          </>
        ) : null}
        {isConfirmed ? (
          <Button type="button" variant="outline" disabled={exporting} onClick={handleExport}>
            Xuất bảng kê giá vốn
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-text-secondary">
              <tr>
                <th className="pb-2 pr-4">Vật tư</th>
                <th className="pb-2 pr-4">Lô nhập</th>
                <th className="pb-2 pr-4">Kho</th>
                <th className="pb-2 pr-4 text-right">Số lượng</th>
                <th className="pb-2 text-right">Giá trị</th>
              </tr>
            </thead>
            <tbody>
              {allocation.items.map((item) => (
                <tr key={item.id} className="odd:bg-bg-card/60">
                  <td className="py-2 pr-4">
                    <p className="font-semibold text-text-primary">{item.material.name}</p>
                    <p className="text-xs text-text-secondary">{item.material.code}</p>
                  </td>
                  <td className="py-2 pr-4">
                    {item.receipt?.receiptNo ?? "Lô điều chỉnh kiểm kê"}
                    <p className="text-xs text-text-secondary">
                      {formatDate(item.purchaseInvoiceDate)}
                      {item.purchaseInvoiceNo ? ` · ${item.purchaseInvoiceNo}` : ""}
                    </p>
                  </td>
                  <td className="py-2 pr-4">{item.warehouse.name}</td>
                  <td className="py-2 pr-4 text-right">
                    {item.quantity} {item.material.unit}
                  </td>
                  <td className="py-2 text-right">{formatVND(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {allocation.costs && allocation.costs.length > 0 ? (
            <ul className="space-y-1 text-sm text-text-secondary">
              {allocation.costs.map((cost) => (
                <li key={cost.id}>
                  {COST_GROUP_LABELS[cost.group]} · {cost.description} · {formatDate(cost.invoiceDate)} ·{" "}
                  {formatVND(cost.amount)}
                </li>
              ))}
            </ul>
          ) : null}
          {allocation.notes ? <p className="text-sm text-text-secondary">Ghi chú: {allocation.notes}</p> : null}
        </div>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy đợt phân bổ nháp?</DialogTitle>
            <DialogDescription>
              Đợt phân bổ sẽ chuyển sang trạng thái đã hủy và các lô vật tư được giải phóng. Thao tác này không hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Giữ lại
            </Button>
            <Button type="button" disabled={cancelAllocation.isPending} onClick={handleCancel}>
              Xác nhận hủy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
