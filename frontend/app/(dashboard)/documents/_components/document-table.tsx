"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { useDeleteBusinessDocument, useMarkBusinessDocumentSigned } from "@/hooks/use-business-documents";
import { apiClient } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { BusinessDocument, BusinessDocumentStatus } from "@/lib/types";
import { DocumentTypeBadge } from "./document-type-badge";

const DOCUMENT_STATUS_LABELS: Record<BusinessDocumentStatus, string> = {
  DRAFT: "Nháp",
  ISSUED: "Đã phát hành",
  RECEIVED: "Đã nhận",
  SIGNED: "Đã ký",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Từ chối",
  SUPERSEDED: "Đã thay thế",
  CANCELLED: "Đã hủy",
  ARCHIVED: "Lưu trữ"
};

type StatusVariant = "default" | "neutral" | "info" | "success" | "warning" | "danger";

function getStatusVariant(status: BusinessDocumentStatus): StatusVariant {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "ISSUED":
    case "RECEIVED":
      return "info";
    case "SIGNED":
    case "ACCEPTED":
      return "success";
    case "REJECTED":
    case "CANCELLED":
      return "danger";
    case "SUPERSEDED":
    case "ARCHIVED":
      return "neutral";
    default:
      return "neutral";
  }
}

async function downloadFile(id: string) {
  try {
    const response = await apiClient.get<Blob>(`/business-documents/${id}/file`, {
      responseType: "blob"
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `document-${id}`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    // Silently fail — backend will return 404 if no file attached
  }
}

function DocumentRowActions({ doc }: { doc: BusinessDocument }) {
  const deleteDocument = useDeleteBusinessDocument();
  const markSigned = useMarkBusinessDocumentSigned("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {doc.fileUrl ? (
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() => void downloadFile(doc.id)}
        >
          Tải xuống
        </Button>
      ) : null}
      {doc.status !== "SIGNED" && doc.status !== "ARCHIVED" && doc.status !== "SUPERSEDED" ? (
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() => void markSigned.mutateAsync(doc.id)}
          disabled={markSigned.isPending}
        >
          Đã ký
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        type="button"
        onClick={() => {
          if (confirm("Xóa tài liệu này?")) {
            void deleteDocument.mutate(doc.id);
          }
        }}
        disabled={deleteDocument.isPending}
        className="text-danger hover:text-danger"
      >
        Xóa
      </Button>
    </div>
  );
}

export interface DocumentTableMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function DocumentTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange
}: {
  items: BusinessDocument[];
  meta?: DocumentTableMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
}) {
  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách tài liệu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-border/60 p-4">
              <LoadingSkeleton className="h-16 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-danger/20">
        <CardHeader>
          <CardTitle>Danh sách tài liệu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách tài liệu."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách tài liệu</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Chưa có tài liệu nào"
            description="Nhấn 'Thêm tài liệu' để bắt đầu quản lý hồ sơ."
          />
        </CardContent>
      </Card>
    );
  }

  const currentPage = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Hồ sơ tài liệu</p>
          <CardTitle>Danh sách tài liệu</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            {meta?.total ?? items.length} tài liệu, trang {currentPage}/{totalPages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} variant="outline">
            Trang trước
          </Button>
          <Button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} variant="outline">
            Trang sau
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mobile card layout */}
        <div className="grid gap-3 lg:hidden">
          {items.map((doc) => (
            <article key={doc.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary leading-tight">{doc.title}</p>
                  {doc.documentNo ? (
                    <p className="mt-0.5 text-xs text-text-muted">{doc.documentNo}</p>
                  ) : null}
                </div>
                <Badge variant={getStatusVariant(doc.status)}>{DOCUMENT_STATUS_LABELS[doc.status]}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DocumentTypeBadge type={doc.type} />
              </div>
              <p className="mt-2 text-xs text-text-muted">
                {formatDate(doc.documentDate ?? doc.createdAt)}
              </p>
              <div className="mt-3">
                <DocumentRowActions doc={doc} />
              </div>
            </article>
          ))}
        </div>

        {/* Desktop table layout */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                <th className="px-4">Tài liệu</th>
                <th className="px-4">Loại</th>
                <th className="px-4">Liên kết</th>
                <th className="px-4">Trạng thái</th>
                <th className="px-4">Ngày</th>
                <th className="px-4">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((doc) => (
                <tr key={doc.id} className="bg-white/80 shadow-sm">
                  <td className="rounded-l-2xl px-4 py-4 align-top">
                    <div>
                      <p className="font-semibold text-text-primary leading-tight">{doc.title}</p>
                      {doc.documentNo ? (
                        <p className="mt-0.5 text-xs text-text-muted">{doc.documentNo}</p>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <DocumentTypeBadge type={doc.type} />
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="space-y-1 text-xs text-text-secondary">
                      {doc.customer ? (
                        <Link
                          href={`/customers/${doc.customer.id}`}
                          className="block hover:text-primary truncate max-w-[200px]"
                        >
                          {doc.customer.shortName ?? doc.customer.name}
                        </Link>
                      ) : null}
                      {doc.project ? (
                        <Link
                          href={`/projects/${doc.project.id}`}
                          className="block hover:text-primary truncate max-w-[200px]"
                        >
                          {doc.project.code} · {doc.project.name}
                        </Link>
                      ) : null}
                      {doc.contract ? (
                        <Link
                          href={`/contracts/${doc.contract.id}`}
                          className="block hover:text-primary"
                        >
                          HĐ: {doc.contract.contractNo}
                        </Link>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <Badge variant={getStatusVariant(doc.status)}>{DOCUMENT_STATUS_LABELS[doc.status]}</Badge>
                  </td>

                  <td className="px-4 py-4 align-top text-sm text-text-secondary whitespace-nowrap">
                    {formatDate(doc.documentDate ?? doc.createdAt)}
                  </td>

                  <td className="rounded-r-2xl px-4 py-4 align-top">
                    <DocumentRowActions doc={doc} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
