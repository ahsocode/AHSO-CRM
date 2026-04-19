"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { CustomFieldRenderer } from "@/components/shared/custom-field-renderer";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCustomFields } from "@/hooks/use-custom-fields";
import { useContract, useCreateContract, useUpdateContract } from "@/hooks/use-contracts";
import { useProject, useProjects } from "@/hooks/use-projects";
import { getApiErrorMessage } from "@/lib/api-client";
import { CONTRACT_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { ContractStatus, CustomFieldValues } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContractFileUploader } from "./contract-file-uploader";
import { ErrorText, Field, Label } from "./form-primitives";
import {
  contractFormSchema,
  defaultContractFormValues,
  type ContractFormValues
} from "./form-schemas";

const CONTRACT_STATUS_OPTIONS: ContractStatus[] = ["ACTIVE", "SUSPENDED", "COMPLETED", "CANCELLED"];

function toCreatePayload(values: ContractFormValues) {
  return {
    projectId: values.projectId,
    sourceQuoteId: values.sourceQuoteId,
    signDate: values.signDate,
    startDate: values.startDate,
    endDate: values.endDate,
    value: values.value,
    status: values.status,
    fileUrl: values.fileUrl ?? null,
    notes: values.notes
  };
}

function toUpdatePayload(values: ContractFormValues) {
  return {
    signDate: values.signDate,
    startDate: values.startDate,
    endDate: values.endDate,
    value: values.value,
    status: values.status,
    fileUrl: values.fileUrl ?? null,
    notes: values.notes
  };
}

