"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useConfirmProjectMaterialAllocation,
  useEligibleStockLots,
  useProject,
  useProjectMaterialAllocation,
  useSaveProjectMaterialAllocation
} from "@/hooks/use-projects";
import { useStockIssues } from "@/hooks/use-stock-issues";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { STOCK_DOC_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatVND } from "@/lib/format";

type AllocationRow = {
  stockLotId: string;
  quantity: number;
};

export function ProjectMaterialsTab({ projectId }: { projectId: string }) {
  const projectQuery = useProject(projectId);
  const allocationQuery = useProjectMaterialAllocation(projectId);
  const issues = useStockIssues({ projectId, status: "CONFIRMED", limit: 50, page: 1 });
  const saveAllocation = useSaveProjectMaterialAllocation(projectId);
  const confirmAllocation = useConfirmProjectMaterialAllocation(projectId);

  const project = projectQuery.data;
  const allocation = allocationQuery.data;
  const salesInvoiceDate = project?.salesInvoiceDate?.slice(0, 10) ?? allocation?.salesInvoiceDate?.slice(0, 10) ?? "";
  const eligibleLots = useEligibleStockLots(projectId, salesInvoiceDate);
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!allocation) return;
    setRows(allocation.items.map((item) => ({ stockLotId: item.stockLotId, quantity: item.quantity })));
    setNotes(allocation.notes ?? "");
  }, [allocation]);

  const lotById = useMemo(() => {
    const map = new Map((eligibleLots.data ?? []).map((lot) => [lot.id, lot]));
    allocation?.items.forEach((item) => {
      if (!map.has(item.stockLotId)) {
        map.set(item.stockLotId, {
          id: item.stockLotId,
          warehouseId: item.warehouseId,
          warehouse: item.warehouse,
          materialId: item.materialId,
          material: item.material,
          receipt: item.receipt,
          purchaseInvoiceDate: item.purchaseInvoiceDate,
          purchaseInvoiceNo: item.purchaseInvoiceNo,
          receivedQuantity: item.quantity,
          remainingQuantity: item.remainingQuantity,
          unitPrice: item.unitPrice,
          value: item.total
        });
      }
    });
    return map;
  }, [allocation?.items, eligibleLots.data]);

  const issueItems = issues.data?.items ?? [];
  const totalIssuedValue = issueItems.reduce((s, i) => s + i.totalAmount, 0);
  const totalDraftValue = rows.reduce((sum, row) => {
    const lot = lotById.get(row.stockLotId);
    return sum + Math.round((Number(row.quantity) || 0) * (lot?.unitPrice ?? 0));
  }, 0);
  const isCompleted = project?.status === "COMPLETED";
  const isConfirmed = allocation?.status === "CONFIRMED";
  const isBusy = saveAllocation.isPending || confirmAllocation.isPending;

  if (projectQuery.isLoading || allocationQuery.isLoading || issues.isLoading) {
    return <div className="p-4 text-sm text-text-secondary">Đang tải...</div>;
  }

  async function handleSave() {
    if (!salesInvoiceDate) {
      toast({ title: "Thiếu ngày hóa đơn bán ra", variant: "destructive" });
      return;
    }
    const items = rows.filter((row) => row.stockLotId && Number(row.quantity) > 0);
    if (!items.length) {
      toast({ title: "Chưa chọn lô vật tư", variant: "destructive" });
      return;
    }

    try {
      await saveAllocation.mutateAsync({ salesInvoiceDate, notes: notes || undefined, items });
      toast("Đã lưu phân bổ vật tư.");
    } catch (error) {
      toast({
        title: "Không thể lưu phân bổ",
        description: getApiErrorMessage(error, "Kiểm tra lại lô nhập và số lượng."),
        variant: "destructive"
      });
    }
  }

  async function handleConfirm() {
    try {
      await confirmAllocation.mutateAsync();
      toast("Đã xác nhận phân bổ và xuất kho cho dự án.");
    } catch (error) {
      toast({
        title: "Không thể xác nhận phân bổ",
        description: getApiErrorMessage(error, "Kiểm tra tồn lô và ngày hóa đơn bán ra."),
        variant: "destructive"
      });
    }
  }

  return (
    <div className="space-y-6">
      {isCompleted ? (
        <div className="space-y-4 rounded-xl border border-border/60 bg-white/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Phân bổ vật tư</p>
              <h3 className="mt-1 font-heading text-lg font-bold text-text-primary">
                {isConfirmed ? "Đã xác nhận phân bổ" : allocation ? "Phân bổ nháp" : "Chưa phân bổ vật tư"}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Ngày hóa đơn bán ra: {salesInvoiceDate ? formatDate(salesInvoiceDate) : "Chưa ghi nhận"}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="text-text-secondary">Giá trị phân bổ</p>
              <p className="font-heading text-xl font-bold text-primary">
                {formatVND(allocation?.totalAmount ?? totalDraftValue)}
              </p>
            </div>
          </div>

          {!salesInvoiceDate ? (
            <div className="rounded-lg bg-warning-bg/80 px-4 py-3 text-sm text-warning">
              Dự án hoàn thành nhưng chưa có ngày hóa đơn bán ra. Hãy cập nhật dự án trước khi phân bổ vật tư.
            </div>
          ) : null}

          {!isConfirmed ? (
            <>
              <div className="space-y-3">
                {rows.length === 0 ? (
                  <div className="rounded-lg bg-bg-subtle px-4 py-6 text-center text-sm text-text-secondary">
                    Chọn lô nhập hợp lệ để phân bổ cho dự án.
                  </div>
                ) : (
                  rows.map((row, index) => {
                    const lot = lotById.get(row.stockLotId);
                    return (
                      <div key={index} className="grid gap-3 rounded-lg border border-border/50 p-3 lg:grid-cols-[1fr_140px_84px]">
                        <Select
                          value={row.stockLotId}
                          onChange={(event) => {
                            const nextLot = lotById.get(event.target.value);
                            setRows((current) =>
                              current.map((item, rowIndex) =>
                                rowIndex === index
                                  ? { stockLotId: event.target.value, quantity: Math.min(item.quantity || 1, nextLot?.remainingQuantity ?? 1) }
                                  : item
                              )
                            );
                          }}
                        >
                          <option value="">Chọn lô nhập...</option>
                          {(eligibleLots.data ?? []).map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.material.code} - {option.material.name} | {option.warehouse.name} | {formatDate(option.purchaseInvoiceDate)} | còn {option.remainingQuantity} {option.material.unit}
                            </option>
                          ))}
                        </Select>
                        <Input
                          type="number"
                          min={0.001}
                          step="0.001"
                          max={lot?.remainingQuantity}
                          value={row.quantity || ""}
                          onChange={(event) => {
                            const quantity = Number(event.target.value);
                            setRows((current) =>
                              current.map((item, rowIndex) => (rowIndex === index ? { ...item, quantity } : item))
                            );
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                        >
                          Xóa
                        </Button>
                        {lot ? (
                          <div className="text-xs text-text-secondary lg:col-span-3">
                            {lot.receipt ? `Phiếu nhập ${lot.receipt.receiptNo}` : "Lô điều chỉnh kiểm kê"}
                            {lot.purchaseInvoiceNo ? ` · HĐ mua ${lot.purchaseInvoiceNo}` : ""}
                            {" · "}
                            {lot.warehouse.name} · Đơn giá {formatVND(lot.unitPrice)} · Còn {lot.remainingQuantity} {lot.material.unit}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!salesInvoiceDate || eligibleLots.isLoading}
                  onClick={() => setRows((current) => [...current, { stockLotId: "", quantity: 1 }])}
                >
                  Thêm lô vật tư
                </Button>
                <Button type="button" disabled={isBusy || !salesInvoiceDate} onClick={handleSave}>
                  Lưu phân bổ nháp
                </Button>
                {allocation?.status === "DRAFT" ? (
                  <Button type="button" disabled={isBusy} onClick={handleConfirm}>
                    Xác nhận xuất kho
                  </Button>
                ) : null}
              </div>

              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ghi chú phân bổ vật tư"
              />
            </>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-text-secondary">
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
                  <tr key={item.id} className="border-b border-border/30">
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
                    <td className="py-2 pr-4 text-right">{item.quantity} {item.material.unit}</td>
                    <td className="py-2 text-right">{formatVND(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-bg-subtle px-4 py-3 text-sm text-text-secondary">
          Dự án chưa hoàn thành. Phân bổ vật tư sẽ mở sau khi chuyển dự án sang Hoàn thành.
        </div>
      )}

      {totalIssuedValue > 0 && (
        <div className="rounded-lg bg-bg-subtle px-4 py-3 text-sm">
          Tổng giá trị vật tư đã xuất:{" "}
          <span className="font-semibold text-primary">{formatVND(totalIssuedValue)}</span>
        </div>
      )}

      {issueItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-secondary">
          Chưa có phiếu xuất kho nào cho dự án này
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-text-secondary">
            <tr>
              <th className="pb-2 pr-4">Số phiếu</th>
              <th className="pb-2 pr-4">Ngày</th>
              <th className="pb-2 pr-4">Kho</th>
              <th className="pb-2 pr-4">Trạng thái</th>
              <th className="pb-2 text-right">Giá trị</th>
            </tr>
          </thead>
          <tbody>
            {issueItems.map((issue) => (
              <tr key={issue.id} className="border-b border-border/30">
                <td className="py-2 pr-4">
                  <Link href={`/inventory/issues/${issue.id}` as Route} className="text-primary hover:underline">
                    {issue.issueNo}
                  </Link>
                </td>
                <td className="py-2 pr-4">{formatDate(issue.date)}</td>
                <td className="py-2 pr-4">{issue.warehouse.name}</td>
                <td className="py-2 pr-4">{STOCK_DOC_STATUS_LABELS[issue.status]}</td>
                <td className="py-2 text-right">{formatVND(issue.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pt-2">
        <Link href={`/inventory/issues/new?projectId=${projectId}` as Route} className="text-sm text-primary hover:underline">
          + Tạo phiếu xuất kho thủ công cho dự án này
        </Link>
      </div>
    </div>
  );
}
