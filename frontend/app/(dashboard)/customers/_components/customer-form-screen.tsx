"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { AppIcon } from "@/components/shared/app-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/hooks/use-auth";
import { useCreateCustomer, useCustomer, useDeleteCustomer, useUpdateCustomer } from "@/hooks/use-customers";
import { useUsers } from "@/hooks/use-users";
import { getApiErrorMessage } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { CustomerStatus, Role, UserListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  customerFormSchema,
  defaultCustomerFormValues,
  type CustomerFormValues
} from "./form-schemas";

const STATUS_OPTIONS: Array<{ label: string; value: CustomerStatus }> = [
  { label: "Tiềm năng", value: "LEAD" },
  { label: "Đang quan tâm", value: "PROSPECT" },
  { label: "Hoạt động", value: "ACTIVE" },
  { label: "Không hoạt động", value: "INACTIVE" }
];

function getUserOptions(users: UserListItem[], fallbackUser?: { id: string; name: string; role: Role }) {
  const options = [...users];

  if (fallbackUser && !options.some((user) => user.id === fallbackUser.id)) {
    options.push({
      id: fallbackUser.id,
      email: "",
      name: fallbackUser.name,
      role: fallbackUser.role as UserListItem["role"],
      isActive: true,
      createdAt: new Date(0).toISOString()
    });
  }

  return options;
}

