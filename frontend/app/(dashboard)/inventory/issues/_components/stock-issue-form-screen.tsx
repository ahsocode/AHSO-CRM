"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  useCreateStockIssue,
  useStockIssue,
  useUpdateStockIssue,
} from "@/hooks/use-stock-issues";
import { useWarehousesSelect } from "@/hooks/use-warehouses";
import { useProjects } from "@/hooks/use-projects";
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

const issueFormSchema = z.object({
  date: z.string().min(1, "Ngày là bắt buộc"),
  warehouseId: z.string().min(1, "Chọn kho"),
  projectId: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "Phải có ít nhất 1 dòng vật tư"),
});

type IssueFormValues = z.infer<typeof issueFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function StockIssueFormScreen({
  mode = "create",
  issueId,
}: {
  mode?: "create" | "edit";
  issueId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") ?? "";

  const createMutation = useCreateStockIssue();
  const updateMutation = useUpdateStockIssue(issueId ?? "");
  const issueQuery = useStockIssue(mode === "edit" ? issueId : undefined);
  const warehousesSelect = useWarehousesSelect();
  const projectsQuery = useProjects({ page: 1, limit: 100 });

  const form = useForm<IssueFormValues>({
    resolver: zodResolver(issueFormSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      warehouseId: "",
      projectId: initialProjectId,
      reason: "",
      notes: "",
      items: [createEmptyStockDocItem("issue") as IssueFormValues["items"][0]],
    },
  });

  useEffect(() => {
    if (mode === "edit" && issueQuery.data) {
      const d = issueQuery.data;
      form.reset({
        date: d.date.slice(0, 10),
        warehouseId: d.warehouse.id,
        projectId: d.project?.id ?? "",
        reason: d.reason ?? "",
        notes: d.notes ?? "",
        items: d.items.map((item) => ({
          materialId: item.materialId,
          materialName: item.material.name,
          unit: item.material.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
    }
  }, [form, mode, issueQuery.data]);

  const watchedItems = form.watch("items") ?? [];
  const totalAmount = watchedItems.reduce(
    (sum, item) => sum + Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
    0
  );

  const isConfirmed = issueQuery.data?.status === "CONFIRMED" || issueQuery.data?.status === "CANCELLED";
  const isEditable = mode === "create" || !isConfirmed;

  const activeMutation = mode === "create" ? createMutation : updateMutation;
  const errorMessage = activeMutation.isError
    ? getApiErrorMessage(
        activeMutation.error,
        mode === "create" ? "Không thể tạo phiếu xuất kho." : "Không thể cập nhật phiếu."
      )
    : null;

  if (mode === "edit" && issueQuery.isLoading) {
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
        title={mode === "create" ? "Tạo phiếu xuất kho" : "Chỉnh sửa phiếu xuất kho"}
        description="Cấp vật tư cho dự án hoặc mục đích nội bộ."
        action={
          <div className="flex gap-3">
            {mode === "edit" && issueId ? (
              <Link href={`/inventory/issues/${issueId}` as Route} className={cn(buttonVariants({ variant: "outline" }))}>
                Về chi tiết
              </Link>
            ) : null}
            <Link href={"/inventory/issues" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
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
            projectId: values.projectId || undefined,
            reason: values.reason || undefined,
            notes: values.notes || undefined,
            items: values.items.map((item) => ({
              materialId: item.materialId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          };

          if (mode === "edit" && issueId) {
            updateMutation.mutate(payload, {
              onSuccess: () => router.push(`/inventory/issues/${issueId}` as Route),
            });
            return;
          }

          createMutation.mutate(payload, {
            onSuccess: (d) => router.push(`/inventory/issues/${d.id}` as Route),
          });
        })}
      >
        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="gap-2">
              <p className="v2-label text-accent">Phiếu xuất</p>
              <CardTitle>Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field>
                <Label htmlFor="warehouseId">Kho xuất *</Label>
                <Select id="warehouseId" disabled={!isEditable || warehousesSelect.isLoading} {...form.register("warehouseId")}>
                  <option value="">{warehousesSelect.isLoading ? "Đang tải..." : "Chọn kho..."}</option>
                  {(warehousesSelect.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
                <ErrorText message={form.formState.errors.warehouseId?.message} />
              </Field>

              <Field>
                <Label htmlFor="projectId">Dự án (tùy chọn)</Label>
                <Select id="projectId" disabled={!isEditable || projectsQuery.isLoading} {...form.register("projectId")}>
                  <option value="">{projectsQuery.isLoading ? "Đang tải..." : "Chọn dự án (tùy chọn)"}</option>
                  {(projectsQuery.data?.items ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                  ))}
                </Select>
              </Field>

              <Field>
                <Label htmlFor="date">Ngày xuất *</Label>
                <Input id="date" type="date" disabled={!isEditable} {...form.register("date")} />
                <ErrorText message={form.formState.errors.date?.message} />
              </Field>

              <Field>
                <Label htmlFor="reason">Lý do xuất kho</Label>
                <Input
                  id="reason"
                  disabled={!isEditable}
                  placeholder="VD: Xuất cho dự án triển khai, hỏng hỏa..."
                  {...form.register("reason")}
                />
              </Field>

              <Field className="md:col-span-2">
                <Label htmlFor="notes">Ghi chú</Label>
                <Textarea
                  id="notes"
                  disabled={!isEditable}
                  placeholder="Ghi chú bổ sung..."
                  rows={2}
                  {...form.register("notes")}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="gap-2">
              <p className="v2-label text-accent">Vật tư</p>
              <CardTitle>Danh mục vật tư xuất kho</CardTitle>
            </CardHeader>
            <CardContent>
              <StockDocLineItems
                mode="issue"
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
              <p className="v2-label text-accent">Tổng hợp</p>
              <CardTitle>Giá trị phiếu xuất</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Tổng giá trị</p>
                <div className="mt-2 font-heading text-2xl font-bold text-accent">
                  <CurrencyDisplay amount={totalAmount} />
                </div>
                <p className="mt-1 text-text-secondary">{watchedItems.length} dòng vật tư</p>
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
                  : mode === "create" ? "Tạo phiếu xuất kho" : "Lưu thay đổi"}
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
