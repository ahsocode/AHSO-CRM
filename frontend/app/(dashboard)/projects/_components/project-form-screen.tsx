"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/layout/page-header";
import { CustomFieldRenderer } from "@/components/shared/custom-field-renderer";
import { CustomerQuickCreateDialog } from "@/components/shared/customer-quick-create-dialog";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCustomFields } from "@/hooks/use-custom-fields";
import { useCustomerContacts, useCustomers } from "@/hooks/use-customers";
import {
  useCreateProject,
  useDeleteProject,
  useProject,
  useUpdateProject
} from "@/hooks/use-projects";
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS } from "@/lib/constants";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { CustomerListItem, CustomFieldValues } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  defaultProjectFormValues,
  projectFormSchema,
  type ProjectFormValues
} from "./form-schemas";

function getCustomerOptions(
  customers: CustomerListItem[],
  fallbackCustomer?: {
    id: string;
    name: string;
  }
) {
  const options = [...customers];

  if (fallbackCustomer && !options.some((customer) => customer.id === fallbackCustomer.id)) {
    options.push({
      id: fallbackCustomer.id,
      name: fallbackCustomer.name,
      shortName: null,
      taxCode: null,
      industry: null,
      address: null,
      status: "ACTIVE",
      isVip: false,
      assignedTo: {
        id: "",
        name: "Không xác định",
        role: "STAFF"
      },
      primaryContact: null,
      projectCount: 0,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    });
  }

  return options;
}

