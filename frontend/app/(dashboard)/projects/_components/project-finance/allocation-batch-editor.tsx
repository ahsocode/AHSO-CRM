"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProjectBoms } from "@/hooks/use-boms";
import {
  useCreateMaterialAllocation,
  useProjectCosts,
  useSuggestMaterialAllocation,
  useUpdateMaterialAllocation
} from "@/hooks/use-project-costs";
import { useEligibleStockLots } from "@/hooks/use-projects";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { BOM_STATUS_LABELS, COST_GROUP_LABELS } from "@/lib/constants";
import { formatDate, formatVND } from "@/lib/format";
import type { EligibleStockLot, ProjectMaterialAllocation } from "@/lib/types";
import type { AllocationSuggestResult, SuggestedAllocationItem } from "@/types/bom";
import { AllocationRowsEditor, nextRowKey, type AllocationRow } from "./allocation-rows-editor";

interface AllocationBatchEditorProps {
  projectId: string;
  /** Existing DRAFT batch to edit; omit to create a new one. */
  allocation?: ProjectMaterialAllocation;
  onClose: () => void;
}

function toDateInput(value?: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function snapshotFromSuggestion(item: SuggestedAllocationItem, fallbackDate: string): EligibleStockLot {
  return {
    id: item.stockLotId,
    warehouseId: item.warehouseId,
    warehouse: item.warehouse ?? { id: item.warehouseId, code: "", name: "Kho" },
    materialId: item.materialId,
    material: {
      id: item.materialId,
      code: item.material?.code ?? "",
      name: item.material?.name ?? "Vật tư",
      unit: item.material?.unit ?? ""
    },
    receipt: null,
    purchaseInvoiceDate: item.purchaseInvoiceDate ?? fallbackDate,
    purchaseInvoiceNo: item.purchaseInvoiceNo,
    receivedQuantity: item.quantity,
    remainingQuantity: item.quantity,
    unitPrice: item.unitPrice,
    value: item.total
  };
}

export function AllocationBatchEditor({ projectId, allocation, onClose }: AllocationBatchEditorProps) {
  const bomsQuery = useProjectBoms(projectId);
  const costsQuery = useProjectCosts(projectId);
  const suggest = useSuggestMaterialAllocation(projectId);
  const createAllocation = useCreateMaterialAllocation(projectId);
  const updateAllocation = useUpdateMaterialAllocation(projectId);

  const [bomId, setBomId] = useState("");
  const [salesInvoiceDate, setSalesInvoiceDate] = useState(toDateInput(allocation?.salesInvoiceDate));
  const [salesInvoiceNo, setSalesInvoiceNo] = useState(allocation?.salesInvoiceNo ?? "");
  const [multiplier, setMultiplier] = useState(1);
  const [notes, setNotes] = useState(allocation?.notes ?? "");
  const [rows, setRows] = useState<AllocationRow[]>(() =>
    (allocation?.items ?? []).map((item) => ({
      key: nextRowKey(),
      stockLotId: item.stockLotId,
      quantity: item.quantity,
      bomLineId: item.bomLineId ?? null,
      source: "saved" as const,
      snapshot: {
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
      }
    }))
  );
  const [suggestion, setSuggestion] = useState<AllocationSuggestResult | null>(null);
  // null = the user has not touched the cost list, so the server keeps the current attachments
  const [costIds, setCostIds] = useState<string[] | null>(null);

  const eligibleLots = useEligibleStockLots(projectId, salesInvoiceDate);
  const lots = eligibleLots.data ?? [];
  const isBusy = suggest.isPending || createAllocation.isPending || updateAllocation.isPending;
  const boms = bomsQuery.data ?? [];

  const attachableCosts = useMemo(
    () =>
      (costsQuery.data ?? []).filter(
        (cost) =>
          (!cost.allocationId || cost.allocationId === allocation?.id) &&
          (!salesInvoiceDate || cost.invoiceDate.slice(0, 10) <= salesInvoiceDate)
      ),
    [costsQuery.data, allocation?.id, salesInvoiceDate]
  );
  const selectedCostIds = costIds ?? (allocation?.costs ?? []).map((cost) => cost.id);

  const totalValue = rows.reduce((sum, row) => {
    const lot = lots.find((item) => item.id === row.stockLotId) ?? row.snapshot;
    return sum + Math.round((Number(row.quantity) || 0) * (lot?.unitPrice ?? 0));
  }, 0);

  async function handleSuggest() {
    if (!bomId) {
      toast({ title: "Chọn BOM dự án để gợi ý", variant: "destructive" });
      return;
    }
    if (!salesInvoiceDate) {
      toast({ title: "Thiếu ngày hóa đơn bán ra", variant: "destructive" });
      return;
    }
    try {
      const result = await suggest.mutateAsync({
        bomId,
        salesInvoiceDate,
        quantityMultiplier: multiplier > 0 ? multiplier : 1
      });
      setSuggestion(result);
      setRows(
        result.items.map((item) => ({
          key: nextRowKey(),
          stockLotId: item.stockLotId,
          quantity: item.quantity,
          bomLineId: item.bomLineId,
          source: "suggested" as const,
          snapshot: snapshotFromSuggestion(item, salesInvoiceDate)
        }))
      );
      toast(
        result.shortages.length > 0
          ? "Đã gợi ý lô vật tư, nhưng còn vật tư thiếu hàng."
          : "Đã điền lô vật tư theo BOM."
      );
    } catch (error) {
      toast({
        title: "Không thể gợi ý theo BOM",
        description: getApiErrorMessage(error, "Kiểm tra BOM và ngày hóa đơn bán ra."),
        variant: "destructive"
      });
    }
  }

  async function handleSave() {
    if (!salesInvoiceDate) {
      toast({ title: "Thiếu ngày hóa đơn bán ra", variant: "destructive" });
      return;
    }
    const items = rows
      .filter((row) => row.stockLotId && Number(row.quantity) > 0)
      .map((row) => ({ stockLotId: row.stockLotId, quantity: Number(row.quantity), bomLineId: row.bomLineId }));
    if (items.length === 0) {
      toast({ title: "Chưa chọn lô vật tư", variant: "destructive" });
      return;
    }
    const payload = {
      salesInvoiceDate,
      salesInvoiceNo: salesInvoiceNo.trim() || undefined,
      notes: notes.trim() || undefined,
      items,
      costIds: costIds ?? undefined
    };
    try {
      if (allocation) {
        await updateAllocation.mutateAsync({ allocationId: allocation.id, data: payload });
      } else {
        await createAllocation.mutateAsync(payload);
      }
      toast("Đã lưu đợt phân bổ vật tư.");
      onClose();
    } catch (error) {
      toast({
        title: "Không thể lưu đợt phân bổ",
        description: getApiErrorMessage(error, "Kiểm tra lại lô nhập, số lượng và ngày hóa đơn."),
        variant: "destructive"
      });
    }
  }

  function toggleCost(costId: string, checked: boolean) {
    setCostIds(checked ? [...new Set([...selectedCostIds, costId])] : selectedCostIds.filter((id) => id !== costId));
  }

  return (
    <div className="space-y-5 rounded-xl bg-bg-subtle p-4" data-testid="allocation-editor">
      <h3 className="font-heading text-base font-bold text-text-primary">
        {allocation ? "Sửa đợt phân bổ nháp" : "Tạo đợt phân bổ mới"}
      </h3>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="alloc-sales-date">Ngày hóa đơn bán</Label>
          <Input
            id="alloc-sales-date"
            type="date"
            value={salesInvoiceDate}
            onChange={(event) => setSalesInvoiceDate(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alloc-sales-no">Số hóa đơn bán</Label>
          <Input
            id="alloc-sales-no"
            value={salesInvoiceNo}
            maxLength={60}
            onChange={(event) => setSalesInvoiceNo(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alloc-bom">BOM dự án</Label>
          <Select id="alloc-bom" value={bomId} onChange={(event) => setBomId(event.target.value)}>
            <option value="">Chọn BOM...</option>
            {boms.map((bom) => (
              <option key={bom.id} value={bom.id}>
                {bom.code} - {bom.name} ({BOM_STATUS_LABELS[bom.status]})
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alloc-multiplier">Số lượng máy</Label>
          <Input
            id="alloc-multiplier"
            type="number"
            min={1}
            step="1"
            value={multiplier || ""}
            onChange={(event) => setMultiplier(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={isBusy} onClick={handleSuggest}>
          Gợi ý theo BOM
        </Button>
        <p className="text-xs text-text-secondary">
          Chỉ lấy lô có ngày hóa đơn mua không sau ngày hóa đơn bán, theo thứ tự lô cũ trước.
        </p>
      </div>

      {suggestion && suggestion.shortages.length > 0 ? (
        <div className="space-y-1 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger" data-testid="allocation-shortages">
          <p className="font-semibold">Thiếu hàng ({suggestion.shortages.length} vật tư)</p>
          <ul className="list-disc pl-5">
            {suggestion.shortages.map((shortage) => (
              <li key={`${shortage.bomLineId}-${shortage.materialId}`}>
                {shortage.code ? `${shortage.code} - ` : ""}
                {shortage.name}: cần {shortage.requiredQty}, đủ {shortage.allocatedQty}, thiếu {shortage.missingQty}{" "}
                {shortage.unit ?? ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {suggestion && suggestion.serviceLines.length > 0 ? (
        <div className="space-y-1 rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning" data-testid="allocation-service-lines">
          <p className="font-semibold">Dòng dịch vụ / phần mềm chưa có chi phí</p>
          <ul className="list-disc pl-5">
            {suggestion.serviceLines.map((line) => (
              <li key={line.bomLineId}>
                {COST_GROUP_LABELS[line.group]} · {line.name} · dự toán {formatVND(line.estimatedAmount)}
              </li>
            ))}
          </ul>
          <p className="text-xs">Thêm chi phí trực tiếp ở tab &quot;Chi phí &amp; lãi gộp&quot; để tính vào giá vốn.</p>
        </div>
      ) : null}

      <AllocationRowsEditor
        rows={rows}
        eligibleLots={lots}
        lotsLoading={eligibleLots.isLoading}
        canAdd={Boolean(salesInvoiceDate)}
        disabled={isBusy}
        onChange={setRows}
      />

      {attachableCosts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-text-primary">Chi phí trực tiếp tính vào đợt này</p>
          {attachableCosts.map((cost) => (
            <label key={cost.id} className="flex items-center gap-3 text-sm text-text-primary">
              <Checkbox
                checked={selectedCostIds.includes(cost.id)}
                onCheckedChange={(checked) => toggleCost(cost.id, checked === true)}
              />
              <span>
                {COST_GROUP_LABELS[cost.group]} · {cost.description} · {formatDate(cost.invoiceDate)} ·{" "}
                {formatVND(cost.amount)}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ghi chú đợt phân bổ" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Giá vốn vật tư: <span className="font-semibold text-primary">{formatVND(totalValue)}</span>
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="outline" disabled={isBusy} onClick={onClose}>
            Đóng
          </Button>
          <Button type="button" disabled={isBusy} onClick={handleSave}>
            Lưu đợt nháp
          </Button>
        </div>
      </div>
    </div>
  );
}
