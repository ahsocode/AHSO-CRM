"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProjectCost, useUpdateProjectCost } from "@/hooks/use-project-costs";
import { useSuppliersSelect } from "@/hooks/use-suppliers";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { COST_GROUP_LABELS, COST_GROUP_ORDER } from "@/lib/constants";
import type { CostGroup, CostSummaryLineRow, ProjectCost, ProjectCostInput } from "@/types/bom";

const costFormSchema = z.object({
  group: z.enum(COST_GROUP_ORDER),
  description: z.string().trim().min(1, "Nhập nội dung chi phí").max(300, "Tối đa 300 ký tự"),
  supplierId: z.string(),
  invoiceNo: z.string().trim().max(60, "Tối đa 60 ký tự"),
  invoiceDate: z.string().min(1, "Chọn ngày hóa đơn"),
  amount: z
    .string()
    .min(1, "Nhập số tiền")
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, "Số tiền không hợp lệ"),
  vatRate: z
    .string()
    .refine((value) => value === "" || (Number(value) >= 0 && Number(value) <= 100), "VAT từ 0 đến 100"),
  bomLineId: z.string(),
  notes: z.string().trim().max(1000, "Tối đa 1000 ký tự")
});

type CostFormValues = z.infer<typeof costFormSchema>;

function toFormValues(cost?: ProjectCost | null): CostFormValues {
  return {
    group: cost?.group ?? "OTHER",
    description: cost?.description ?? "",
    supplierId: cost?.supplierId ?? "",
    invoiceNo: cost?.invoiceNo ?? "",
    invoiceDate: cost ? cost.invoiceDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    amount: cost ? String(cost.amount) : "",
    vatRate: cost?.vatRate !== null && cost?.vatRate !== undefined ? String(cost.vatRate) : "",
    bomLineId: cost?.bomLineId ?? "",
    notes: cost?.notes ?? ""
  };
}

interface ProjectCostDialogProps {
  projectId: string;
  open: boolean;
  /** Cost being edited; null/undefined creates a new one. */
  cost?: ProjectCost | null;
  bomLines: CostSummaryLineRow[];
  onClose: () => void;
}

export function ProjectCostDialog(props: ProjectCostDialogProps) {
  // Each opening owns a fresh form, so an effect cannot reset fields after typing starts.
  return props.open ? <ProjectCostForm key={props.cost?.id ?? "new"} {...props} /> : null;
}

function ProjectCostForm({ projectId, open, cost, bomLines, onClose }: ProjectCostDialogProps) {
  const suppliers = useSuppliersSelect();
  const createCost = useCreateProjectCost(projectId);
  const updateCost = useUpdateProjectCost(projectId);
  const form = useForm<CostFormValues>({
    resolver: zodResolver(costFormSchema),
    defaultValues: toFormValues(cost)
  });
  const { register, handleSubmit, setValue, formState } = form;
  const { errors } = formState;

  useEffect(() => {
    if (!open || formState.dirtyFields.supplierId) return;
    setValue("supplierId", cost?.supplierId ?? "");
  }, [open, cost?.supplierId, suppliers.data, formState.dirtyFields.supplierId, setValue]);

  useEffect(() => {
    if (!open || formState.dirtyFields.bomLineId) return;
    setValue("bomLineId", cost?.bomLineId ?? "");
  }, [open, cost?.bomLineId, bomLines, formState.dirtyFields.bomLineId, setValue]);

  async function onSubmit(values: CostFormValues) {
    const payload: ProjectCostInput = {
      group: values.group as CostGroup,
      description: values.description,
      supplierId: values.supplierId || null,
      invoiceNo: values.invoiceNo || null,
      invoiceDate: values.invoiceDate,
      amount: Number(values.amount),
      vatRate: values.vatRate === "" ? null : Number(values.vatRate),
      bomLineId: values.bomLineId || null,
      notes: values.notes || null
    };
    try {
      if (cost) {
        await updateCost.mutateAsync({ costId: cost.id, data: payload });
        toast("Đã cập nhật chi phí.");
      } else {
        await createCost.mutateAsync(payload);
        toast("Đã thêm chi phí trực tiếp.");
      }
      onClose();
    } catch (error) {
      toast({
        title: "Không thể lưu chi phí",
        description: getApiErrorMessage(error, "Kiểm tra lại thông tin chi phí."),
        variant: "destructive"
      });
    }
  }

  const isBusy = createCost.isPending || updateCost.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent aria-label={cost ? "Sửa chi phí trực tiếp" : "Thêm chi phí trực tiếp"} className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cost ? "Sửa chi phí trực tiếp" : "Thêm chi phí trực tiếp"}</DialogTitle>
          <DialogDescription>
            Số tiền nhập trước VAT. Chi phí gắn vào đợt phân bổ khi ngày hóa đơn không sau ngày hóa đơn bán.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cost-group">Nhóm</Label>
              <Select id="cost-group" {...register("group")}>
                {COST_GROUP_ORDER.map((group) => (
                  <option key={group} value={group}>
                    {COST_GROUP_LABELS[group]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost-supplier">Nhà cung cấp</Label>
              <Select id="cost-supplier" {...register("supplierId")}>
                <option value="">Không chọn</option>
                {(suppliers.data ?? []).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} - {supplier.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cost-description">Mô tả</Label>
            <Input id="cost-description" {...register("description")} />
            {errors.description ? <p className="text-xs text-danger">{errors.description.message}</p> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cost-invoice-no">Số hóa đơn</Label>
              <Input id="cost-invoice-no" {...register("invoiceNo")} />
              {errors.invoiceNo ? <p className="text-xs text-danger">{errors.invoiceNo.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost-invoice-date">Ngày hóa đơn</Label>
              <Input id="cost-invoice-date" type="date" {...register("invoiceDate")} />
              {errors.invoiceDate ? <p className="text-xs text-danger">{errors.invoiceDate.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cost-amount">Số tiền trước VAT (₫)</Label>
              <Input id="cost-amount" type="number" min={0} step="1" {...register("amount")} />
              {errors.amount ? <p className="text-xs text-danger">{errors.amount.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost-vat">VAT (%)</Label>
              <Input id="cost-vat" type="number" min={0} max={100} step="0.1" {...register("vatRate")} />
              {errors.vatRate ? <p className="text-xs text-danger">{errors.vatRate.message}</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cost-bom-line">Dòng BOM liên quan</Label>
            <Select id="cost-bom-line" {...register("bomLineId")}>
              <option value="">Không gắn dòng BOM</option>
              {cost?.bomLine && !bomLines.some((line) => line.bomLineId === cost.bomLineId) ? (
                <option value={cost.bomLine.id}>{cost.bomLine.bomCode} · {cost.bomLine.name}</option>
              ) : null}
              {bomLines.map((line) => (
                <option key={line.bomLineId} value={line.bomLineId}>
                  {line.bomCode} · {COST_GROUP_LABELS[line.group]} · {line.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cost-notes">Ghi chú</Label>
            <Textarea id="cost-notes" {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isBusy} onClick={onClose}>
              Đóng
            </Button>
            <Button type="submit" disabled={isBusy}>
              Lưu chi phí
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
