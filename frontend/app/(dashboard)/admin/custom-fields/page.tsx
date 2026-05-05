"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCustomField,
  useCustomFields,
  useDeleteCustomField,
  useUpdateCustomField
} from "@/hooks/use-custom-fields";
import { getApiErrorMessage } from "@/lib/api-client";
import { CustomFieldDefinition, CustomFieldResource, CustomFieldType } from "@/lib/types";
import { cn } from "@/lib/utils";

const RESOURCE_OPTIONS: Array<{ value: CustomFieldResource; label: string }> = [
  { value: "customer", label: "Khách hàng" },
  { value: "project", label: "Dự án" },
  { value: "contract", label: "Hợp đồng" }
];

const TYPE_OPTIONS: Array<{ value: CustomFieldType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "multiselect", label: "Multi select" },
  { value: "boolean", label: "Boolean" }
];

const customFieldFormSchema = z.object({
  resource: z.enum(["customer", "project", "contract"]),
  name: z
    .string()
    .trim()
    .min(1, "Key nội bộ là bắt buộc")
    .regex(/^[a-z0-9_]+$/, "Chỉ dùng chữ thường, số và dấu gạch dưới"),
  label: z.string().trim().min(1, "Nhãn hiển thị là bắt buộc"),
  type: z.enum(["text", "number", "date", "select", "multiselect", "boolean"]),
  optionsText: z.string().optional().default(""),
  required: z.boolean().default(false),
  order: z.coerce.number().int().min(0, "Thứ tự phải từ 0 trở lên")
});

type CustomFieldFormValues = z.infer<typeof customFieldFormSchema>;

function toFormValues(field?: CustomFieldDefinition): CustomFieldFormValues {
  return {
    resource: field?.resource ?? "customer",
    name: field?.name ?? "",
    label: field?.label ?? "",
    type: field?.type ?? "text",
    optionsText: field?.options?.join("\n") ?? "",
    required: field?.required ?? false,
    order: field?.order ?? 0
  };
}