export function ProjectFormScreen({
  mode,
  projectId
}: {
  mode: "create" | "edit";
  projectId?: string;
}) {
  const router = useRouter();
  const projectQuery = useProject(mode === "edit" ? projectId ?? "" : "");
  const customersQuery = useCustomers({
    page: 1,
    limit: 100
  });
  const customFieldsQuery = useCustomFields("project");
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject(projectId ?? "");
  const deleteProjectMutation = useDeleteProject(projectId ?? "");
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: defaultProjectFormValues
  });

  useEffect(() => {
    if (mode === "create") {
      form.reset(defaultProjectFormValues);
      setCustomFieldValues({});
    }
  }, [form, mode]);

  useEffect(() => {
    if (mode === "edit" && projectQuery.data) {
      form.reset({
        customerId: projectQuery.data.customer.id,
        name: projectQuery.data.name,
        description: projectQuery.data.description ?? "",
        status: projectQuery.data.status,
        priority: projectQuery.data.priority,
        estimatedValue: projectQuery.data.estimatedValue || undefined,
        startDate: projectQuery.data.startDate ? projectQuery.data.startDate.slice(0, 10) : "",
        expectedEndDate: projectQuery.data.expectedEndDate ? projectQuery.data.expectedEndDate.slice(0, 10) : "",
        completedAt: projectQuery.data.completedAt ? projectQuery.data.completedAt.slice(0, 10) : "",
        salesInvoiceDate: projectQuery.data.salesInvoiceDate ? projectQuery.data.salesInvoiceDate.slice(0, 10) : "",
        contactId: projectQuery.data.contactId ?? undefined,
        notes: projectQuery.data.notes ?? ""
      });
      setCustomFieldValues(projectQuery.data.customFieldValues ?? {});
    }
  }, [form, mode, projectQuery.data]);

  const activeMutation = mode === "create" ? createProjectMutation : updateProjectMutation;
  const activeErrorMessage = activeMutation.isError
    ? getApiErrorMessage(
        activeMutation.error,
        mode === "create" ? "Không thể tạo dự án." : "Không thể cập nhật dự án."
      )
    : null;
  const customerOptions = getCustomerOptions(customersQuery.data?.items ?? [], projectQuery.data?.customer);
  const isSubmitting = activeMutation.isPending || deleteProjectMutation.isPending;
  const watchedCustomerId = form.watch("customerId");
  const watchedStatus = form.watch("status");
  const selectedCustomer = customerOptions.find((customer) => customer.id === watchedCustomerId) ?? null;
  const contactsQuery = useCustomerContacts(watchedCustomerId ?? "");

  const prevCustomerIdRef = useRef(watchedCustomerId);
  useEffect(() => {
    if (prevCustomerIdRef.current !== watchedCustomerId) {
      form.setValue("contactId", undefined);
      prevCustomerIdRef.current = watchedCustomerId;
    }
  }, [form, watchedCustomerId]);

  useEffect(() => {
    if (watchedStatus !== "COMPLETED" && form.getValues("completedAt")) {
      form.setValue("completedAt", "");
    }
    if (watchedStatus !== "COMPLETED" && form.getValues("salesInvoiceDate")) {
      form.setValue("salesInvoiceDate", "");
    }
  }, [form, watchedStatus]);

  if (mode === "edit" && projectQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full" />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <LoadingSkeleton className="h-[760px] w-full" />
          <LoadingSkeleton className="h-[520px] w-full" />
        </div>
      </div>
    );
  }

  if (mode === "edit" && (projectQuery.isError || !projectQuery.data || !projectId)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cập nhật dự án"
          description="Không thể tải dữ liệu dự án để chỉnh sửa."
          action={
            <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          }
        />
        <Card className="border border-danger/20">
          <CardContent className="p-6">
            <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
              {getApiErrorMessage(projectQuery.error, "Không thể tải dữ liệu dự án.")}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={mode === "create" ? "Tạo dự án mới" : "Cập nhật dự án"}
        description={
          mode === "create"
            ? "Khởi tạo cơ hội mới và khóa customer/status/priority ngay từ đầu để pipeline sạch và dễ điều phối."
            : "Cập nhật dự án, điều chỉnh stage và đồng bộ lại customer context trước khi đi sâu sang quote hoặc contract."
        }
        action={
          <div className="flex flex-wrap items-center gap-3">
            {mode === "edit" && projectId ? (
              <Link href={`/projects/${projectId}`} className={cn(buttonVariants({ variant: "outline" }))}>
                Quay lại chi tiết
              </Link>
            ) : null}
            <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          </div>
        }
      />

      <form
        className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"
        onSubmit={form.handleSubmit((values) => {
          const payload = {
            ...values,
            customFieldValues
          };

          if (mode === "create") {
            createProjectMutation.mutate(payload, {
              onSuccess: (project) => {
                router.push(`/projects/${project.id}`);
              }
            });
            return;
          }

          updateProjectMutation.mutate(payload, {
            onSuccess: () => {
              router.push(`/projects/${projectId}`);
            }
          });
        })}
      >
        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="industrial-chip bg-primary/10 text-primary">Project Core</p>
            <CardTitle>Thông tin dự án</CardTitle>
            <p className="text-sm text-text-secondary">
              Nhóm trường để sales và delivery đọc cùng một cấu trúc pipeline, không tách riêng theo từng module.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field className="md:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="customerId">Khách hàng</Label>
                <button
                  type="button"
                  className="text-xs font-semibold text-primary-mid hover:text-primary"
                  onClick={() => setQuickCreateOpen(true)}
                >
                  + Tạo khách hàng mới
                </button>
              </div>
              <Select id="customerId" disabled={customersQuery.isLoading} {...form.register("customerId")}>
                <option value="">
                  {customersQuery.isLoading ? "Đang tải khách hàng..." : "Chọn khách hàng cho dự án"}
                </option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
              <ErrorText message={form.formState.errors.customerId?.message} />
              <CustomerQuickCreateDialog
                open={quickCreateOpen}
                onOpenChange={setQuickCreateOpen}
                onCreated={(customerId) => {
                  form.setValue("customerId", customerId, { shouldValidate: true, shouldDirty: true });
                }}
              />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="contactId">Người phụ trách phía khách hàng</Label>
              <Select
                id="contactId"
                disabled={!watchedCustomerId || contactsQuery.isLoading}
                {...form.register("contactId")}
              >
                <option value="">
                  {!watchedCustomerId
                    ? "Chọn khách hàng trước"
                    : contactsQuery.isLoading
                      ? "Đang tải danh sách liên hệ..."
                      : contactsQuery.data?.length === 0
                        ? "Khách hàng chưa có liên hệ nào"
                        : "Chọn người phụ trách dự án (tùy chọn)"}
                </option>
                {(contactsQuery.data ?? []).map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}{contact.title ? ` — ${contact.title}` : ""}{contact.phone ? ` (${contact.phone})` : ""}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-text-secondary">Người quản lý dự án phía khách hàng cho dự án này.</p>
              <ErrorText message={form.formState.errors.contactId?.message} />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="name">Tên dự án</Label>
              <Input id="name" placeholder="Ví dụ: Nâng cấp hệ thống PLC trạm bơm" {...form.register("name")} />
              <ErrorText message={form.formState.errors.name?.message} />
            </Field>

            <Field>
              <Label htmlFor="status">Trạng thái</Label>
              <Select id="status" {...form.register("status")}>
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <ErrorText message={form.formState.errors.status?.message} />
            </Field>

            <Field>
              <Label htmlFor="priority">Ưu tiên</Label>
              <Select id="priority" {...form.register("priority")}>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <ErrorText message={form.formState.errors.priority?.message} />
            </Field>

            <Field>
              <Label htmlFor="estimatedValue">Giá trị dự kiến</Label>
              <Input
                id="estimatedValue"
                min={0}
                step="1"
                type="number"
                {...form.register("estimatedValue", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value))
                })}
              />
              <ErrorText message={form.formState.errors.estimatedValue?.message} />
            </Field>

            <Field>
              <Label htmlFor="startDate">Ngày bắt đầu</Label>
              <Input id="startDate" type="date" {...form.register("startDate")} />
              <ErrorText message={form.formState.errors.startDate?.message} />
            </Field>

            <Field>
              <Label htmlFor="expectedEndDate">Ngày kết thúc dự kiến</Label>
              <Input id="expectedEndDate" type="date" {...form.register("expectedEndDate")} />
              <ErrorText message={form.formState.errors.expectedEndDate?.message} />
            </Field>

            {watchedStatus === "COMPLETED" ? (
              <>
                <Field>
                  <Label htmlFor="completedAt">Ngày hoàn thành</Label>
                  <Input id="completedAt" type="date" {...form.register("completedAt")} />
                  <p className="text-xs text-text-secondary">
                    Doanh thu dự án sẽ được ghi nhận theo ngày này, không theo ngày cập nhật hồ sơ.
                  </p>
                  <ErrorText message={form.formState.errors.completedAt?.message} />
                </Field>
                <Field>
                  <Label htmlFor="salesInvoiceDate">Ngày hóa đơn bán ra *</Label>
                  <Input id="salesInvoiceDate" type="date" {...form.register("salesInvoiceDate")} />
                  <p className="text-xs text-text-secondary">
                    Vật tư phân bổ chỉ được lấy từ lô nhập có ngày hóa đơn mua trước hoặc bằng ngày này.
                  </p>
                  <ErrorText message={form.formState.errors.salesInvoiceDate?.message} />
                </Field>
              </>
            ) : null}

            <Field className="md:col-span-2">
              <Label htmlFor="description">Mô tả kỹ thuật</Label>
              <Textarea
                id="description"
                placeholder="Mục tiêu, phạm vi, thiết bị chính hoặc pain point của khách hàng."
                {...form.register("description")}
              />
              <ErrorText message={form.formState.errors.description?.message} />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="notes">Ghi chú nội bộ</Label>
              <Textarea
                id="notes"
                placeholder="Lưu ý triển khai, rủi ro thương mại hoặc dependency với vendor khác."
                {...form.register("notes")}
              />
              <ErrorText message={form.formState.errors.notes?.message} />
            </Field>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-primary/10 text-primary">Dynamic Schema</p>
              <CardTitle>Custom fields</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomFieldRenderer
                editable
                fields={customFieldsQuery.data ?? []}
                values={customFieldValues}
                onChange={setCustomFieldValues}
                emptyTitle="Chưa có custom field cho dự án"
                emptyDescription="Admin có thể tạo thêm field động tại Quản trị > Custom Fields."
              />
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-accent/10 text-accent">Delivery Notes</p>
              <CardTitle>Tóm tắt thao tác</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <MiniInfo
                label="Mã dự án"
                value={mode === "edit" ? projectQuery.data?.code ?? "Chưa có" : "Được sinh tự động khi lưu"}
              />
              <MiniInfo
                label="Khách hàng đang chọn"
                value={selectedCustomer?.name ?? "Chưa chọn khách hàng"}
              />
              <MiniInfo
                label="Giá trị dự kiến"
                value={
                  form.watch("estimatedValue")
                    ? new Intl.NumberFormat("vi-VN").format(form.watch("estimatedValue") ?? 0)
                    : "Chưa nhập"
                }
              />
              {mode === "edit" && projectQuery.data ? (
                <>
                  <MiniInfo label="Tạo lúc" value={formatDateTime(projectQuery.data.createdAt)} />
                  <MiniInfo
                    label="Hoàn thành"
                    value={projectQuery.data.completedAt ? formatDateTime(projectQuery.data.completedAt) : "Chưa ghi nhận"}
                  />
                  <MiniInfo
                    label="Hóa đơn bán ra"
                    value={projectQuery.data.salesInvoiceDate ? formatDateTime(projectQuery.data.salesInvoiceDate) : "Chưa ghi nhận"}
                  />
                  <MiniInfo label="Cập nhật cuối" value={formatDateTime(projectQuery.data.updatedAt)} />
                </>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-bg-hover/50 p-4 text-text-secondary">
                  Sau khi tạo xong, dự án sẽ xuất hiện ngay ở kanban để chuyển stage và nối tiếp sang quote/contract.
                </div>
              )}
            </CardContent>
          </Card>

          {(activeErrorMessage || deleteProjectMutation.isError) ? (
            <Card className="border border-danger/20">
              <CardContent className="space-y-3 p-5">
                {activeErrorMessage ? (
                  <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">{activeErrorMessage}</div>
                ) : null}
                {deleteProjectMutation.isError ? (
                  <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
                    {getApiErrorMessage(deleteProjectMutation.error, "Không thể xóa dự án.")}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border border-white/70">
            <CardContent className="flex flex-col gap-3 p-5">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting
                  ? "Đang lưu..."
                  : mode === "create"
                    ? "Tạo dự án"
                    : "Lưu thay đổi"}
              </Button>
              {mode === "edit" && projectId ? (
                <Button
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={() => {
                    if (!window.confirm("Xóa mềm dự án này khỏi pipeline? Dự án đã có hợp đồng sẽ không thể xóa.")) {
                      return;
                    }

                    deleteProjectMutation.mutate(undefined, {
                      onSuccess: () => {
                        router.push("/projects");
                      }
                    });
                  }}
                  type="button"
                  variant="destructive"
                >
                  Xóa dự án
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </form>
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
  return <div className={className ? `space-y-2 ${className}` : "space-y-2"}>{children}</div>;
}

function Label({
  htmlFor,
  children
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-text-primary">
      {children}
    </label>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-danger">{message}</p>;
}

function MiniInfo({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <div className="mt-2 font-semibold text-text-primary">{value}</div>
    </div>
  );
}
