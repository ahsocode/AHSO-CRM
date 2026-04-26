"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export interface DeletedRecordBase {
  id: string;
  deletedAt?: string | Date | null;
}

export function DeletedRecordsPanel<TRecord extends DeletedRecordBase>({
  title,
  description,
  emptyTitle,
  emptyDescription,
  items,
  isLoading,
  isError,
  errorMessage,
  isRestoring,
  onRestore,
  getTitle,
  getSubtitle,
  getMeta,
  page,
  totalPages,
  total,
  onPageChange
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  items: TRecord[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  isRestoring?: boolean;
  onRestore: (id: string) => void;
  getTitle: (record: TRecord) => string;
  getSubtitle?: (record: TRecord) => string | null | undefined;
  getMeta?: (record: TRecord) => string | null | undefined;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}) {
  const currentPage = page ?? 1;
  const lastPage = totalPages ?? 1;

  return (
    <Card className="border border-warning/20 bg-warning-bg/30">
      <CardHeader className="gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warning">Soft delete recovery</p>
          <CardTitle>{title}</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">{description}</p>
        </div>
        <Badge variant="warning">{total ?? items.length} bản ghi</Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <LoadingSkeleton key={index} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl bg-danger-bg/80 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách đã xóa."}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="space-y-3">
            {items.map((record) => (
              <article
                key={record.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white/85 p-4 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-heading text-lg font-bold text-text-primary">{getTitle(record)}</p>
                    <Badge variant="neutral">Đã xóa mềm</Badge>
                  </div>
                  {getSubtitle ? <p className="mt-1 text-sm text-text-secondary">{getSubtitle(record)}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-secondary">
                    {record.deletedAt ? <span>Xóa lúc {formatDateTime(record.deletedAt)}</span> : null}
                    {getMeta ? <span>{getMeta(record)}</span> : null}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isRestoring}
                  onClick={() => onRestore(record.id)}
                >
                  Khôi phục
                </Button>
              </article>
            ))}

            {onPageChange ? (
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => onPageChange(currentPage - 1)}
                >
                  Trang trước
                </Button>
                <span className="text-sm text-text-secondary">
                  Trang {currentPage}/{lastPage}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentPage >= lastPage}
                  onClick={() => onPageChange(currentPage + 1)}
                >
                  Trang sau
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
