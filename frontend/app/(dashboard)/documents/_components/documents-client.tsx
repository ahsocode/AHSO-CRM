"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useBusinessDocuments } from "@/hooks/use-business-documents";
import { getApiErrorMessage } from "@/lib/api-client";
import { BusinessDocumentStatus, BusinessDocumentType } from "@/lib/types";
import { DocumentFilters } from "./document-filters";
import { DocumentTable } from "./document-table";
import { DocumentUploadDialog } from "./document-upload-dialog";

const PAGE_SIZE = 20;

export function DocumentsClient() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<BusinessDocumentType | "">("");
  const [status, setStatus] = useState<BusinessDocumentStatus | "">("");
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, type, status]);

  const documentsQuery = useBusinessDocuments({
    page,
    limit: PAGE_SIZE,
    search: deferredSearch || undefined,
    type: type || undefined,
    status: status || undefined
  });

  // isPending is consistent between SSR and client (isLoading would mismatch)
  const isLoading = documentsQuery.isPending;

  const canReset = search.length > 0 || type.length > 0 || status.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hồ sơ tài liệu"
        description="Quản lý toàn bộ tài liệu vòng đời hợp đồng: hợp đồng đã ký, biên bản nghiệm thu, hóa đơn và hồ sơ đính kèm."
        action={
          <Button variant="primary" onClick={() => setUploadOpen(true)}>
            Thêm tài liệu
          </Button>
        }
      />

      <DocumentFilters
        canReset={canReset}
        search={search}
        type={type}
        status={status}
        onSearchChange={setSearch}
        onTypeChange={setType}
        onStatusChange={setStatus}
        onReset={() => {
          setSearch("");
          setType("");
          setStatus("");
          setPage(1);
        }}
      />

      <DocumentTable
        errorMessage={getApiErrorMessage(documentsQuery.error, "Không thể tải danh sách tài liệu.")}
        isError={documentsQuery.isError}
        isLoading={isLoading}
        items={documentsQuery.data?.items ?? []}
        meta={
          documentsQuery.data
            ? {
                total: documentsQuery.data.total,
                page: documentsQuery.data.page,
                limit: documentsQuery.data.limit,
                totalPages: documentsQuery.data.totalPages
              }
            : undefined
        }
        onPageChange={setPage}
      />

      <DocumentUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
