"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateSupplier,
  useSupplier,
  useUpdateSupplier,
} from "@/hooks/use-suppliers";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supplierFormSchema, type SupplierFormValues } from "./form-schemas";

function Field({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-text-primary">
      {children}
      {required ? <span className="ml-1 text-danger">*</span> : null}
    </label>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-danger">{message}</p>;
}

export function SupplierFormScreen({
  mode = "create",
  supplierId,
}: {
  mode?: "create" | "edit";
  supplierId?: string;
}) {
  const router = useRouter();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier(supplierId ?? "");
  const supplierQuery = useSupplier(mode === "edit" ? supplierId : undefined);

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      code: "",
      name: "",
      taxCode: "",
      address: "",
      phone: "",
      email: "",
      contactName: "",
      notes: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (mode === "edit" && supplierQuery.data) {
      const s = supplierQuery.data;
      form.reset({
        code: s.code,
        name: s.name,
        taxCode: s.taxCode ?? "",
        address: s.address ?? "",
        phone: s.phone ?? "",
        email: s.email ?? "",
        contactName: s.contactName ?? "",
        notes: s.notes ?? "",
        isActive: s.isActive,
      });
    }
  }, [mode, supplierQuery.data, form]);

  const isLoading = mode === "edit" && supplierQuery.isLoading;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const apiError = mode === "create" ? createMutation.error : updateMutation.error;

  function onSubmit(values: SupplierFormValues) {
    const payload = {
      ...values,
      taxCode: values.taxCode || undefined,
      address: values.address || undefined,
      phone: values.phone || undefined,
      email: values.email || undefined,
      contactName: values.contactName || undefined,
      notes: values.notes || undefined,
    };

    if (mode === "create") {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success("Đã thêm nhà cung cấp thành công.");
          router.push("/suppliers" as Route);
        },
        onError: () => {
          toast.error("Không thể thêm nhà cung cấp.");
        },
      });
    } else {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          toast.success("Đã cập nhật nhà cung cấp.");
          router.push(`/suppliers/${supplierId}` as Route);
        },
        onError: () => {
          toast.error("Không thể cập nhật nhà cung cấp.");
        },
      });
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={mode === "create" ? "Thêm nhà cung cấp" : "Chỉnh sửa nhà cung cấp"}
        description={
          mode === "create"
            ? "Điền thông tin để thêm nhà cung cấp mới vào hệ thống."
            : "Cập nhật thông tin nhà cung cấp."
        }
        action={
          <Link
            href={(mode === "edit" && supplierId ? `/suppliers/${supplierId}` : "/suppliers") as Route}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Hủy
          </Link>
        }
      />

      {isLoading ? (
        <Card className="border border-white/70">
          <CardContent className="space-y-4 pt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {mode === "create" ? "Tạo mới" : "Chỉnh sửa"}
            </p>
            <CardTitle>Thông tin nhà cung cấp</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <Label htmlFor="supplier-code" required>
                    Mã NCC
                  </Label>
                  <Input
                    id="supplier-code"
                    placeholder="Ví dụ: NCC-001"
                    {...form.register("code")}
                  />
                  <ErrorText message={form.formState.errors.code?.message} />
                </Field>

                <Field>
                  <Label htmlFor="supplier-name" required>
                    Tên nhà cung cấp
                  </Label>
                  <Input
                    id="supplier-name"
                    placeholder="Tên đầy đủ của nhà cung cấp"
                    {...form.register("name")}
                  />
                  <ErrorText message={form.formState.errors.name?.message} />
                </Field>

                <Field>
                  <Label htmlFor="supplier-taxCode">Mã số thuế</Label>
                  <Input
                    id="supplier-taxCode"
                    placeholder="0123456789"
                    {...form.register("taxCode")}
                  />
                  <ErrorText message={form.formState.errors.taxCode?.message} />
                </Field>

                <Field>
                  <Label htmlFor="supplier-phone">Số điện thoại</Label>
                  <Input
                    id="supplier-phone"
                    placeholder="0901 234 567"
                    {...form.register("phone")}
                  />
                  <ErrorText message={form.formState.errors.phone?.message} />
                </Field>

                <Field>
                  <Label htmlFor="supplier-email">Email</Label>
                  <Input
                    id="supplier-email"
                    type="email"
                    placeholder="lienhe@nhacungcap.vn"
                    {...form.register("email")}
                  />
                  <ErrorText message={form.formState.errors.email?.message} />
                </Field>

                <Field>
                  <Label htmlFor="supplier-contactName">Người liên hệ</Label>
                  <Input
                    id="supplier-contactName"
                    placeholder="Tên người liên hệ chính"
                    {...form.register("contactName")}
                  />
                  <ErrorText message={form.formState.errors.contactName?.message} />
                </Field>

                <Field className="md:col-span-2">
                  <Label htmlFor="supplier-address">Địa chỉ</Label>
                  <Input
                    id="supplier-address"
                    placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố"
                    {...form.register("address")}
                  />
                  <ErrorText message={form.formState.errors.address?.message} />
                </Field>

                <Field className="md:col-span-2">
                  <Label htmlFor="supplier-notes">Ghi chú</Label>
                  <Textarea
                    id="supplier-notes"
                    placeholder="Ghi chú nội bộ về nhà cung cấp..."
                    rows={3}
                    {...form.register("notes")}
                  />
                  <ErrorText message={form.formState.errors.notes?.message} />
                </Field>

                <Field className="md:col-span-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="supplier-isActive"
                      checked={form.watch("isActive")}
                      onCheckedChange={(checked) =>
                        form.setValue("isActive", Boolean(checked))
                      }
                    />
                    <label
                      htmlFor="supplier-isActive"
                      className="cursor-pointer text-sm font-semibold text-text-primary"
                    >
                      Đang hoạt động
                    </label>
                  </div>
                </Field>
              </div>

              {apiError ? (
                <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">
                  {getApiErrorMessage(apiError, "Không thể lưu nhà cung cấp.")}
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <Link
                  href={
                    (mode === "edit" && supplierId
                      ? `/suppliers/${supplierId}`
                      : "/suppliers") as Route
                  }
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Hủy
                </Link>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending
                    ? "Đang lưu..."
                    : mode === "create"
                      ? "Thêm nhà cung cấp"
                      : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