export function ContractFormScreen({
  mode = "create",
  initialProjectId = "",
  initialSourceQuoteId = "",
  contractId
}: {
  mode?: "create" | "edit";
  initialProjectId?: string;
  initialSourceQuoteId?: string;
  contractId?: string;
}) {
  const router = useRouter();
  const createContractMutation = useCreateContract();
  const updateContractMutation = useUpdateContract(contractId ?? "");
  const contractQuery = useContract(mode === "edit" ? contractId ?? "" : "");
  const customFieldsQuery = useCustomFields("contract");
  const projectsQuery = useProjects({
    page: 1,
    limit: 100
  });
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      ...defaultContractFormValues,
      projectId: initialProjectId,
      sourceQuoteId: initialSourceQuoteId || undefined
    }
  });

  useEffect(() => {
    if (mode === "create") {
      form.reset({
        ...defaultContractFormValues,
        projectId: initialProjectId,
        sourceQuoteId: initialSourceQuoteId || undefined
      });
      setCustomFieldValues({});
    }
  }, [form, initialProjectId, initialSourceQuoteId, mode]);

  useEffect(() => {
    if (mode === "edit" && contractQuery.data) {
      form.reset({
        projectId: contractQuery.data.project.id,
        sourceQuoteId: undefined,
        signDate: contractQuery.data.signDate ? contractQuery.data.signDate.slice(0, 10) : "",
        startDate: contractQuery.data.startDate ? contractQuery.data.startDate.slice(0, 10) : "",
        endDate: contractQuery.data.endDate ? contractQuery.data.endDate.slice(0, 10) : "",
        value: contractQuery.data.value,
        status: contractQuery.data.status,
        fileUrl: contractQuery.data.fileUrl ?? null,
        notes: contractQuery.data.notes ?? ""
      });
      setCustomFieldValues(contractQuery.data.customFieldValues ?? {});
    }
  }, [contractQuery.data, form, mode]);

  const selectedProjectId = form.watch("projectId");
  const selectedSourceQuoteId = form.watch("sourceQuoteId");
  const selectedFileUrl = form.watch("fileUrl");
  const selectedProjectQuery = useProject(selectedProjectId || "");
  const activeContract = contractQuery.data;
  const availableProjects = useMemo(
    () =>
      (projectsQuery.data?.items ?? []).filter(
        (project) => mode === "edit" || !project.contract || project.id === selectedProjectId
      ),
    [mode, projectsQuery.data?.items, selectedProjectId]
  );
  const selectedProjectListItem =
    (projectsQuery.data?.items ?? []).find((project) => project.id === selectedProjectId) ?? null;
  const selectedProject = selectedProjectQuery.data;
  const acceptedQuotes = (selectedProject?.quotes ?? []).filter((quote) => quote.status === "ACCEPTED");
  const selectedSourceQuote =
    acceptedQuotes.find((quote) => quote.id === selectedSourceQuoteId) ?? null;

  useEffect(() => {
    if (mode !== "create") {
      return;
    }

    if (!selectedProjectId) {
      form.setValue("sourceQuoteId", undefined);
      return;
    }

    if (selectedSourceQuoteId && !acceptedQuotes.some((quote) => quote.id === selectedSourceQuoteId)) {
      form.setValue("sourceQuoteId", undefined, {
        shouldDirty: true
      });
      return;
    }

    if (
      !selectedSourceQuoteId &&
      initialSourceQuoteId &&
      acceptedQuotes.some((quote) => quote.id === initialSourceQuoteId)
    ) {
      form.setValue("sourceQuoteId", initialSourceQuoteId, {
        shouldDirty: false
      });
    }
  }, [acceptedQuotes, form, initialSourceQuoteId, mode, selectedProjectId, selectedSourceQuoteId]);

  useEffect(() => {
    if (mode !== "create") {
      return;
    }

    if (selectedSourceQuote) {
      form.setValue("value", selectedSourceQuote.total, {
        shouldDirty: true,
        shouldValidate: true
      });
    }
  }, [form, mode, selectedSourceQuote]);

  const activeMutation = mode === "create" ? createContractMutation : updateContractMutation;
  const activeErrorMessage = activeMutation.isError
    ? getApiErrorMessage(
        activeMutation.error,
        mode === "create" ? "Không thể tạo hợp đồng." : "Không thể cập nhật hợp đồng."
      )
    : null;
  const hasExistingContract =
    mode === "create" && Boolean(selectedProjectListItem?.contract && selectedProjectListItem.id === selectedProjectId);

  if (mode === "edit" && contractQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full" />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <LoadingSkeleton className="h-[760px] w-full" />
          <LoadingSkeleton className="h-[620px] w-full" />
        </div>
      </div>
    );
  }

  if (mode === "edit" && (contractQuery.isError || !activeContract || !contractId)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cập nhật hợp đồng"
          description="Không thể tải dữ liệu hợp đồng để chỉnh sửa."
          action={
            <Link href="/contracts" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          }
        />
        <Card className="border border-danger/20">
          <CardContent className="p-6">
            <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
              {getApiErrorMessage(contractQuery.error, "Không thể tải dữ liệu hợp đồng.")}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={mode === "create" ? "Tạo hợp đồng" : "Cập nhật hợp đồng"}
        description={
          mode === "create"
            ? "Chốt hợp đồng từ dự án thật, khóa số hợp đồng tự động và chuyển project sang nhịp delivery ngay khi phát hành."
            : "Cập nhật thông tin thương mại, file scan và trạng thái hợp đồng để project, reports và công nợ luôn đồng bộ."
        }
        action={
          <div className="flex flex-wrap items-center gap-3">
            {mode === "edit" && contractId ? (
              <Link href={`/contracts/${contractId}`} className={cn(buttonVariants({ variant: "outline" }))}>
                Về chi tiết
              </Link>
            ) : null}
            {selectedProjectId ? (
              <Link href={`/projects/${selectedProjectId}`} className={cn(buttonVariants({ variant: "outline" }))}>
                Mở dự án
              </Link>
            ) : null}
            <Link href="/contracts" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          </div>
        }
      />

      <form
        className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"
        onSubmit={form.handleSubmit((values) => {
          const createPayload = {
            ...toCreatePayload(values),
            customFieldValues
          };
          const updatePayload = {
            ...toUpdatePayload(values),
            customFieldValues
          };

          if (mode === "edit" && contractId) {
            updateContractMutation.mutate(updatePayload, {
              onSuccess: (contract) => {
                router.push(`/contracts/${contract.id}`);
              }
            });
            return;
          }

          createContractMutation.mutate(createPayload, {
            onSuccess: (contract) => {
              router.push(`/contracts/${contract.id}`);
            }
          });
        })}
      >
        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-primary/10 text-primary">
                {mode === "create" ? "Contract Draft" : "Contract Revision"}
              </p>
              <CardTitle>Thông tin hợp đồng</CardTitle>
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
                    {projectsQuery.isLoading ? "Đang tải danh sách dự án..." : "Chọn dự án để tạo hợp đồng"}
                  </option>
                  {availableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} · {project.name}
                    </option>
                  ))}
                </Select>
                <ErrorText message={form.formState.errors.projectId?.message} />
                {mode === "edit" ? (
                  <p className="text-sm text-text-secondary">
                    Hợp đồng đã khóa với dự án gốc. Nếu cần đổi dự án, hãy tạo hợp đồng mới.
                  </p>
                ) : null}
              </Field>

              {mode === "create" ? (
                <Field className="md:col-span-2">
                  <Label htmlFor="sourceQuoteId">Báo giá nguồn</Label>
                  <Select
                    id="sourceQuoteId"
                    disabled={!selectedProjectId || selectedProjectQuery.isLoading}
                    {...form.register("sourceQuoteId")}
                    value={selectedSourceQuoteId ?? ""}
                  >
                    <option value="">
                      {!selectedProjectId
                        ? "Chọn dự án trước"
                        : selectedProjectQuery.isLoading
                          ? "Đang tải báo giá được chấp nhận..."
                          : acceptedQuotes.length > 0
                            ? "Chọn báo giá nguồn nếu muốn bám theo quote đã chấp nhận"
                            : "Không có báo giá accepted, có thể nhập hợp đồng thủ công"}
                    </option>
                    {acceptedQuotes.map((quote) => (
                      <option key={quote.id} value={quote.id}>
                        {quote.quoteNo} · v{quote.version} · {quote.total.toLocaleString("vi-VN")} VND
                      </option>
                    ))}
                  </Select>
                  <ErrorText message={form.formState.errors.sourceQuoteId?.message} />
                </Field>
              ) : null}

              <Field>
                <Label htmlFor="status">Trạng thái</Label>
                <Select id="status" {...form.register("status")}>
                  {CONTRACT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {CONTRACT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
                <ErrorText message={form.formState.errors.status?.message} />
              </Field>

              <Field>
                <Label htmlFor="value">Giá trị hợp đồng</Label>
                <Input
                  id="value"
                  min={0}
                  step="1"
                  type="number"
                  {...form.register("value", {
                    setValueAs: (value) => (value === "" ? 0 : Number(value))
                  })}
                />
                <ErrorText message={form.formState.errors.value?.message} />
              </Field>

              <Field>
                <Label htmlFor="signDate">Ngày ký</Label>
                <Input id="signDate" type="date" {...form.register("signDate")} />
                <ErrorText message={form.formState.errors.signDate?.message} />
              </Field>

              <Field>
                <Label htmlFor="startDate">Ngày bắt đầu</Label>
                <Input id="startDate" type="date" {...form.register("startDate")} />
                <ErrorText message={form.formState.errors.startDate?.message} />
              </Field>

              <Field>
                <Label htmlFor="endDate">Ngày kết thúc</Label>
                <Input id="endDate" type="date" {...form.register("endDate")} />
                <ErrorText message={form.formState.errors.endDate?.message} />
              </Field>

              <Field className="md:col-span-2">
                <Label htmlFor="fileUrl">File đính kèm</Label>
                <ContractFileUploader
                  disabled={activeMutation.isPending}
                  error={form.formState.errors.fileUrl?.message}
                  value={selectedFileUrl}
                  onChange={(nextValue) => {
                    form.setValue("fileUrl", nextValue, {
                      shouldDirty: true,
                      shouldValidate: true
                    });
                  }}
                />
                <ErrorText message={form.formState.errors.fileUrl?.message} />
              </Field>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-accent/10 text-accent">Notes</p>
              <CardTitle>Ghi chú thương mại</CardTitle>
            </CardHeader>
            <CardContent>
              <Field>
                <Label htmlFor="notes">Ghi chú nội bộ</Label>
                <Textarea
                  id="notes"
                  placeholder="Nêu lưu ý triển khai, điều khoản đặc biệt hoặc yêu cầu bàn giao."
                  {...form.register("notes")}
                />
                <ErrorText message={form.formState.errors.notes?.message} />
              </Field>
            </CardContent>
          </Card>

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
                emptyTitle="Chưa có custom field cho hợp đồng"
                emptyDescription="Admin có thể tạo thêm field động tại Quản trị > Custom Fields."
              />
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
                  description="Chọn một dự án để kéo theo context khách hàng, báo giá accepted và trạng thái hiện tại."
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
                      <StatusBadge kind="project" status={selectedProject.status} />
                      {selectedProject.contract ? (
                        <Badge variant="warning">{selectedProject.contract.contractNo}</Badge>
                      ) : null}
                    </div>
                  </div>

                  <InfoRow label="Khách hàng" value={selectedProject.customer.name} />
                  <InfoRow label="Owner" value={selectedProject.customer.assignedTo.name} />
                  <InfoRow
                    label="Giá trị dự kiến"
                    value={<CurrencyDisplay amount={selectedProject.estimatedValue} short />}
                  />
                  <InfoRow label="Quote accepted" value={`${acceptedQuotes.length}`} />
                  <InfoRow
                    label="Cập nhật cuối"
                    value={formatDateTime(selectedProject.updatedAt)}
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
              <p className="industrial-chip bg-accent/10 text-accent">Source Quote</p>
              <CardTitle>Nguồn thương mại</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "edit" ? (
                <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">{activeContract?.contractNo}</p>
                  <p className="mt-2">
                    Hợp đồng hiện tại đang gắn với dự án {activeContract?.project.code}. Báo giá nguồn chỉ dùng ở bước tạo mới.
                  </p>
                </div>
              ) : selectedSourceQuote ? (
                <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm text-text-secondary">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/quotes/${selectedSourceQuote.id}`} className="font-semibold text-text-primary hover:text-primary">
                      {selectedSourceQuote.quoteNo}
                    </Link>
                    <Badge variant="neutral">v{selectedSourceQuote.version}</Badge>
                    <StatusBadge kind="quote" status={selectedSourceQuote.status} />
                  </div>
                  <p className="mt-2">
                    Giá trị quote: <span className="font-semibold text-text-primary"><CurrencyDisplay amount={selectedSourceQuote.total} short /></span>
                  </p>
                  <p className="mt-1">
                    Khách chấp nhận: {selectedSourceQuote.acceptedAt ? formatDate(selectedSourceQuote.acceptedAt) : "Chưa ghi nhận"}
                  </p>
                </div>
              ) : (
                <EmptyState
                  title="Chưa chọn báo giá nguồn"
                  description="Bạn có thể chọn accepted quote để prefill giá trị hợp đồng hoặc nhập thủ công nếu đang nhập lại hồ sơ cũ."
                />
              )}
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="industrial-chip bg-primary/10 text-primary">Action Desk</p>
              <CardTitle>Kiểm tra trước khi lưu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasExistingContract ? (
                <div className="rounded-xl bg-warning-bg/80 px-4 py-3 text-sm text-warning">
                  Dự án này đã có hợp đồng. Hãy mở contract hiện tại để chỉnh sửa thay vì tạo mới.
                  {selectedProjectListItem?.contract ? (
                    <>
                      {" "}
                      <Link
                        href={`/contracts/${selectedProjectListItem.contract.id}`}
                        className="font-semibold underline underline-offset-2"
                      >
                        Mở hợp đồng hiện tại
                      </Link>
                      .
                    </>
                  ) : null}
                </div>
              ) : null}

              {mode === "create" && selectedProjectId && acceptedQuotes.length === 0 ? (
                <div className="rounded-xl bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                  Dự án chưa có quote được chấp nhận. Bạn vẫn có thể tạo hợp đồng thủ công nếu đang nhập lại dữ liệu cũ.
                </div>
              ) : null}

              {selectedProject ? (
                <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">{selectedProject.customer.name}</p>
                  <p className="mt-2">Dự án tạo lúc: {formatDateTime(selectedProject.createdAt)}</p>
                  <p>Cập nhật cuối: {formatDateTime(selectedProject.updatedAt)}</p>
                  {activeContract ? <p>Contract hiện tại: {activeContract.contractNo}</p> : null}
                </div>
              ) : null}

              {activeErrorMessage ? (
                <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{activeErrorMessage}</div>
              ) : null}

              <Button className="h-11 rounded-xl" disabled={activeMutation.isPending || hasExistingContract} type="submit">
                <AppIcon name="arrow-right" className="h-4 w-4" />
                {activeMutation.isPending
                  ? mode === "create"
                    ? "Đang tạo hợp đồng..."
                    : "Đang cập nhật hợp đồng..."
                  : mode === "create"
                    ? "Tạo hợp đồng"
                    : "Lưu thay đổi"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

function InfoRow({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <div className="mt-2 font-semibold text-text-primary">{value}</div>
    </div>
  );
}