export function CustomerFormScreen({
  mode,
  customerId
}: {
  mode: "create" | "edit";
  customerId?: string;
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const canManageUsers = user?.role === "ADMIN" || user?.role === "MANAGER";
  const usersQuery = useUsers(canManageUsers);
  const customerQuery = useCustomer(mode === "edit" ? customerId ?? "" : "");
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer(customerId ?? "");
  const deleteCustomerMutation = useDeleteCustomer(customerId ?? "");

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      ...defaultCustomerFormValues,
      assignedToId: user?.id ?? ""
    }
  });

  useEffect(() => {
    if (mode === "create") {
      form.reset({
        ...defaultCustomerFormValues,
        assignedToId: user?.id ?? ""
      });
    }
  }, [form, mode, user?.id]);

  useEffect(() => {
    if (mode === "edit" && customerQuery.data) {
      form.reset({
        name: customerQuery.data.name,
        shortName: customerQuery.data.shortName ?? "",
        taxCode: customerQuery.data.taxCode ?? "",
        industry: customerQuery.data.industry ?? "",
        address: customerQuery.data.address ?? "",
        website: customerQuery.data.website ?? "",
        phone: customerQuery.data.phone ?? "",
        email: customerQuery.data.email ?? "",
        source: customerQuery.data.source ?? "",
        notes: customerQuery.data.notes ?? "",
        status: customerQuery.data.status,
        isVip: customerQuery.data.isVip,
        assignedToId: customerQuery.data.assignedTo.id
      });
    }
  }, [customerQuery.data, form, mode]);

  const activeMutation = mode === "create" ? createCustomerMutation : updateCustomerMutation;
  const activeErrorMessage = activeMutation.isError
    ? getApiErrorMessage(
        activeMutation.error,
        mode === "create" ? "Không thể tạo khách hàng." : "Không thể cập nhật khách hàng."
      )
    : null;
  const userOptions = getUserOptions(usersQuery.data ?? [], customerQuery.data?.assignedTo);
  const isSubmitting = activeMutation.isPending || deleteCustomerMutation.isPending;

  if (mode === "edit" && customerQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full" />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <LoadingSkeleton className="h-[720px] w-full" />
          <LoadingSkeleton className="h-[520px] w-full" />
        </div>
      </div>
    );
  }

  if (mode === "edit" && (customerQuery.isError || !customerQuery.data || !customerId)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cập nhật khách hàng"
          description="Không thể tải dữ liệu khách hàng để chỉnh sửa."
          action={
            <Link href="/customers" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          }
        />
        <Card className="border border-danger/20">
          <CardContent className="p-6">
            <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
              {getApiErrorMessage(customerQuery.error, "Không thể tải dữ liệu khách hàng.")}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-3">
      {mode === "edit" && customerId ? (
        <Link href={`/customers/${customerId}`} className={cn(buttonVariants({ variant: "outline" }))}>
          Quay lại chi tiết
        </Link>
      ) : null}
      <Link href="/customers" className={cn(buttonVariants({ variant: "outline" }))}>
        Về danh sách
      </Link>
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={mode === "create" ? "Tạo khách hàng mới" : "Cập nhật khách hàng"}
        description={
          mode === "create"
            ? "Khởi tạo hồ sơ doanh nghiệp, gắn người phụ trách và chuẩn hóa dữ liệu ngay từ đầu để không phải vá về sau."
            : "Chỉnh sửa hồ sơ doanh nghiệp, bàn giao phụ trách và giữ dữ liệu sales/delivery luôn đồng bộ."
        }
        action={actionButtons}
      />

      <form
        className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"
        onSubmit={form.handleSubmit((values) => {
          if (mode === "create") {
            createCustomerMutation.mutate(values, {
              onSuccess: (createdCustomer) => {
                router.push(`/customers/${createdCustomer.id}`);
              }
            });
            return;
          }

          updateCustomerMutation.mutate(values, {
            onSuccess: () => {
              router.push(`/customers/${customerId}`);
            }
          });
        })}
      >
        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="industrial-chip bg-primary/10 text-primary">Customer Core</p>
            <CardTitle>Thông tin doanh nghiệp</CardTitle>
            <p className="text-sm text-text-secondary">
              Nhóm trường cốt lõi để sales, delivery và báo giá dùng chung một hồ sơ chuẩn.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field>
              <Label htmlFor="name">Tên khách hàng</Label>
              <Input id="name" placeholder="Ví dụ: Vinamilk Corporation" {...form.register("name")} />
              <ErrorText message={form.formState.errors.name?.message} />
            </Field>

            <Field>
              <Label htmlFor="shortName">Tên viết tắt</Label>
              <Input id="shortName" placeholder="Ví dụ: VNM" {...form.register("shortName")} />
              <ErrorText message={form.formState.errors.shortName?.message} />
            </Field>

            <Field>
              <Label htmlFor="taxCode">Mã số thuế</Label>
              <Input id="taxCode" placeholder="0300588569" {...form.register("taxCode")} />
              <ErrorText message={form.formState.errors.taxCode?.message} />
            </Field>

            <Field>
              <Label htmlFor="status">Trạng thái</Label>
              <Select id="status" {...form.register("status")}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <ErrorText message={form.formState.errors.status?.message} />
            </Field>

            <Field>
              <Label htmlFor="industry">Ngành hàng</Label>
              <Input id="industry" placeholder="Ví dụ: Y tế, Cơ khí, FMCG..." {...form.register("industry")} />
              <ErrorText message={form.formState.errors.industry?.message} />
            </Field>

            <Field>
              <Label htmlFor="source">Nguồn khách</Label>
              <Input id="source" placeholder="Ví dụ: triển lãm, referral, website..." {...form.register("source")} />
              <ErrorText message={form.formState.errors.source?.message} />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="address">Địa chỉ</Label>
              <Textarea id="address" placeholder="Địa chỉ giao dịch hoặc nhà máy chính" {...form.register("address")} />
              <ErrorText message={form.formState.errors.address?.message} />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="notes">Ghi chú nội bộ</Label>
              <Textarea
                id="notes"
                placeholder="Nêu bối cảnh thương mại, rủi ro, nhịp phản hồi hoặc lưu ý triển khai."
                {...form.register("notes")}
              />
              <ErrorText message={form.formState.errors.notes?.message} />
            </Field>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-accent/10 text-accent">Commercial Layer</p>
              <CardTitle>Liên hệ thương mại</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field>
                <Label htmlFor="email">Email công ty</Label>
                <Input id="email" type="email" placeholder="purchasing@company.vn" {...form.register("email")} />
                <ErrorText message={form.formState.errors.email?.message} />
              </Field>

              <Field>
                <Label htmlFor="phone">Điện thoại</Label>
                <Input id="phone" placeholder="028..." {...form.register("phone")} />
                <ErrorText message={form.formState.errors.phone?.message} />
              </Field>

              <Field>
                <Label htmlFor="website">Website</Label>
                <Input id="website" placeholder="https://company.vn" {...form.register("website")} />
                <ErrorText message={form.formState.errors.website?.message} />
              </Field>

              <Field>
                <Label htmlFor="assignedToId">Người phụ trách</Label>
                {canManageUsers ? (
                  <Select id="assignedToId" {...form.register("assignedToId")} disabled={usersQuery.isLoading}>
                    <option value="">Chọn người phụ trách</option>
                    {userOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div className="rounded-xl border border-border/60 bg-white/80 px-4 py-3 text-sm text-text-secondary">
                    <p className="font-semibold text-text-primary">{user?.name ?? "Tài khoản hiện tại"}</p>
                    <p>{user ? ROLE_LABELS[user.role] : "Nhân sự đang thao tác"}</p>
                  </div>
                )}
                <ErrorText message={form.formState.errors.assignedToId?.message} />
              </Field>

              <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-white/80 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-info/20"
                  {...form.register("isVip")}
                />
                <div>
                  <p className="font-semibold text-text-primary">Khách hàng VIP</p>
                  <p className="text-sm text-text-secondary">Ưu tiên nổi bật trong danh sách và dashboard.</p>
                </div>
              </label>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-primary/10 text-primary">Action Desk</p>
              <CardTitle>Kiểm tra trước khi lưu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {usersQuery.isError && canManageUsers ? (
                <div className="rounded-xl bg-warning-bg/80 px-4 py-3 text-sm text-warning">
                  Không tải được danh sách người dùng. Bạn vẫn có thể tiếp tục nếu trường phụ trách đã có giá trị hợp lệ.
                </div>
              ) : null}

              {activeErrorMessage ? (
                <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{activeErrorMessage}</div>
              ) : null}

              {mode === "edit" && customerQuery.data ? (
                <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">{customerQuery.data.name}</p>
                  <p className="mt-2">Tạo hồ sơ: {formatDateTime(customerQuery.data.createdAt)}</p>
                  <p>Cập nhật cuối: {formatDateTime(customerQuery.data.updatedAt)}</p>
                </div>
              ) : null}

              <div className="flex flex-col gap-3">
                <Button className="h-11 rounded-xl" disabled={isSubmitting} type="submit">
                  <AppIcon name="arrow-right" className="h-4 w-4" />
                  {mode === "create"
                    ? createCustomerMutation.isPending
                      ? "Đang tạo khách hàng..."
                      : "Tạo khách hàng"
                    : updateCustomerMutation.isPending
                      ? "Đang cập nhật..."
                      : "Lưu thay đổi"}
                </Button>

                {mode === "edit" && customerId ? (
                  <Button
                    className="h-11 rounded-xl"
                    disabled={isSubmitting}
                    onClick={() => {
                      if (!window.confirm("Xóa mềm khách hàng này khỏi danh sách đang hoạt động?")) {
                        return;
                      }

                      deleteCustomerMutation.mutate(undefined, {
                        onSuccess: () => {
                          router.push("/customers");
                        }
                      });
                    }}
                    type="button"
                    variant="destructive"
                  >
                    {deleteCustomerMutation.isPending ? "Đang xóa..." : "Xóa khách hàng"}
                  </Button>
                ) : null}
              </div>
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
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

function Label({
  children,
  htmlFor
}: {
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <label className="text-sm font-semibold text-text-primary" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function ErrorText({ message }: { message?: string }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null;
}
