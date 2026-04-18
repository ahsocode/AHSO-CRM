"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { PageHeader } from "@/components/layout/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { AppIcon } from "@/components/shared/app-icon";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateQuote } from "@/hooks/use-quotes";
import { useProject, useProjects } from "@/hooks/use-projects";
import { getApiErrorMessage } from "@/lib/api-client";
import { QUOTE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  createEmptyQuoteItem,
  defaultQuoteFormValues,
  quoteFormSchema,
  type QuoteFormValues
} from "./form-schemas";

export function QuoteFormScreen({ initialProjectId = "" }: { initialProjectId?: string }) {
  const router = useRouter();
  const createQuoteMutation = useCreateQuote();
  const projectsQuery = useProjects({
    page: 1,
    limit: 100
  });

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      ...defaultQuoteFormValues,
      projectId: initialProjectId
    }
  });

  const itemsFieldArray = useFieldArray({
    control: form.control,
    name: "items"
  });

  const selectedProjectId = form.watch("projectId");
  const watchedItems = form.watch("items") ?? [];
  const watchedTaxRate = form.watch("taxRate") ?? 0;
  const selectedProjectQuery = useProject(selectedProjectId || "");
  const selectedProject = selectedProjectQuery.data;
  const subtotal = watchedItems.reduce(
    (sum, item) => sum + Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
    0
  );
  const taxAmount = Math.round((subtotal * (Number(watchedTaxRate) || 0)) / 100);
  const grandTotal = subtotal + taxAmount;
  const activeErrorMessage = createQuoteMutation.isError
    ? getApiErrorMessage(createQuoteMutation.error, "Không thể tạo báo giá.")
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tạo báo giá"
        description="Tạo quote trực tiếp từ dự án thật, tính toán line item và khóa luôn payload để sang được màn hình preview/in."
        action={
          <div className="flex flex-wrap items-center gap-3">
            {selectedProjectId ? (
              <Link href={`/projects/${selectedProjectId}`} className={cn(buttonVariants({ variant: "outline" }))}>
                Về dự án
              </Link>
            ) : null}
            <Link href="/quotes" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          </div>
        }
      />

      <form
        className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"
        onSubmit={form.handleSubmit((values) => {
          createQuoteMutation.mutate(values, {
            onSuccess: (quote) => {
              router.push(`/quotes/${quote.id}`);
            }
          });
        })}
      >
        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-primary/10 text-primary">Quote Identity</p>
              <CardTitle>Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field className="md:col-span-2">
                <Label htmlFor="projectId">Dự án</Label>
                <Select id="projectId" disabled={projectsQuery.isLoading} {...form.register("projectId")}>
                  <option value="">
                    {projectsQuery.isLoading ? "Đang tải danh sách dự án..." : "Chọn dự án để báo giá"}
                  </option>
                  {(projectsQuery.data?.items ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} · {project.name}
                    </option>
                  ))}
                </Select>
                <ErrorText message={form.formState.errors.projectId?.message} />
              </Field>

              <Field>
                <Label htmlFor="status">Trạng thái khởi tạo</Label>
                <Select id="status" {...form.register("status")}>
                  {Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <ErrorText message={form.formState.errors.status?.message} />
              </Field>

              <Field>
                <Label htmlFor="validUntil">Hiệu lực đến</Label>
                <Input id="validUntil" type="date" {...form.register("validUntil")} />
                <ErrorText message={form.formState.errors.validUntil?.message} />
              </Field>

              <Field>
                <Label htmlFor="taxRate">Thuế suất (%)</Label>
                <Input
                  id="taxRate"
                  min={0}
                  step="0.01"
                  type="number"
                  {...form.register("taxRate", {
                    setValueAs: (value) => (value === "" ? 0 : Number(value))
                  })}
                />
                <ErrorText message={form.formState.errors.taxRate?.message} />
              </Field>

              <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm text-text-secondary">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Số báo giá</p>
                <p className="mt-2 font-semibold text-text-primary">Được sinh tự động khi lưu</p>
                <p className="mt-1">Phiên bản sẽ tự tăng theo số quote đã có trên cùng dự án.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-accent/10 text-accent">Line Items</p>
              <CardTitle>Danh mục chào giá</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {itemsFieldArray.fields.map((field, index) => (
                <article key={field.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">#{String(index + 1).padStart(2, "0")}</Badge>
                      <p className="text-sm font-semibold text-text-primary">Hạng mục báo giá</p>
                    </div>
                    <Button
                      disabled={itemsFieldArray.fields.length === 1}
                      onClick={() => itemsFieldArray.remove(index)}
                      type="button"
                      variant="outline"
                    >
                      Xóa dòng
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_120px_140px]">
                    <Field className="md:col-span-2 xl:col-span-1">
                      <Label htmlFor={`items.${index}.name`}>Tên hạng mục</Label>
                      <Input id={`items.${index}.name`} {...form.register(`items.${index}.name`)} />
                      <ErrorText message={form.formState.errors.items?.[index]?.name?.message} />
                    </Field>

                    <Field>
                      <Label htmlFor={`items.${index}.description`}>Mô tả</Label>
                      <Input
                        id={`items.${index}.description`}
                        placeholder="Quy cách / phạm vi / model"
                        {...form.register(`items.${index}.description`)}
                      />
                      <ErrorText message={form.formState.errors.items?.[index]?.description?.message} />
                    </Field>

                    <Field>
                      <Label htmlFor={`items.${index}.unit`}>ĐVT</Label>
                      <Input id={`items.${index}.unit`} placeholder="Bộ / Gói / Cái" {...form.register(`items.${index}.unit`)} />
                      <ErrorText message={form.formState.errors.items?.[index]?.unit?.message} />
                    </Field>

                    <Field>
                      <Label htmlFor={`items.${index}.quantity`}>Số lượng</Label>
                      <Input
                        id={`items.${index}.quantity`}
                        min={0}
                        step="0.01"
                        type="number"
                        {...form.register(`items.${index}.quantity`, {
                          setValueAs: (value) => (value === "" ? 0 : Number(value))
                        })}
                      />
                      <ErrorText message={form.formState.errors.items?.[index]?.quantity?.message} />
                    </Field>

                    <Field>
                      <Label htmlFor={`items.${index}.unitPrice`}>Đơn giá</Label>
                      <Input
                        id={`items.${index}.unitPrice`}
                        min={0}
                        step="1"
                        type="number"
                        {...form.register(`items.${index}.unitPrice`, {
                          setValueAs: (value) => (value === "" ? 0 : Number(value))
                        })}
                      />
                      <ErrorText message={form.formState.errors.items?.[index]?.unitPrice?.message} />
                    </Field>
                  </div>

                  <div className="mt-4 rounded-xl bg-primary/5 px-4 py-3 text-sm text-text-secondary">
                    Thành tiền:{" "}
                    <span className="font-semibold text-text-primary">
                      <CurrencyDisplay
                        amount={Math.round(
                          (Number(watchedItems[index]?.quantity) || 0) * (Number(watchedItems[index]?.unitPrice) || 0)
                        )}
                      />
                    </span>
                  </div>
                </article>
              ))}

              <Button onClick={() => itemsFieldArray.append(createEmptyQuoteItem())} type="button" variant="outline">
                <AppIcon name="plus" className="h-4 w-4" />
                Thêm hạng mục
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-primary/10 text-primary">Terms</p>
              <CardTitle>Điều khoản & ghi chú</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <Label htmlFor="terms">Điều khoản thanh toán</Label>
                <Textarea
                  id="terms"
                  placeholder="Ví dụ: 50% khi xác nhận PO, 50% khi nghiệm thu."
                  {...form.register("terms")}
                />
                <ErrorText message={form.formState.errors.terms?.message} />
              </Field>

              <Field>
                <Label htmlFor="deliveryTerms">Điều khoản giao hàng / triển khai</Label>
                <Textarea
                  id="deliveryTerms"
                  placeholder="Ví dụ: triển khai trong 21 ngày kể từ PO."
                  {...form.register("deliveryTerms")}
                />
                <ErrorText message={form.formState.errors.deliveryTerms?.message} />
              </Field>

              <Field>
                <Label htmlFor="internalNote">Ghi chú nội bộ</Label>
                <Textarea
                  id="internalNote"
                  placeholder="Nêu lưu ý thương mại, phạm vi chào giá, điểm cần follow-up."
                  {...form.register("internalNote")}
                />
                <ErrorText message={form.formState.errors.internalNote?.message} />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-primary/10 text-primary">Project Snapshot</p>
              <CardTitle>Dự án và khách hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedProjectId ? (
                <EmptyState
                  title="Chưa chọn dự án"
                  description="Chọn một dự án để tự kéo theo khách hàng, owner và context thương mại."
                />
              ) : selectedProjectQuery.isLoading ? (
                <LoadingSkeleton className="h-56 w-full" />
              ) : selectedProject ? (
                <>
                  <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
                    <p className="font-semibold text-text-primary">{selectedProject.name}</p>
                    <p className="mt-1 text-sm text-text-secondary">{selectedProject.code}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="info">{selectedProject.customer.name}</Badge>
                      <Badge variant="neutral">{selectedProject.customer.assignedTo.name}</Badge>
                    </div>
                  </div>

                  <InfoRow label="Khách hàng" value={selectedProject.customer.name} />
                  <InfoRow label="Liên hệ chính" value={selectedProject.customer.primaryContact?.name ?? "Chưa thiết lập"} />
                  <InfoRow label="Giá trị dự án" value={<CurrencyDisplay amount={selectedProject.estimatedValue} short />} />
                  <InfoRow label="Số báo giá hiện có" value={`${selectedProject.stats.quoteCount}`} />
                  <InfoRow
                    label="Mốc dự kiến"
                    value={
                      selectedProject.expectedEndDate
                        ? formatDate(selectedProject.expectedEndDate)
                        : "Chưa xác định"
                    }
                  />
                </>
              ) : (
                <div className="rounded-xl bg-warning-bg/80 px-4 py-3 text-sm text-warning">
                  Không tải được thông tin dự án đã chọn.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-accent/10 text-accent">Quote Summary</p>
              <CardTitle>Tổng hợp giá trị</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow label="Tạm tính" value={<CurrencyDisplay amount={subtotal} short />} />
              <InfoRow label={`VAT ${watchedTaxRate}%`} value={<CurrencyDisplay amount={taxAmount} short />} />
              <InfoRow label="Tổng cộng" value={<CurrencyDisplay amount={grandTotal} short />} emphasized />
              <InfoRow label="Số dòng" value={`${watchedItems.length}`} />
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-primary/10 text-primary">Action Desk</p>
              <CardTitle>Kiểm tra trước khi lưu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {projectsQuery.isError ? (
                <div className="rounded-xl bg-warning-bg/80 px-4 py-3 text-sm text-warning">
                  Không tải được danh sách dự án. Bạn vẫn có thể tiếp tục nếu dự án đã được chọn hợp lệ.
                </div>
              ) : null}

              {selectedProject ? (
                <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">{selectedProject.customer.name}</p>
                  <p className="mt-2">Dự án tạo lúc: {formatDateTime(selectedProject.createdAt)}</p>
                  <p>Cập nhật cuối: {formatDateTime(selectedProject.updatedAt)}</p>
                </div>
              ) : null}

              {activeErrorMessage ? (
                <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{activeErrorMessage}</div>
              ) : null}

              <Button className="h-11 rounded-xl" disabled={createQuoteMutation.isPending} type="submit">
                <AppIcon name="arrow-right" className="h-4 w-4" />
                {createQuoteMutation.isPending ? "Đang tạo báo giá..." : "Tạo báo giá"}
              </Button>
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

function InfoRow({
  label,
  value,
  emphasized = false
}: {
  label: string;
  value: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <div className={cn("mt-2 font-semibold text-text-primary", emphasized ? "font-heading text-2xl" : "")}>
        {value}
      </div>
    </div>
  );
}
