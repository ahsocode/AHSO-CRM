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
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateStockCount,
  useStockCount,
  useUpdateStockCount,
} from "@/hooks/use-stock-counts";
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
  systemQuantity: z.number(),
  actualQuantity: z.number().min(0),
});

const countFormSchema = z.object({
  date: z.string().min(1, "Ngày là bắt buộc"),
  warehouseId: z.string().min(1, "Chọn kho"),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "Phải có ít nhất 1 dòng vật tư"),
});

type CountFormValues = z.infer<typeof countFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function StockCountFormScreen({
  mode = "create",
  countId,
}: {
  mode?: "create" | "edit";
  countId?: string;
}) {
  const router = useRouter();
  const createMutation = useCreateStockCount();
  const updateMutation = useUpdateStockCount(countId ?? "");
  const countQuery = useStockCount(mode === "edit" ? countId : undefined);
  const warehousesSelect = useWarehousesSelect();

  const form = useForm<CountFormValues>({
    resolver: zodResolver(countFormSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      warehouseId: "",
      notes: "",
      items: [createEmptyStockDocItem("count") as CountFormValues["items"][0]],
    },
  });

  useEffect(() => {
    if (mode === "edit" && countQuery.data) {
      const c = countQuery.data;
      form.reset({
        date: c.date.slice(0, 10),
        warehouseId: c.warehouse.id,
        notes: c.notes ?? "",
        items: c.items.map((item) => ({
          materialId: item.materialId,
          materialName: item.material.name,
          unit: item.material.unit,
          systemQuantity: item.systemQuantity,
          actualQuantity: item.actualQuantity,
        })),
      });
    }
  }, [form, mode, countQuery.data]);

  const watchedItems = form.watch("items") ?? [];
  const isConfirmed = countQuery.data?.status === "CONFIRMED" || countQuery.data?.status === "CANCELLED";
  const isEditable = mode === "create" || !isConfirmed;

  const activeMutation = mode === "create" ? createMutation : updateMutation;
  const errorMessage = activeMutation.isError
    ? getApiErrorMessage(
        activeMutation.error,
        mode === "create" ? "Không thể tạo phiếu kiểm kê." : "Không thể cập nhật phiếu."
      )
    : null;

  if (mode === "edit" && countQuery.isLoading) {
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
        title={mode === "create" ? "Tạo phiếu kiểm kê" : "Chỉnh sửa phiếu kiểm kê"}
        description="Đối chiếu số liệu tồn kho thực tế với số liệu hệ thống."
        action={
          <div className="flex gap-3">
            {mode === "edit" && countId ? (
              <Link href={`/inventory/counts/${countId}` as Route} className={cn(buttonVariants({ variant: "outline" }))}>
                Về chi tiết
              </Link>
            ) : null}
            <Link href={"/inventory/counts" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
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
            warehouseId: values.warehouseId,
            notes: values.notes || undefined,
            items: values.items.map((item) => ({
              materialId: item.materialId,
              actualQuantity: item.actualQuantity,
            })),
          };

          if (mode === "edit" && countId) {
            updateMutation.mutate(payload, {
              onSuccess: () => router.push(`/inventory/counts/${countId}` as Route),
            });
            return;
          }

          createMutation.mutate(payload, {
            onSuccess: (c) => router.push(`/inventory/counts/${c.id}` as Route),
          });
        })}
      >
        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="gap-2">
              <p className="v2-label text-primary">Kiểm kê</p>
              <CardTitle>Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field>
                <Label htmlFor="warehouseId">Kho kiểm kê *</Label>
                <Select id="warehouseId" disabled={!isEditable || warehousesSelect.isLoading} {...form.register("warehouseId")}>
                  <option value="">{warehousesSelect.isLoading ? "Đang tải..." : "Chọn kho..."}</option>
                  {(warehousesSelect.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
                <ErrorText message={form.formState.errors.warehouseId?.message} />
              </Field>

              <Field>
                <Label htmlFor="date">Ngày kiểm kê *</Label>
                <Input id="date" type="date" disabled={!isEditable} {...form.register("date")} />
                <ErrorText message={form.formState.errors.date?.message} />
              </Field>

              <Field className="md:col-span-2">
                <Label htmlFor="notes">Ghi chú</Label>
                <Textarea
                  id="notes"
                  disabled={!isEditable}
                  placeholder="Ghi chú về đợt kiểm kê..."
                  rows={2}
                  {...form.register("notes")}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="gap-2">
              <p className="v2-label text-primary">Vật tư</p>
              <CardTitle>Danh sách vật tư kiểm kê</CardTitle>
            </CardHeader>
            <CardContent>
              <StockDocLineItems
                mode="count"
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
              <p className="v2-label text-primary">Tổng hợp</p>
              <CardTitle>Thông tin kiểm kê</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Số dòng kiểm kê</p>
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
                  : mode === "create" ? "Tạo phiếu kiểm kê" : "Lưu thay đổi"}
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
