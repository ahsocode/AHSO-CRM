"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateStockTransfer,
  useStockTransfer,
  useUpdateStockTransfer,
} from "@/hooks/use-stock-transfers";
import { useWarehousesSelect } from "@/hooks/use-warehouses";
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
});

const transferFormSchema = z
  .object({
    date: z.string().min(1, "Ngày là bắt buộc"),
    fromWarehouseId: z.string().min(1, "Chọn kho nguồn"),
    toWarehouseId: z.string().min(1, "Chọn kho đích"),
    notes: z.string().optional(),
    items: z.array(lineItemSchema).min(1, "Phải có ít nhất 1 dòng vật tư"),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: "Kho nguồn và kho đích không được trùng nhau",
    path: ["toWarehouseId"],
  });

type TransferFormValues = z.infer<typeof transferFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function StockTransferFormScreen({
  mode = "create",
  transferId,
}: {
  mode?: "create" | "edit";
  transferId?: string;
}) {
  const router = useRouter();
  const createMutation = useCreateStockTransfer();
  const updateMutation = useUpdateStockTransfer(transferId ?? "");
  const transferQuery = useStockTransfer(mode === "edit" ? transferId : undefined);
  const warehousesSelect = useWarehousesSelect();

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      fromWarehouseId: "",
      toWarehouseId: "",
      notes: "",
      items: [createEmptyStockDocItem("transfer") as TransferFormValues["items"][0]],
    },
  });

  useEffect(() => {
    if (mode === "edit" && transferQuery.data) {
      const t = transferQuery.data;
      form.reset({
        date: t.date.slice(0, 10),
        fromWarehouseId: t.fromWarehouse.id,
        toWarehouseId: t.toWarehouse.id,
        notes: t.notes ?? "",
        items: t.items.map((item) => ({
          materialId: item.materialId,
          materialName: item.material.name,
          unit: item.material.unit,
          quantity: item.quantity,
        })),
      });
    }
  }, [form, mode, transferQuery.data]);

  const watchedItems = form.watch("items") ?? [];
  const isConfirmed = transferQuery.data?.status === "CONFIRMED" || transferQuery.data?.status === "CANCELLED";
  const isEditable = mode === "create" || !isConfirmed;

  const activeMutation = mode === "create" ? createMutation : updateMutation;
  const errorMessage = activeMutation.isError
    ? getApiErrorMessage(
        activeMutation.error,
        mode === "create" ? "Không thể tạo phiếu chuyển kho." : "Không thể cập nhật phiếu."
      )
    : null;

  if (mode === "edit" && transferQuery.isLoading) {
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
        title={mode === "create" ? "Tạo phiếu chuyển kho" : "Chỉnh sửa phiếu chuyển kho"}
        description="Điều phối vật tư giữa các kho hàng."
        action={
          <div className="flex gap-3">
            {mode === "edit" && transferId ? (
              <Link href={`/inventory/transfers/${transferId}` as Route} className={cn(buttonVariants({ variant: "outline" }))}>
                Về chi tiết
              </Link>
            ) : null}
            <Link href={"/inventory/transfers" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
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
            fromWarehouseId: values.fromWarehouseId,
            toWarehouseId: values.toWarehouseId,
            notes: values.notes || undefined,
            items: values.items.map((item) => ({
              materialId: item.materialId,
              quantity: item.quantity,
            })),
          };

          if (mode === "edit" && transferId) {
            updateMutation.mutate(payload, {
              onSuccess: () => router.push(`/inventory/transfers/${transferId}` as Route),
            });
            return;
          }

          createMutation.mutate(payload, {
            onSuccess: (t) => router.push(`/inventory/transfers/${t.id}` as Route),
          });
        })}
      >
        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="gap-2">
              <p className="v2-label text-primary-mid">Chuyển kho</p>
              <CardTitle>Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field>
                <Label htmlFor="fromWarehouseId">Kho nguồn *</Label>
                <Select id="fromWarehouseId" disabled={!isEditable || warehousesSelect.isLoading} {...form.register("fromWarehouseId")}>
                  <option value="">{warehousesSelect.isLoading ? "Đang tải..." : "Chọn kho nguồn..."}</option>
                  {(warehousesSelect.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
                <ErrorText message={form.formState.errors.fromWarehouseId?.message} />
              </Field>

              <Field>
                <Label htmlFor="toWarehouseId">Kho đích *</Label>
                <Select id="toWarehouseId" disabled={!isEditable || warehousesSelect.isLoading} {...form.register("toWarehouseId")}>
                  <option value="">{warehousesSelect.isLoading ? "Đang tải..." : "Chọn kho đích..."}</option>
                  {(warehousesSelect.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
                <ErrorText message={form.formState.errors.toWarehouseId?.message} />
              </Field>

              <Field>
                <Label htmlFor="date">Ngày chuyển *</Label>
                <Input id="date" type="date" disabled={!isEditable} {...form.register("date")} />
                <ErrorText message={form.formState.errors.date?.message} />
              </Field>

              <Field className="md:col-span-2">
                <Label htmlFor="notes">Ghi chú</Label>
                <Textarea
                  id="notes"
                  disabled={!isEditable}
                  placeholder="Lý do chuyển kho, ghi chú vận chuyển..."
                  rows={2}
                  {...form.register("notes")}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="gap-2">
              <p className="v2-label text-primary-mid">Vật tư</p>
              <CardTitle>Danh mục vật tư chuyển</CardTitle>
            </CardHeader>
            <CardContent>
              <StockDocLineItems
                mode="transfer"
                control={form.control as import("react-hook-form").Control<any, any>}
                setValue={form.setValue as unknown as (name: string, value: unknown) => void}
                fieldName="items"
                disabled={!isEditable}
              />
              <ErrorText message={form.formState.errors.items?.message} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-28 border border-white/70">
            <CardHeader className="gap-2">
              <p className="v2-label text-primary-mid">Tổng hợp</p>
              <CardTitle>Thông tin chuyển kho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Số dòng vật tư</p>
                <p className="mt-2 font-heading text-2xl font-bold text-primary">{watchedItems.length}</p>
              </div>

              {!isEditable ? (
                <div className="rounded-xl bg-warning-bg/80 px-4 py-3 text-sm text-warning">
                  Phiếu đã được xác nhận hoặc hủy, không thể chỉnh sửa.
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
                  : mode === "create" ? "Tạo phiếu chuyển kho" : "Lưu thay đổi"}
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
