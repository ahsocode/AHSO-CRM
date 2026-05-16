"use client";

import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCreateBusinessDocument, useUploadBusinessDocumentFile } from "@/hooks/use-business-documents";
import { useProjects } from "@/hooks/use-projects";
import { useQueryClient } from "@tanstack/react-query";
import { BusinessDocumentSource, BusinessDocumentType } from "@/lib/types";

const DOCUMENT_TYPE_LABELS: Record<BusinessDocumentType, string> = {
  RFQ: "Yêu cầu báo giá (RFQ)",
  CUSTOMER_PO: "Đơn đặt hàng (PO)",
  QUOTATION: "Báo giá",
  SIGNED_QUOTATION: "Báo giá đã ký",
  PROPOSAL: "Đề xuất / Proposal",
  CONTRACT: "Hợp đồng",
  SIGNED_CONTRACT: "Hợp đồng đã ký",
  CONTRACT_ADDENDUM: "Phụ lục hợp đồng",
  NDA: "Thỏa thuận bảo mật (NDA)",
  DELIVERY_NOTE: "Biên bản bàn giao",
  DOC_HANDOVER: "Bàn giao tài liệu",
  INSTALLATION_REPORT: "Biên bản lắp đặt",
  ACCEPTANCE_REPORT: "Biên bản nghiệm thu",
  PARTIAL_ACCEPTANCE: "Nghiệm thu từng phần",
  WARRANTY_CERT: "Giấy bảo hành",
  MAINTENANCE_RECORD: "Biên bản bảo trì",
  PAYMENT_REQUEST: "Đề nghị thanh toán",
  PAYMENT_RECEIPT: "Biên lai thu tiền",
  INVOICE: "Hóa đơn",
  AR_RECONCILIATION: "Đối soát công nợ",
  OTHER: "Khác"
};

const UPLOAD_SOURCE_LABELS: Record<Exclude<BusinessDocumentSource, "GENERATED">, string> = {
  UPLOADED: "Upload lên",
  RECEIVED: "Nhận từ khách",
  SIGNED_UPLOAD: "Bản đã ký (scan)"
};

const uploadFormSchema = z.object({
  title: z.string().trim().min(2, "Tên tài liệu phải có ít nhất 2 ký tự").max(220),
  type: z.enum([
    "RFQ",
    "CUSTOMER_PO",
    "QUOTATION",
    "SIGNED_QUOTATION",
    "PROPOSAL",
    "CONTRACT",
    "SIGNED_CONTRACT",
    "CONTRACT_ADDENDUM",
    "NDA",
    "DELIVERY_NOTE",
    "DOC_HANDOVER",
    "INSTALLATION_REPORT",
    "ACCEPTANCE_REPORT",
    "PARTIAL_ACCEPTANCE",
    "WARRANTY_CERT",
    "MAINTENANCE_RECORD",
    "PAYMENT_REQUEST",
    "PAYMENT_RECEIPT",
    "INVOICE",
    "AR_RECONCILIATION",
    "OTHER"
  ] as const),
  source: z.enum(["UPLOADED", "RECEIVED", "SIGNED_UPLOAD"] as const),
  documentNo: z.string().trim().max(120).optional().or(z.literal("")),
  documentDate: z.string().optional().or(z.literal("")),
  projectId: z.string().optional().or(z.literal(""))
});

type UploadFormValues = z.infer<typeof uploadFormSchema>;

export function DocumentUploadDialog({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createDocument = useCreateBusinessDocument("");
  const uploadFile = useUploadBusinessDocumentFile("");
  const projectsQuery = useProjects({ page: 1, limit: 100 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      source: "UPLOADED",
      type: "OTHER"
    }
  });

  if (!open) return null;

  function handleClose() {
    reset();
    setSelectedFile(null);
    setSubmitError(null);
    onClose();
  }

  async function onSubmit(values: UploadFormValues) {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await createDocument.mutateAsync({
        title: values.title,
        type: values.type,
        source: values.source,
        status: "RECEIVED",
        documentNo: values.documentNo || undefined,
        documentDate: values.documentDate || undefined,
        projectId: values.projectId || undefined
      });

      if (selectedFile && created?.id) {
        await uploadFile.mutateAsync({ documentId: created.id, file: selectedFile });
      }

      await queryClient.invalidateQueries({ queryKey: ["business-documents"] });
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Không thể tạo tài liệu. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="font-heading text-xl font-bold text-text-primary">Thêm tài liệu</h2>
        <p className="mt-1 text-sm text-text-secondary">Upload hồ sơ hoặc tạo record tài liệu mới</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-text-primary" htmlFor="upload-title">
              Tên tài liệu <span className="text-danger">*</span>
            </label>
            <Input id="upload-title" {...register("title")} placeholder="Ví dụ: Hợp đồng số 2024-001" />
            {errors.title ? <p className="text-xs text-danger">{errors.title.message}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-primary" htmlFor="upload-type">
                Loại tài liệu <span className="text-danger">*</span>
              </label>
              <Select id="upload-type" {...register("type")}>
                {(Object.entries(DOCUMENT_TYPE_LABELS) as [BusinessDocumentType, string][]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {errors.type ? <p className="text-xs text-danger">{errors.type.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-primary" htmlFor="upload-source">
                Nguồn <span className="text-danger">*</span>
              </label>
              <Select id="upload-source" {...register("source")}>
                {(
                  Object.entries(UPLOAD_SOURCE_LABELS) as [Exclude<BusinessDocumentSource, "GENERATED">, string][]
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {errors.source ? <p className="text-xs text-danger">{errors.source.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-primary" htmlFor="upload-doc-no">
                Số hiệu tài liệu
              </label>
              <Input id="upload-doc-no" {...register("documentNo")} placeholder="Ví dụ: HD-2024-001" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-primary" htmlFor="upload-doc-date">
                Ngày tài liệu
              </label>
              <Input id="upload-doc-date" type="date" {...register("documentDate")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-text-primary" htmlFor="upload-project">
              Dự án liên kết
            </label>
            <Select id="upload-project" {...register("projectId")} disabled={projectsQuery.isError}>
              <option value="">{projectsQuery.isError ? "Không tải được dự án" : "Không gắn dự án"}</option>
              {(projectsQuery.data?.items ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} · {project.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-text-primary">Tệp đính kèm</label>
            <div
              className="cursor-pointer rounded-lg border-2 border-dashed border-border bg-bg-subtle px-4 py-5 text-center transition hover:border-primary-light hover:bg-primary-bg"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              role="button"
              tabIndex={0}
            >
              {selectedFile ? (
                <p className="text-sm font-medium text-text-primary">{selectedFile.name}</p>
              ) : (
                <p className="text-sm text-text-secondary">Nhấn để chọn tệp (PDF, Word, Excel, ảnh)</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {submitError ? (
            <div className="rounded-lg bg-danger-bg/70 px-4 py-3 text-sm text-danger">{submitError}</div>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : "Lưu tài liệu"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
