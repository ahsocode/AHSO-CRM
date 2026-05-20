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
import {
  useCreateWarehouse,
  useUpdateWarehouse,
  useWarehouse,
} from "@/hooks/use-warehouses";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const warehouseFormSchema = z.object({
  code: z.string().min(1, "Mã kho là bắt buộc"),
  name: z.string().min(1, "Tên kho là bắt buộc"),
  address: z.string().optional(),
  managerId: z.string().optional(),
  isActive: z.boolean(),
});

type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

const defaultValues: WarehouseFormValues = {
  code: "",
  name: "",
  address: "",
  managerId: "",
  isActive: true,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function WarehouseFormScreen({
  mode = "create",
  warehouseId,
}: {
  mode?: "create" | "edit";
  warehouseId?: string;
}) {
  const router = useRouter();
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse(warehouseId ?? "");
  const warehouseQuery = useWarehouse(mode === "edit" ? warehouseId : undefined);

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (mode === "edit" && warehouseQuery.data) {
      const w = warehouseQuery.data;
      form.reset({
        code: w.code,
        name: w.name,
        address: w.address ?? "",
        managerId: w.manager?.id ?? "",
        isActive: w.isActive,
      });
    }
  }, [form, mode, warehouseQuery.data]);

  const activeMutation = mode === "create" ? createMutation : updateMutation;
  const errorMessage = activeMutation.isError
    ? getApiErrorMessage(
        activeMutation.error,
        mode === "create" ? "Không thể tạo kho." : "Không thể cập nhật kho."
      )
    : null;

  if (mode === "edit" && warehouseQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full" />
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={mode === "create" ? "Thêm kho mới" : "Chỉnh sửa kho"}
        description="Quản lý thông tin kho hàng và phân quyền quản lý kho."
        action={
          <Link href={"/inventory/warehouses" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
            Về danh sách kho
          </Link>
        }
      />

      <form
        className="max-w-2xl space-y-6"
        onSubmit={form.handleSubmit((values) => {
          const payload = {
            code: values.code,
            name: values.name,
            address: values.address || undefined,
            managerId: values.managerId || undefined,
            isActive: values.isActive,
          };

          if (mode === "edit" && warehouseId) {
            updateMutation.mutate(payload, {
              onSuccess: () => router.push(`/inventory/warehouses/${warehouseId}` as Route),
            });
            return;
          }

          createMutation.mutate(payload, {
            onSuccess: (w) => router.push(`/inventory/warehouses/${w.id}` as Route),
          });
        })}
      >
        <Card className="border border-white/70">
          <CardHeader className="gap-2">
            <p className="v2-label text-primary">Thông tin kho</p>
            <CardTitle>Thông tin cơ bản</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field>
              <Label htmlFor="code">Mã kho *</Label>
              <Input id="code" placeholder="VD: WH-HN-01" {...form.register("code")} />
              <ErrorText message={form.formState.errors.code?.message} />
            </Field>

            <Field>
              <Label htmlFor="name">Tên kho *</Label>
              <Input id="name" placeholder="VD: Kho Hà Nội" {...form.register("name")} />
              <ErrorText message={form.formState.errors.name?.message} />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="address">Địa chỉ</Label>
              <Input
                id="address"
                placeholder="Địa chỉ kho hàng..."
                {...form.register("address")}
              />
            </Field>

            <Field>
              <Label htmlFor="managerId">Mã quản lý kho (user ID)</Label>
              <Input
                id="managerId"
                placeholder="ID người quản lý kho (tuỳ chọn)"
                {...form.register("managerId")}
              />
              <p className="text-xs text-text-muted">Nhập ID người dùng để gán phụ trách kho.</p>
            </Field>

            <Field>
              <Label htmlFor="isActive">Trạng thái</Label>
              <Select
                id="isActive"
                {...form.register("isActive", {
                  setValueAs: (v) => v === "true" || v === true,
                })}
              >
                <option value="true">Đang hoạt động</option>
                <option value="false">Ngừng hoạt động</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        {errorMessage ? (
          <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{errorMessage}</div>
        ) : null}

        <Button
          type="submit"
          disabled={activeMutation.isPending}
          className="h-11 rounded-xl"
        >
          <AppIcon name="arrow-right" className="h-4 w-4" />
          {activeMutation.isPending
            ? mode === "create" ? "Đang tạo..." : "Đang lưu..."
            : mode === "create" ? "Tạo kho" : "Lưu thay đổi"}
        </Button>
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
