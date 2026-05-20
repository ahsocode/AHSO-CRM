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
  useCreateMaterial,
  useMaterial,
  useUpdateMaterial,
} from "@/hooks/use-materials";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { materialFormSchema, type MaterialFormValues } from "./form-schemas";
import { MaterialCategorySelect } from "./material-category-select";

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

export function MaterialFormScreen({
  mode = "create",
  materialId,
}: {
  mode?: "create" | "edit";
  materialId?: string;
}) {
  const router = useRouter();
  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial(materialId ?? "");
  const materialQuery = useMaterial(mode === "edit" ? materialId : undefined);

  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: {
      code: "",
      name: "",
      unit: "",
      salePrice: 0,
      costPrice: 0,
      minStock: undefined,
      categoryId: "",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (mode === "edit" && materialQuery.data) {
      const m = materialQuery.data;
      form.reset({
        code: m.code,
        name: m.name,
        unit: m.unit,
        salePrice: m.salePrice,
        costPrice: m.costPrice,
        minStock: m.minStock ?? undefined,
        categoryId: m.category?.id ?? "",
        description: m.description ?? "",
        isActive: m.isActive,
      });
    }
  }, [mode, materialQuery.data, form]);

  const isLoading = mode === "edit" && materialQuery.isLoading;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const apiError = mode === "create" ? createMutation.error : updateMutation.error;

  function onSubmit(values: MaterialFormValues) {
    const payload = {
      ...values,
      categoryId: values.categoryId || undefined,
      description: values.description || undefined,
    };

    if (mode === "create") {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success("Đã thêm vật tư thành công.");
          router.push("/materials" as Route);
        },
        onError: () => {
          toast.error("Không thể thêm vật tư.");
        },
      });
    } else {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          toast.success("Đã cập nhật vật tư.");
          router.push(`/materials/${materialId}` as Route);
        },
        onError: () => {
          toast.error("Không thể cập nhật vật tư.");
        },
      });
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={mode === "create" ? "Thêm vật tư" : "Chỉnh sửa vật tư"}
        description={
          mode === "create"
            ? "Điền thông tin để thêm vật tư mới vào danh mục."
            : "Cập nhật thông tin vật tư."
        }
        action={
          <Link
            href={
              (mode === "edit" && materialId
                ? `/materials/${materialId}`
                : "/materials") as Route
            }
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
            <CardTitle>Thông tin vật tư</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <Label htmlFor="material-code" required>
                    Mã vật tư
                  </Label>
                  <Input
                    id="material-code"
                    placeholder="Ví dụ: VT-001"
                    {...form.register("code")}
                  />
                  <ErrorText message={form.formState.errors.code?.message} />
                </Field>

                <Field>
                  <Label htmlFor="material-name" required>
                    Tên vật tư
                  </Label>
                  <Input
                    id="material-name"
                    placeholder="Tên đầy đủ của vật tư"
                    {...form.register("name")}
                  />
                  <ErrorText message={form.formState.errors.name?.message} />
                </Field>

                <Field>
                  <Label htmlFor="material-unit" required>
                    Đơn vị tính
                  </Label>
                  <Input
                    id="material-unit"
                    placeholder="Cái, Bộ, Mét, Kg..."
                    {...form.register("unit")}
                  />
                  <ErrorText message={form.formState.errors.unit?.message} />
                </Field>

                <Field>
                  <Label htmlFor="material-category">Nhóm vật tư</Label>
                  <MaterialCategorySelect
                    id="material-category"
                    value={form.watch("categoryId") ?? ""}
                    onChange={(val) => form.setValue("categoryId", val)}
                    placeholder="Chọn nhóm vật tư"
                  />
                  <ErrorText message={form.formState.errors.categoryId?.message} />
                </Field>

                <Field>
                  <Label htmlFor="material-salePrice">Giá bán mặc định</Label>
                  <Input
                    id="material-salePrice"
                    type="number"
                    min={0}
                    step="1"
                    {...form.register("salePrice")}
                  />
                  <ErrorText message={form.formState.errors.salePrice?.message} />
                </Field>

                <Field>
                  <Label htmlFor="material-costPrice">Giá nhập</Label>
                  <Input
                    id="material-costPrice"
                    type="number"
                    min={0}
                    step="1"
                    {...form.register("costPrice")}
                  />
                  <ErrorText message={form.formState.errors.costPrice?.message} />
                </Field>

                <Field>
                  <Label htmlFor="material-minStock">Tồn kho tối thiểu</Label>
                  <Input
                    id="material-minStock"
                    type="number"
                    min={0}
                    step="1"
                    placeholder="Tùy chọn"
                    {...form.register("minStock")}
                  />
                  <ErrorText message={form.formState.errors.minStock?.message} />
                </Field>

                <Field className="md:col-span-2">
                  <Label htmlFor="material-description">Mô tả</Label>
                  <Textarea
                    id="material-description"
                    placeholder="Thông số kỹ thuật, ứng dụng hoặc lưu ý khi sử dụng..."
                    rows={3}
                    {...form.register("description")}
                  />
                  <ErrorText message={form.formState.errors.description?.message} />
                </Field>

                <Field className="md:col-span-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="material-isActive"
                      checked={form.watch("isActive")}
                      onCheckedChange={(checked) =>
                        form.setValue("isActive", Boolean(checked))
                      }
                    />
                    <label
                      htmlFor="material-isActive"
                      className="cursor-pointer text-sm font-semibold text-text-primary"
                    >
                      Đang hoạt động
                    </label>
                  </div>
                </Field>
              </div>

              {apiError ? (
                <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">
                  {getApiErrorMessage(apiError, "Không thể lưu vật tư.")}
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <Link
                  href={
                    (mode === "edit" && materialId
                      ? `/materials/${materialId}`
                      : "/materials") as Route
                  }
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Hủy
                </Link>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending
                    ? "Đang lưu..."
                    : mode === "create"
                      ? "Thêm vật tư"
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