export default function CustomFieldsPage() {
  const [resource, setResource] = useState<CustomFieldResource>("customer");
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const customFieldsQuery = useCustomFields(resource);
  const createMutation = useCreateCustomField();
  const updateMutation = useUpdateCustomField(editingField?.id ?? "");
  const deleteMutation = useDeleteCustomField();
  const form = useForm<CustomFieldFormValues>({
    resolver: zodResolver(customFieldFormSchema),
    defaultValues: toFormValues()
  });

  const fields = customFieldsQuery.data ?? [];
  const isSelectLike = form.watch("type") === "select" || form.watch("type") === "multiselect";
  const activeError = createMutation.error ?? updateMutation.error ?? deleteMutation.error;
  const optionsPreview = useMemo(
    () =>
      form
        .watch("optionsText")
        .split("\n")
        .map((option) => option.trim())
        .filter(Boolean),
    [form]
  );

  const handleEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    form.reset(toFormValues(field));
  };

  const handleReset = () => {
    setEditingField(null);
    form.reset(toFormValues({ resource } as CustomFieldDefinition));
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Custom Fields"
        description="Tạo schema động cho khách hàng, dự án và hợp đồng. Những field này sẽ xuất hiện ngay trên form create/edit và detail."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={resource}
              onChange={(event) => {
                const nextResource = event.target.value as CustomFieldResource;
                setResource(nextResource);
                setEditingField(null);
                form.reset(toFormValues({ resource: nextResource } as CustomFieldDefinition));
              }}
            >
              {RESOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }))}>
              Về quản trị
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="industrial-chip bg-primary/10 text-primary">
              {editingField ? "Edit Field" : "Create Field"}
            </p>
            <CardTitle>{editingField ? "Chỉnh sửa custom field" : "Tạo custom field mới"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => {
                const payload = {
                  resource: values.resource,
                  name: values.name,
                  label: values.label,
                  type: values.type,
                  options: isSelectLike ? optionsPreview : undefined,
                  required: values.required,
                  order: values.order
                };

                if (editingField) {
                  updateMutation.mutate(payload, {
                    onSuccess: () => {
                      handleReset();
                    }
                  });
                  return;
                }

                createMutation.mutate(payload, {
                  onSuccess: () => {
                    handleReset();
                  }
                });
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <Label htmlFor="resource">Resource</Label>
                  <Select id="resource" {...form.register("resource")}>
                    {RESOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <ErrorText message={form.formState.errors.resource?.message} />
                </Field>

                <Field>
                  <Label htmlFor="type">Type</Label>
                  <Select id="type" {...form.register("type")}>
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <ErrorText message={form.formState.errors.type?.message} />
                </Field>

                <Field>
                  <Label htmlFor="name">Key nội bộ</Label>
                  <Input id="name" placeholder="industry_segment" {...form.register("name")} />
                  <ErrorText message={form.formState.errors.name?.message} />
                </Field>

                <Field>
                  <Label htmlFor="label">Nhãn hiển thị</Label>
                  <Input id="label" placeholder="Phân khúc ngành" {...form.register("label")} />
                  <ErrorText message={form.formState.errors.label?.message} />
                </Field>

                <Field>
                  <Label htmlFor="order">Thứ tự</Label>
                  <Input id="order" type="number" min={0} {...form.register("order")} />
                  <ErrorText message={form.formState.errors.order?.message} />
                </Field>

                <Field>
                  <Label>Thiết lập</Label>
                  <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-white/80 px-4 py-3">
                    <Checkbox
                      checked={form.watch("required")}
                      onCheckedChange={(checked) => form.setValue("required", Boolean(checked))}
                    />
                    <span className="text-sm text-text-secondary">Trường bắt buộc</span>
                  </label>
                </Field>

                {isSelectLike ? (
                  <Field className="md:col-span-2">
                    <Label htmlFor="optionsText">Options</Label>
                    <Textarea
                      id="optionsText"
                      rows={6}
                      placeholder={"Mỗi dòng là một option\nVí dụ:\nThực phẩm\nDược phẩm\nCơ khí"}
                      {...form.register("optionsText")}
                    />
                    <ErrorText message={form.formState.errors.optionsText?.message} />
                    {optionsPreview.length > 0 ? (
                      <p className="text-xs text-text-secondary">Preview: {optionsPreview.join(" · ")}</p>
                    ) : null}
                  </Field>
                ) : null}
              </div>

              {activeError ? (
                <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">
                  {getApiErrorMessage(activeError, "Không thể lưu custom field.")}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingField ? "Lưu thay đổi" : "Tạo field"}
                </Button>
                <Button type="button" variant="outline" onClick={handleReset}>
                  Làm mới form
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="industrial-chip bg-accent/10 text-accent">Schema Preview</p>
            <CardTitle>Danh sách field theo resource</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customFieldsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <LoadingSkeleton key={index} className="h-24 w-full" />
                ))}
              </div>
            ) : fields.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-bg-hover/40 p-8 text-center">
                <p className="font-semibold text-text-primary">Chưa có custom field nào cho resource này.</p>
                <p className="mt-2 text-sm text-text-secondary">Tạo field đầu tiên ở form bên trái để module tương ứng hiển thị động.</p>
              </div>
            ) : (
              fields.map((field) => (
                <article key={field.id} className="rounded-2xl border border-border/60 bg-white/85 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-text-primary">{field.label}</p>
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                          {field.type}
                        </span>
                        {field.required ? (
                          <span className="rounded-full bg-danger-bg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-danger">
                            Bắt buộc
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-text-secondary">
                        Key: <span className="font-medium text-text-primary">{field.name}</span> · Thứ tự {field.order}
                      </p>
                      {field.options?.length ? (
                        <p className="text-sm text-text-secondary">Options: {field.options.join(", ")}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={() => handleEdit(field)}>
                        Sửa
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (!window.confirm(`Xóa custom field "${field.label}"?`)) {
                            return;
                          }

                          deleteMutation.mutate(field.id, {
                            onSuccess: () => {
                              if (editingField?.id === field.id) {
                                handleReset();
                              }
                            }
                          });
                        }}
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

function ErrorText({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-danger">{message}</p>;
}
