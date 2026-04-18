"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCustomers } from "@/hooks/use-customers";
import {
  useCreateProject,
  useDeleteProject,
  useProject,
  useUpdateProject
} from "@/hooks/use-projects";
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS } from "@/lib/constants";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { CustomerListItem } from "@/lib/types";
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
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject(projectId ?? "");
  const deleteProjectMutation = useDeleteProject(projectId ?? "");

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: defaultProjectFormValues
  });

  useEffect(() => {
    if (mode === "create") {
      form.reset(defaultProjectFormValues);
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
        notes: projectQuery.data.notes ?? ""
      });
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
  const selectedCustomer = customerOptions.find((customer) => customer.id === watchedCustomerId) ?? null;

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
          if (mode === "create") {
            createProjectMutation.mutate(values, {
              onSuccess: (project) => {
                router.push(`/projects/${project.id}`);
              }
            });
            return;
          }

          updateProjectMutation.mutate(values, {
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
              <Label htmlFor="customerId">Khách hàng</Label>
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
