"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateStockReceipt,
  useStockReceipt,
  useUpdateStockReceipt,
} from "@/hooks/use-stock-receipts";
import { useWarehousesSelect } from "@/hooks/use-warehouses";
import { useSuppliersSelect } from "@/hooks/use-suppliers";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  StockDocLineItems,
  createEmptyStockDocItem,
} from "../../_components/stock-doc-line-items";

// ─── Schema ───────────────────────────────────────────────────────────────────

const lineItemSchema = z.object({
  materialId: z.string().min(1, "Chọn vật tư"),
  materialName: z.string(),
  unit: z.string(),
  quantity: z.number().min(0.001, "Số lượng > 0"),
  unitPrice: z.number().min(0),
});

const receiptFormSchema = z.object({
  date: z.string().min(1, "Ngày là bắt buộc"),
  purchaseInvoiceNo: z.string().max(100).optional(),
  warehouseId: z.string().min(1, "Chọn kho"),
  supplierId: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "Phải có ít nhất 1 dòng vật tư"),
});

type ReceiptFormValues = z.infer<typeof receiptFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function StockReceiptFormScreen({
  mode = "create",
  receiptId,
}: {
  mode?: "create" | "edit";
  receiptId?: string;
}) {
  const router = useRouter();
  const createMutation = useCreateStockReceipt();
  const updateMutation = useUpdateStockReceipt(receiptId ?? "");
  const receiptQuery = useStockReceipt(mode === "edit" ? receiptId : undefined);
  const warehousesSelect = useWarehousesSelect();
  const suppliersSelect = useSuppliersSelect();

  const form = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptFormSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      purchaseInvoiceNo: "",
      warehouseId: "",
      supplierId: "",
      notes: "",
      items: [createEmptyStockDocItem("receipt") as ReceiptFormValues["items"][0]],
    },
  });

  useEffect(() => {
    if (mode === "edit" && receiptQuery.data) {
      const r = receiptQuery.data;
      form.reset({
        date: r.date.slice(0, 10),
        purchaseInvoiceNo: r.purchaseInvoiceNo ?? "",
        warehouseId: r.warehouse.id,
        supplierId: r.supplier?.id ?? "",
        notes: r.notes ?? "",
        items: r.items.map((item) => ({
          materialId: item.materialId,
          materialName: item.material.name,
          unit: item.material.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
    }
  }, [form, mode, receiptQuery.data]);

  const watchedItems = form.watch("items") ?? [];
  const totalAmount = watchedItems.reduce(
    (sum, item) => sum + Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
    0
  );

  const isConfirmed = receiptQuery.data?.status === "CONFIRMED" || receiptQuery.data?.status === "CANCELLED";
  const isEditable = mode === "create" || !isConfirmed;

  const activeMutation = mode === "create" ? createMutation : updateMutation;
  const errorMessage = activeMutation.isError
    ? getApiErrorMessage(
        activeMutation.error,
        mode === "create" ? "Không thể tạo phiếu nhập kho." : "Không thể cập nhật phiếu."
      )
    : null;

  if (mode === "edit" && receiptQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full" />
        <LoadingSkeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={mode === "create" ? "Tạo phiếu nhập kho" : "Chỉnh sửa phiếu nhập kho"}
        description="Nhập thông tin và danh mục vật tư nhập kho."
        action={
          <div className="flex gap-3">
            {mode === "edit" && receiptId ? (
              <Link href={`/inventory/receipts/${receiptId}` as Route} className={cn(buttonVariants({ variant: "outline" }))}>
                Về chi tiết
              </Link>
            ) : null}
            <Link href={"/inventory/receipts" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          </div>
        }
      />

      <form
        className="grid gap-5 xl:grid-cols-[1fr_300px]"
        onSubmit={form.handleSubmit((values) => {
          const payload = {
            date: values.date,
            purchaseInvoiceNo: values.purchaseInvoiceNo || undefined,
            warehouseId: values.warehouseId,
            supplierId: values.supplierId || undefined,
            notes: values.notes || undefined,
            items: values.items.map((item) => ({
              materialId: item.materialId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          };

          if (mode === "edit" && receiptId) {
            updateMutation.mutate(payload, {
              onSuccess: () => router.push(`/inventory/receipts/${receiptId}` as Route),
            });
            return;
          }

          createMutation.mutate(payload, {
            onSuccess: (r) => router.push(`/inventory/receipts/${r.id}` as Route),
          });
        })}
      >
        <div className="space-y-6">
          {/* Basic info */}
          <Card className="border border-white/70">
            <CardHeader className="gap-2">
              <p className="v2-label text-primary">Phiếu nhập</p>
              <CardTitle>Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field>
                <Label htmlFor="warehouseId">Kho nhập *</Label>
                <Select id="warehouseId" disabled={!isEditable || warehousesSelect.isLoading} {...form.register("warehouseId")}>
                  <option value="">{warehousesSelect.isLoading ? "Đang tải..." : "Chọn kho..."}</option>
                  {(warehousesSelect.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
                <ErrorText message={form.formState.errors.warehouseId?.message} />
              </Field>

              <Field>
                <Label htmlFor="supplierId">Nhà cung cấp</Label>
                <Select id="supplierId" disabled={!isEditable || suppliersSelect.isLoading} {...form.register("supplierId")}>
                  <option value="">{suppliersSelect.isLoading ? "Đang tải..." : "Chọn NCC (tùy chọn)"}</option>
                  {(suppliersSelect.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </Field>

              <Field>
                <Label htmlFor="date">Ngày hóa đơn mua / ngày nhập *</Label>
                <Input id="date" type="date" disabled={!isEditable} {...form.register("date")} />
                <ErrorText message={form.formState.errors.date?.message} />
              </Field>

              <Field>
                <Label htmlFor="purchaseInvoiceNo">Số hóa đơn mua</Label>
                <Input
                  id="purchaseInvoiceNo"
                  disabled={!isEditable}
                  placeholder="VD: 000123"
                  {...form.register("purchaseInvoiceNo")}
                />
                <ErrorText message={form.formState.errors.purchaseInvoiceNo?.message} />
              </Field>

              <Field className="md:col-span-2">
                <Label htmlFor="notes">Ghi chú</Label>
                <Textarea
                  id="notes"
                  disabled={!isEditable}
                  placeholder="Ghi chú về lô hàng, batch, nhà cung cấp..."
                  rows={2}
                  {...form.register("notes")}
                />
              </Field>
            </CardContent>
          </Card>

          {/* Line items */}
          <Card className="border border-white/70">
            <CardHeader className="gap-2">
              <p className="v2-label text-accent">Vật tư</p>
              <CardTitle>Danh mục vật tư nhập kho</CardTitle>
            </CardHeader>
            <CardContent>
              <StockDocLineItems
                mode="receipt"
                control={form.control as import("react-hook-form").Control<any, any>}
                setValue={form.setValue as unknown as (name: string, value: unknown) => void}
                fieldName="items"
                disabled={!isEditable}
              />
              <ErrorText message={form.formState.errors.items?.message} />
            </CardContent>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          <Card className="sticky top-28 border border-white/70">
            <CardHeader className="gap-2">
              <p className="v2-label text-accent">Tổng hợp</p>
              <CardTitle>Giá trị phiếu nhập</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Tổng giá trị</p>
                <div className="mt-2 font-heading text-2xl font-bold text-primary">
                  <CurrencyDisplay amount={totalAmount} />
                </div>
                <p className="mt-1 text-text-secondary">{watchedItems.length} dòng vật tư</p>
              </div>

              {!isEditable ? (
                <div className="rounded-xl bg-warning-bg/80 px-4 py-3 text-sm text-warning">
                  Phiếu đã được xác nhận hoặc hủy, không thể chỉnh sửa nội dung.
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{errorMessage}</div>
              ) : null}

              <Button
                type="submit"
                className="h-11 w-full rounded-xl"
                disabled={activeMutation.isPending || !isEditable}
              >
                <AppIcon name="arrow-right" className="h-4 w-4" />
                {activeMutation.isPending
                  ? mode === "create" ? "Đang tạo..." : "Đang lưu..."
                  : mode === "create" ? "Tạo phiếu nhập kho" : "Lưu thay đổi"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label className="text-sm font-semibold text-text-primary" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function ErrorText({ message }: { message?: string }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null;
}
