"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { PageHeader } from "@/components/layout/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { AppIcon } from "@/components/shared/app-icon";
import { usePermission } from "@/components/shared/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateQuote,
  useQuote,
  useUpdateQuote
} from "@/hooks/use-quotes";
import { useProject, useProjects } from "@/hooks/use-projects";
import { usePolicies } from "@/hooks/use-settings";
import { useProjectBoms } from "@/hooks/use-boms";
import { getApiErrorMessage } from "@/lib/api-client";
import { BOM_STATUS_LABELS, QUOTE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatVND } from "@/lib/format";
import { QuoteStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  defaultQuoteTableColumnWidths,
  defaultQuoteFormValues,
  quoteFormSchema,
  type QuoteFormValues
} from "./form-schemas";
import { PolicyItemSelect } from "./policy-item-select";
import { QuoteTemplateControls } from "./quote-template-controls";
import { QuoteItemsTable } from "./quote-items-table";

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
  const canViewProject = usePermission("projects.view");
  const [bomItemIndex, setBomItemIndex] = useState<number | null>(null);
  const createQuoteMutation = useCreateQuote();
  const updateQuoteMutation = useUpdateQuote(quoteId ?? "");
  const quoteQuery = useQuote(mode === "edit" ? quoteId ?? "" : "");
  const policiesQuery = usePolicies();
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

  // Track which quoteId has already been loaded to prevent re-reset on background refetches.
  const initializedQuoteIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (mode !== "create") {
      return;
    }
    // Default payment/delivery terms arrive asynchronously. Once the user has
    // started typing, never reset — a slow policies response used to wipe the
    // line items they had already entered. Fill only still-empty term fields.
    if (form.formState.isDirty) {
      if (!form.getValues("terms") && policiesQuery.data?.paymentTerms) {
        form.setValue("terms", policiesQuery.data.paymentTerms);
      }
      if (!form.getValues("deliveryTerms") && policiesQuery.data?.deliveryTerms) {
        form.setValue("deliveryTerms", policiesQuery.data.deliveryTerms);
      }
      return;
    }
    form.reset({
      ...defaultQuoteFormValues,
      projectId: initialProjectId,
      terms: policiesQuery.data?.paymentTerms ?? "",
      deliveryTerms: policiesQuery.data?.deliveryTerms ?? ""
    });
  }, [form, initialProjectId, mode, policiesQuery.data]);

  // A native <select> can only display the preselected project (?projectId=)
  // once its <option> exists. The value was set before the project list loaded,
  // so the field looked empty although it was filled — re-apply after load.
  useEffect(() => {
    if (
      mode === "create" &&
      initialProjectId &&
      projectsQuery.data?.items.some((project) => project.id === initialProjectId)
    ) {
      form.setValue("projectId", initialProjectId);
    }
  }, [form, initialProjectId, mode, projectsQuery.data]);

  useEffect(() => {
    if (mode === "edit" && quoteQuery.data && initializedQuoteIdRef.current !== quoteQuery.data.id) {
      initializedQuoteIdRef.current = quoteQuery.data.id;
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
          bomId: item.bomId ?? null,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      });
    }
  }, [form, mode, quoteQuery.data]);

  const selectedProjectId = form.watch("projectId");
  const projectBomsQuery = useProjectBoms(canViewProject ? selectedProjectId : "");
  const previousProjectId = useRef(selectedProjectId);
  useEffect(() => {
    if (previousProjectId.current && previousProjectId.current !== selectedProjectId) {
      // BOM links belong to one project and must never follow a project change.
      form.getValues("items").forEach((_, index) => {
        form.setValue(`items.${index}.bomId`, null, { shouldDirty: true });
      });
      setBomItemIndex(null);
    }
    previousProjectId.current = selectedProjectId;
  }, [form, selectedProjectId]);
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
        <Card className="border-0 bg-bg-card">
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
        eyebrow="Báo giá"
        title={mode === "create" ? "Tạo báo giá mới" : "Cập nhật báo giá"}
        description={
          mode === "create"
            ? "Chọn dự án, nhập hạng mục và xem trước bản in trước khi gửi khách."
            : "Chỉnh sửa nội dung thương mại của phiên bản hiện tại trước khi gửi khách hoặc tạo phiên bản kế tiếp."
        }
        action={
          <div className="flex flex-wrap items-center gap-3">
            {mode === "edit" && quoteId ? (
              <Link href={`/quotes/${quoteId}`} className={cn(buttonVariants({ variant: "outline" }))}>
                Về chi tiết báo giá
              </Link>
            ) : selectedProjectId ? (
              <Link href={`/projects/${selectedProjectId}`} className={cn(buttonVariants({ variant: "outline" }))}>
                Về dự án
              </Link>
            ) : null}
          </div>
        }
      />

      <form
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"
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
          <Card className="border-0 bg-bg-card">
            <CardHeader className="mb-0 gap-2">
              <p className="v2-label text-primary">
                {mode === "create" ? "Báo giá mới" : "Chỉnh sửa báo giá"}
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
                    Phiên bản hiện tại được khóa với dự án gốc. Nếu cần báo giá cho dự án khác, hãy tạo báo giá mới.
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

              <div className="rounded-2xl bg-bg-subtle p-4 text-sm text-text-secondary">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Số báo giá</p>
                <p className="mt-2 font-semibold text-text-primary">
                  {mode === "edit" && activeQuote ? `${activeQuote.quoteNo} · v${activeQuote.version}` : "Được sinh tự động khi lưu"}
                </p>
                <p className="mt-1">
                  {mode === "edit"
                    ? "Phiên bản mới nên được tạo bằng thao tác nhân bản trên trang chi tiết."
                    : "Phiên bản sẽ tự tăng theo số báo giá đã có trên cùng dự án."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-bg-card">
            <CardHeader className="mb-0 gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="v2-label text-accent">Hạng mục</p>
                  <CardTitle>Danh mục chào giá</CardTitle>
                </div>
                <QuoteTemplateControls
                  disabled={!isEditableQuote}
                  getSnapshot={() => ({
                    items: form.getValues("items").map(({ bomId: _bomId, ...item }) => item),
                    terms: form.getValues("terms"),
                    deliveryTerms: form.getValues("deliveryTerms")
                  })}
                  onApply={(template) => {
                    itemsFieldArray.replace(template.items);
                    if (template.terms) {
                      form.setValue("terms", template.terms, { shouldDirty: true });
                    }
                    if (template.deliveryTerms) {
                      form.setValue("deliveryTerms", template.deliveryTerms, { shouldDirty: true });
                    }
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <QuoteItemsTable
                form={form}
                itemsFieldArray={itemsFieldArray}
                isEditable={isEditableQuote}
                items={watchedItems}
                subtotal={subtotal}
                taxRate={Number(watchedTaxRate) || 0}
                taxAmount={taxAmount}
                grandTotal={grandTotal}
                boms={projectBomsQuery.data ?? []}
                onAttachBom={canViewProject && selectedProjectId ? setBomItemIndex : undefined}
              />
            </CardContent>
          </Card>

          <Card className="border-0 bg-bg-card">
            <details className="group">
            <summary className="cursor-pointer select-none px-6 py-4 text-sm font-semibold text-text-primary">
              Tùy chỉnh bản in (nâng cao)
            </summary>
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

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bg-subtle px-4 py-3 text-sm text-text-secondary">
                <span>
                  Tổng nhập:{" "}
                  <strong className="text-text-primary">
                    {Object.values(watchedTableColumnWidths).reduce((sum, value) => sum + Number(value || 0), 0)}%
                  </strong>{" "}
                  · hệ thống sẽ tự chuẩn hóa về 100% khi tạo bản in.
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
            </details>
          </Card>

          <Card className="border-0 bg-bg-card">
            <CardHeader className="mb-0 gap-2">
              <CardTitle>Điều khoản & ghi chú</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="terms">Điều khoản thanh toán</Label>
                  {isEditableQuote && (
                    <PolicyItemSelect
                      type="PAYMENT_TERMS"
                      onSelect={(content) => form.setValue("terms", content, { shouldDirty: true })}
                    />
                  )}
                </div>
                <Textarea
                  id="terms"
                  disabled={!isEditableQuote}
                  placeholder="Ví dụ: 50% khi xác nhận PO, 50% khi nghiệm thu."
                  {...form.register("terms")}
                />
                <ErrorText message={form.formState.errors.terms?.message} />
              </Field>

              <Field>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="deliveryTerms">Điều khoản giao hàng / triển khai</Label>
                  {isEditableQuote && (
                    <PolicyItemSelect
                      type="DELIVERY_TERMS"
                      onSelect={(content) => form.setValue("deliveryTerms", content, { shouldDirty: true })}
                    />
                  )}
                </div>
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
                  placeholder="Nêu lưu ý thương mại, phạm vi chào giá, điểm cần theo dõi thêm."
                  {...form.register("internalNote")}
                />
                <ErrorText message={form.formState.errors.internalNote?.message} />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="sticky top-[72px] max-h-[calc(100vh-88px)] space-y-6 self-start overflow-y-auto">
          <Card className="border-0 bg-bg-card" data-testid="quote-summary">
            <CardHeader className="mb-0 gap-2">
              <CardTitle>Tổng hợp giá trị</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <InfoRow label="Tạm tính" value={<CurrencyDisplay amount={subtotal} />} />
              <InfoRow label={`VAT ${watchedTaxRate}%`} value={<CurrencyDisplay amount={taxAmount} />} />
              <InfoRow label="Tổng cộng" value={<CurrencyDisplay amount={grandTotal} />} emphasized />
              <InfoRow label="Số dòng" value={`${watchedItems.length}`} />
            </CardContent>
          </Card>

          <Card className="border-0 bg-bg-card">
            <CardHeader className="mb-0 gap-2">
              <p className="v2-label text-primary">Dự án & khách hàng</p>
              <CardTitle>Dự án và khách hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedProjectId ? (
                <EmptyState
                  title="Chưa chọn dự án"
                  description="Chọn dự án để tự điền khách hàng và người phụ trách."
                />
              ) : selectedProjectQuery.isLoading ? (
                <LoadingSkeleton className="h-56 w-full" />
              ) : selectedProject ? (
                <>
                  <div className="rounded-lg bg-bg-subtle p-4">
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

          <Card className="border-0 bg-bg-card">
            <CardHeader className="mb-0 gap-2">
              <p className="v2-label text-primary">Thao tác</p>
              <CardTitle>Kiểm tra trước khi lưu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {projectsQuery.isError ? (
                <div className="rounded-xl bg-warning-bg/80 px-4 py-3 text-sm text-warning">
                  Không tải được danh sách dự án. Bạn vẫn có thể tiếp tục nếu dự án đã được chọn hợp lệ.
                </div>
              ) : null}

              {selectedProject ? (
                <div className="rounded-2xl bg-bg-subtle p-4 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">{selectedProject.customer.name}</p>
                  <p className="mt-2">Dự án tạo lúc: {formatDateTime(selectedProject.createdAt)}</p>
                  <p>Cập nhật cuối: {formatDateTime(selectedProject.updatedAt)}</p>
                  {mode === "edit" && activeQuote ? (
                    <p>Báo giá hiện tại: {activeQuote.quoteNo} · v{activeQuote.version}</p>
                  ) : null}
                </div>
              ) : null}

              {mode === "edit" && activeQuote && !isEditableQuote ? (
                <div className="rounded-xl bg-warning-bg/80 px-4 py-3 text-sm text-warning">
                  Báo giá ở trạng thái <strong>{QUOTE_STATUS_LABELS[activeQuote.status]}</strong> không còn cho chỉnh sửa nội dung.
                  Hãy quay về màn chi tiết để chuyển trạng thái hoặc tạo phiên bản mới.
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
      <Dialog open={bomItemIndex !== null} onOpenChange={(open) => { if (!open) setBomItemIndex(null); }}>
        <DialogContent aria-labelledby="quote-bom-title">
          <DialogHeader>
            <DialogTitle id="quote-bom-title">Gắn BOM</DialogTitle>
            <DialogDescription>Chọn BOM của cùng dự án để tính giá vốn dự kiến cho dòng báo giá.</DialogDescription>
          </DialogHeader>
          {projectBomsQuery.isError ? (
            <p role="alert" className="rounded-lg bg-danger-bg p-3 text-sm text-danger">
              {getApiErrorMessage(projectBomsQuery.error, "Không thể tải BOM của dự án.")}
            </p>
          ) : (
            <div className="space-y-2">
              <label htmlFor="quote-item-bom" className="text-sm font-semibold text-text-primary">BOM dự án</label>
              <Select
                id="quote-item-bom"
                disabled={projectBomsQuery.isLoading}
                value={bomItemIndex === null ? "" : watchedItems[bomItemIndex]?.bomId ?? ""}
                onChange={(event) => {
                  if (bomItemIndex !== null) {
                    form.setValue(`items.${bomItemIndex}.bomId`, event.target.value || null, { shouldDirty: true });
                  }
                }}
              >
                <option value="">{projectBomsQuery.isLoading ? "Đang tải..." : "Không gắn BOM"}</option>
                {(projectBomsQuery.data ?? []).map((bom) => (
                  <option key={bom.id} value={bom.id}>
                    {bom.code} · {bom.name} · {BOM_STATUS_LABELS[bom.status]} · {formatVND(bom.total)}
                  </option>
                ))}
              </Select>
              {!projectBomsQuery.isLoading && !projectBomsQuery.data?.length ? (
                <p className="text-sm text-text-secondary">Dự án chưa có BOM. Tạo BOM ở tab BOM / Dự toán của dự án.</p>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setBomItemIndex(null)}>Xong</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm odd:bg-bg-subtle">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <div
        className={cn(
          "text-right font-semibold tabular-nums text-text-primary",
          emphasized ? "font-heading text-xl" : ""
        )}
      >
        {value}
      </div>
    </div>
  );
}
