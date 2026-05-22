"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import {
  useCreateQuote,
  useQuote,
  useUpdateQuote
} from "@/hooks/use-quotes";
import { useProject, useProjects } from "@/hooks/use-projects";
import { useMaterialsSelect } from "@/hooks/use-materials";
import { getApiErrorMessage } from "@/lib/api-client";
import { QUOTE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { QuoteStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  createEmptyQuoteItem,
  defaultQuoteTableColumnWidths,
  defaultQuoteFormValues,
  quoteFormSchema,
  type QuoteFormValues
} from "./form-schemas";

const EDITABLE_QUOTE_STATUSES: QuoteStatus[] = ["DRAFT", "REJECTED"];
const QUOTE_TABLE_WIDTH_FIELDS = [
  { key: "index", label: "STT", min: 3, max: 25 },
  { key: "name", label: "Hạng mục", min: 10, max: 75 },
  { key: "description", label: "Mô tả", min: 10, max: 75 },
  { key: "quantity", label: "SL", min: 3, max: 25 },
  { key: "unitPrice", label: "Đơn giá", min: 6, max: 40 },
  { key: "total", label: "Thành tiền", min: 6, max: 40 }
] as const;

export function QuoteFormScreen({
  mode = "create",
  initialProjectId = "",
  quoteId
}: {
  mode?: "create" | "edit";
  initialProjectId?: string;
  quoteId?: string;
}) {
  const router = useRouter();
  const createQuoteMutation = useCreateQuote();
  const updateQuoteMutation = useUpdateQuote(quoteId ?? "");
  const quoteQuery = useQuote(mode === "edit" ? quoteId ?? "" : "");
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

  useEffect(() => {
    if (mode === "create") {
      form.reset({
        ...defaultQuoteFormValues,
        projectId: initialProjectId
      });
    }
  }, [form, initialProjectId, mode]);

  useEffect(() => {
    if (mode === "edit" && quoteQuery.data) {
      form.reset({
        projectId: quoteQuery.data.project.id,
        validUntil: quoteQuery.data.validUntil ? quoteQuery.data.validUntil.slice(0, 10) : "",
        taxRate: quoteQuery.data.taxRate,
        tableColumnWidths: quoteQuery.data.tableColumnWidths ?? defaultQuoteTableColumnWidths,
        terms: quoteQuery.data.terms ?? "",
        deliveryTerms: quoteQuery.data.deliveryTerms ?? "",
        internalNote: quoteQuery.data.internalNote ?? "",
        status: quoteQuery.data.status,
        items: quoteQuery.data.items.map((item) => ({
          name: item.name,
          description: item.description ?? "",
          unit: item.unit ?? "",
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      });
    }
  }, [form, mode, quoteQuery.data]);

  const selectedProjectId = form.watch("projectId");
  const watchedItems = form.watch("items") ?? [];
  const watchedTaxRate = form.watch("taxRate") ?? 0;
  const watchedTableColumnWidths = form.watch("tableColumnWidths") ?? defaultQuoteTableColumnWidths;
  const selectedProjectQuery = useProject(selectedProjectId || "");
  const selectedProject = selectedProjectQuery.data;
  const subtotal = watchedItems.reduce(
    (sum, item) => sum + Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
    0
  );
  const taxAmount = Math.round((subtotal * (Number(watchedTaxRate) || 0)) / 100);
  const grandTotal = subtotal + taxAmount;
  const activeMutation = mode === "create" ? createQuoteMutation : updateQuoteMutation;
  const activeErrorMessage = activeMutation.isError
    ? getApiErrorMessage(
        activeMutation.error,
        mode === "create" ? "Không thể tạo báo giá." : "Không thể cập nhật báo giá."
      )
    : null;
  const activeQuote = quoteQuery.data;
  const isEditableQuote =
    mode === "create" ||
    (activeQuote ? EDITABLE_QUOTE_STATUSES.includes(activeQuote.status) : false);

  if (mode === "edit" && quoteQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full" />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <LoadingSkeleton className="h-[980px] w-full" />
          <LoadingSkeleton className="h-[720px] w-full" />
        </div>
      </div>
    );
  }

  if (mode === "edit" && (quoteQuery.isError || !activeQuote || !quoteId)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cập nhật báo giá"
          description="Không thể tải dữ liệu báo giá để chỉnh sửa."
          action={
            <Link href="/quotes" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          }
        />
        <Card className="border border-danger/20">
          <CardContent className="p-6">
            <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
              {getApiErrorMessage(quoteQuery.error, "Không thể tải dữ liệu báo giá.")}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Quotation Desk"
        title={mode === "create" ? "Tạo báo giá mới" : "Cập nhật báo giá"}
        description={
          mode === "create"
            ? "Tạo quote trực tiếp từ dự án thật, tính toán line item và khóa luôn payload để sang được màn hình preview/in."
            : "Chỉnh sửa nội dung thương mại của version hiện tại trước khi gửi khách hoặc tạo version kế tiếp."
        }
        action={
          <div className="flex flex-wrap items-center gap-3">
            {mode === "edit" && quoteId ? (
              <Link href={`/quotes/${quoteId}`} className={cn(buttonVariants({ variant: "outline" }))}>
                Về chi tiết quote
              </Link>
            ) : selectedProjectId ? (
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
        className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]"
        onSubmit={form.handleSubmit((values) => {
          if (mode === "edit" && quoteId) {
            updateQuoteMutation.mutate(values, {
              onSuccess: (quote) => {
                router.push(`/quotes/${quote.id}`);
              }
            });
            return;
          }

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
              <p className="v2-label text-primary">
                {mode === "create" ? "Quote Identity" : "Quote Revision"}
              </p>
              <CardTitle>Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field className="md:col-span-2">
                <Label htmlFor="projectId">Dự án</Label>
                <Select
                  id="projectId"
                  disabled={projectsQuery.isLoading || mode === "edit"}
                  {...form.register("projectId")}
                >
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
                {mode === "edit" ? (
                  <p className="text-sm text-text-secondary">
                    Version hiện tại được khóa với dự án gốc. Nếu cần báo giá cho dự án khác, hãy tạo quote mới.
                  </p>
                ) : null}
              </Field>

              <Field>
                <Label htmlFor="status">Trạng thái</Label>
                <Select id="status" disabled={!isEditableQuote} {...form.register("status")}>
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
                <Input id="validUntil" type="date" disabled={!isEditableQuote} {...form.register("validUntil")} />
                <ErrorText message={form.formState.errors.validUntil?.message} />
              </Field>

              <Field>
                <Label htmlFor="taxRate">Thuế suất (%)</Label>
                <Input
                  id="taxRate"
                  min={0}
                  step="0.01"
                  type="number"
                  disabled={!isEditableQuote}
                  {...form.register("taxRate", {
                    setValueAs: (value) => (value === "" ? 0 : Number(value))
                  })}
                />
                <ErrorText message={form.formState.errors.taxRate?.message} />
              </Field>

              <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm text-text-secondary">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Số báo giá</p>
                <p className="mt-2 font-semibold text-text-primary">
                  {mode === "edit" && activeQuote ? `${activeQuote.quoteNo} · v${activeQuote.version}` : "Được sinh tự động khi lưu"}
                </p>
                <p className="mt-1">
                  {mode === "edit"
                    ? "Version mới nên được tạo bằng thao tác duplicate trên màn chi tiết."
                    : "Phiên bản sẽ tự tăng theo số quote đã có trên cùng dự án."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="v2-label text-accent">Line Items</p>
              <CardTitle>Danh mục chào giá</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {itemsFieldArray.fields.map((field, index) => (
                <article key={field.id} className="rounded-xl border border-border-light bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">#{String(index + 1).padStart(2, "0")}</Badge>
                      <p className="text-sm font-semibold text-text-primary">Hạng mục báo giá</p>
                    </div>
                    <Button
                      disabled={itemsFieldArray.fields.length === 1 || !isEditableQuote}
                      onClick={() => itemsFieldArray.remove(index)}
                      type="button"
                      variant="outline"
                    >
                      Xóa dòng
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field className="md:col-span-2">
                      <Label htmlFor={`items.${index}.name`}>Tên hạng mục</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`items.${index}.name`}
                          disabled={!isEditableQuote}
                          className="flex-1"
                          {...form.register(`items.${index}.name`)}
                        />
                        {isEditableQuote && (
                          <MaterialPickerButton
                            onSelect={(material) => {
                              form.setValue(`items.${index}.name`, material.name);
                              form.setValue(`items.${index}.unit`, material.unit);
                              form.setValue(`items.${index}.unitPrice`, material.salePrice);
                              const qty = form.getValues(`items.${index}.quantity`);
                              if (Number(qty) > 0) {
                                form.setValue(
                                  `items.${index}.unitPrice` as const,
                                  material.salePrice
                                );
                              }
                            }}
                          />
                        )}
                      </div>
                      <ErrorText message={form.formState.errors.items?.[index]?.name?.message} />
                    </Field>

                    <Field className="md:col-span-2">
                      <Label htmlFor={`items.${index}.description`}>Mô tả</Label>
                      <Textarea
                        id={`items.${index}.description`}
                        disabled={!isEditableQuote}
                        placeholder="Quy cách, phạm vi, model, thông số kỹ thuật..."
                        rows={3}
                        {...form.register(`items.${index}.description`)}
                      />
                      <ErrorText message={form.formState.errors.items?.[index]?.description?.message} />
                    </Field>

                    <Field>
                      <Label htmlFor={`items.${index}.unit`}>ĐVT</Label>
                      <Input
                        id={`items.${index}.unit`}
                        disabled={!isEditableQuote}
                        placeholder="Bộ / Gói / Cái"
                        {...form.register(`items.${index}.unit`)}
                      />
                      <ErrorText message={form.formState.errors.items?.[index]?.unit?.message} />
                    </Field>

                    <Field>
                      <Label htmlFor={`items.${index}.quantity`}>Số lượng</Label>
                      <Input
                        id={`items.${index}.quantity`}
                        min={0}
                        step="0.01"
                        type="number"
                        disabled={!isEditableQuote}
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
                        disabled={!isEditableQuote}
                        {...form.register(`items.${index}.unitPrice`, {
                          setValueAs: (value) => (value === "" ? 0 : Number(value))
                        })}
                      />
                      <ErrorText message={form.formState.errors.items?.[index]?.unitPrice?.message} />
                    </Field>
                  </div>

                  <div className="mt-4 rounded-lg bg-primary-bg/50 px-4 py-3 text-sm text-text-secondary">
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

              <Button disabled={!isEditableQuote} onClick={() => itemsFieldArray.append(createEmptyQuoteItem())} type="button" variant="outline">
                <AppIcon name="plus" className="h-4 w-4" />
                Thêm hạng mục
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="v2-label text-primary">Print Layout</p>
              <CardTitle>Độ rộng cột bảng báo giá</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {QUOTE_TABLE_WIDTH_FIELDS.map((column) => (
                  <Field key={column.key}>
                    <Label htmlFor={`tableColumnWidths.${column.key}`}>{column.label}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`tableColumnWidths.${column.key}`}
                        type="number"
                        min={column.min}
                        max={column.max}
                        step="1"
                        disabled={!isEditableQuote}
                        {...form.register(`tableColumnWidths.${column.key}`, {
                          setValueAs: (value) => (value === "" ? 0 : Number(value))
                        })}
                      />
                      <span className="shrink-0 text-sm font-semibold text-text-secondary">%</span>
                    </div>
                    <ErrorText message={form.formState.errors.tableColumnWidths?.[column.key]?.message} />
                  </Field>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white/80 px-4 py-3 text-sm text-text-secondary">
                <span>
                  Tổng nhập:{" "}
                  <strong className="text-text-primary">
                    {Object.values(watchedTableColumnWidths).reduce((sum, value) => sum + Number(value || 0), 0)}%
                  </strong>{" "}
                  · hệ thống sẽ tự chuẩn hóa về 100% khi render.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isEditableQuote}
                  onClick={() => {
                    form.setValue("tableColumnWidths", defaultQuoteTableColumnWidths, {
                      shouldDirty: true,
                      shouldValidate: true
                    });
                  }}
                >
                  Khôi phục mặc định
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="v2-label text-primary">Terms</p>
              <CardTitle>Điều khoản & ghi chú</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <Label htmlFor="terms">Điều khoản thanh toán</Label>
                <Textarea
                  id="terms"
                  disabled={!isEditableQuote}
                  placeholder="Ví dụ: 50% khi xác nhận PO, 50% khi nghiệm thu."
                  {...form.register("terms")}
                />
                <ErrorText message={form.formState.errors.terms?.message} />
              </Field>

              <Field>
                <Label htmlFor="deliveryTerms">Điều khoản giao hàng / triển khai</Label>
                <Textarea
                  id="deliveryTerms"
                  disabled={!isEditableQuote}
                  placeholder="Ví dụ: triển khai trong 21 ngày kể từ PO."
                  {...form.register("deliveryTerms")}
                />
                <ErrorText message={form.formState.errors.deliveryTerms?.message} />
              </Field>

              <Field>
                <Label htmlFor="internalNote">Ghi chú nội bộ</Label>
                <Textarea
                  id="internalNote"
                  disabled={!isEditableQuote}
                  placeholder="Nêu lưu ý thương mại, phạm vi chào giá, điểm cần follow-up."
                  {...form.register("internalNote")}
                />
                <ErrorText message={form.formState.errors.internalNote?.message} />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-28 border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="v2-label text-primary">Project Snapshot</p>
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
              <p className="v2-label text-accent">Quote Summary</p>
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
              <p className="v2-label text-primary">Action Desk</p>
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
                  {mode === "edit" && activeQuote ? (
                    <p>Quote hiện tại: {activeQuote.quoteNo} · v{activeQuote.version}</p>
                  ) : null}
                </div>
              ) : null}

              {mode === "edit" && activeQuote && !isEditableQuote ? (
                <div className="rounded-xl bg-warning-bg/80 px-4 py-3 text-sm text-warning">
                  Quote ở trạng thái <strong>{QUOTE_STATUS_LABELS[activeQuote.status]}</strong> không còn cho chỉnh sửa nội dung.
                  Hãy quay về màn chi tiết để dùng các action trạng thái hoặc tạo version mới.
                </div>
              ) : null}

              {activeErrorMessage ? (
                <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{activeErrorMessage}</div>
              ) : null}

              <Button className="h-11 rounded-xl" disabled={activeMutation.isPending || !isEditableQuote} type="submit">
                <AppIcon name="arrow-right" className="h-4 w-4" />
                {activeMutation.isPending
                  ? mode === "create"
                    ? "Đang tạo báo giá..."
                    : "Đang cập nhật báo giá..."
                  : mode === "create"
                    ? "Tạo báo giá"
                    : "Lưu thay đổi"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

// ─── Material Picker Button ──────────────────────────────────────────────────

function MaterialPickerButton({
  onSelect
}: {
  onSelect: (material: { id: string; name: string; unit: string; salePrice: number; code: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: materials, isLoading } = useMaterialsSelect(debouncedSearch || undefined);

  return (
    <div className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        className="h-9 gap-1.5 px-3 text-xs"
        onClick={() => setOpen((v) => !v)}
        title="Tìm vật tư"
      >
        <AppIcon name="search" className="h-3.5 w-3.5" />
        Vật tư
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-white shadow-lg">
            <div className="p-2">
              <Input
                autoFocus
                placeholder="Tìm mã hoặc tên vật tư..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {isLoading ? (
                <p className="px-4 py-3 text-sm text-text-secondary">Đang tải...</p>
              ) : !materials?.length ? (
                <p className="px-4 py-3 text-sm text-text-secondary">Không tìm thấy vật tư phù hợp.</p>
              ) : (
                materials.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-primary-bg"
                    onClick={() => {
                      onSelect(m as { id: string; name: string; unit: string; salePrice: number; code: string });
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="font-mono text-xs text-text-muted">{(m as { code: string }).code}</span>
                    <span className="flex-1 truncate text-text-primary">{m.name}</span>
                    <span className="shrink-0 text-xs text-text-secondary">{m.unit}</span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border p-2">
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs"
                onClick={() => { setOpen(false); setSearch(""); }}
              >
                Đóng
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Helper components ───────────────────────────────────────────────────────

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
