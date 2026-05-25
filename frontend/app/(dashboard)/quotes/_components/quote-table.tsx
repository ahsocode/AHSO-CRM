import Link from "next/link";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { AppIcon } from "@/components/shared/app-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { QuoteListItem, QuoteListMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QuoteTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange,
  selectedIds,
  allVisibleSelected,
  onToggleSelect,
  onToggleSelectAll
}: {
  items: QuoteListItem[];
  meta?: QuoteListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
  selectedIds: string[];
  allVisibleSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}) {
  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardHeader><CardTitle>Danh sách báo giá</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-danger/20">
        <CardHeader><CardTitle>Danh sách báo giá</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách báo giá."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border border-white/70">
        <CardHeader><CardTitle>Danh sách báo giá</CardTitle></CardHeader>
        <CardContent>
          <EmptyState
            title="Chưa có báo giá phù hợp"
            description="Thay đổi bộ lọc hoặc tạo báo giá mới từ dự án đang ở giai đoạn khảo sát/báo giá để tiếp tục kiểm tra flow."
          />
        </CardContent>
      </Card>
    );
  }

  const currentPage = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <Card className="border border-white/70">
      <CardHeader className="gap-2 pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Quote Ledger</p>
          <CardTitle>Danh sách báo giá</CardTitle>
          <p className="mt-1 text-sm text-text-secondary">
            {meta?.total ?? items.length} báo giá · trang {currentPage}/{totalPages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} variant="outline" size="sm">
            <AppIcon name="chevron-left" className="mr-1 text-base" />
            Trước
          </Button>
          <span className="min-w-[3rem] text-center text-sm font-medium text-text-secondary">
            {currentPage} / {totalPages}
          </span>
          <Button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} variant="outline" size="sm">
            Tiếp
            <AppIcon name="chevron-right" className="ml-1 text-base" />
          </Button>
        </div>
      </CardHeader>

      {/* Mobile */}
      <CardContent className="md:hidden space-y-2">
        {items.map((quote) => (
          <article key={quote.id} className="rounded-xl border border-border/60 bg-white/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <Checkbox
                  checked={selectedIds.includes(quote.id)}
                  onCheckedChange={() => onToggleSelect(quote.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <Link href={`/quotes/${quote.id}`} className="font-semibold text-text-primary hover:text-primary">
                    {quote.quoteNo}
                  </Link>
                  <p className="text-xs text-text-secondary">{quote.project.name}</p>
                </div>
              </div>
              <StatusBadge status={quote.status} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-text-primary">
                <CurrencyDisplay amount={quote.total} short />
              </span>
              <span className="text-xs text-text-muted">{quote.itemCount} hạng mục</span>
            </div>
          </article>
        ))}
      </CardContent>

      {/* Desktop compact table */}
      <CardContent className="hidden md:block p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border/50 bg-bg-subtle/60">
                <th className="w-10 px-4 py-2.5">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={onToggleSelectAll} />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  Báo giá
                </th>
                <th className="w-52 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  Dự án / Khách hàng
                </th>
                <th className="w-36 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  Giá trị
                </th>
                <th className="w-52 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  Timeline
                </th>
                <th className="w-16 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {items.map((quote) => {
                const isSelected = selectedIds.includes(quote.id);
                return (
                  <tr
                    key={quote.id}
                    className={cn(
                      "group transition-colors hover:bg-primary-bg/30",
                      isSelected && "bg-primary-bg/20"
                    )}
                  >
                    {/* Checkbox */}
                    <td className="w-10 px-4 py-3 align-middle">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(quote.id)}
                      />
                    </td>

                    {/* Báo giá */}
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/quotes/${quote.id}`}
                          className="font-semibold text-text-primary hover:text-primary"
                        >
                          {quote.quoteNo}
                        </Link>
                        <Badge variant="neutral" className="text-[10px] px-1.5 py-0 font-mono">
                          v{quote.version}
                        </Badge>
                        <StatusBadge status={quote.status} />
                        {quote.isExpiringSoon ? (
                          <Badge variant="warning" className="text-[10px] px-1.5 py-0">Sắp hết hạn</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {quote.itemCount} hạng mục
                        <span className="ml-1.5 text-text-secondary">· {quote.createdBy.name}</span>
                      </p>
                    </td>

                    {/* Dự án / KH */}
                    <td className="w-52 px-3 py-3 align-middle">
                      <Link
                        href={`/projects/${quote.project.id}`}
                        className="block truncate text-sm font-medium text-text-primary hover:text-primary"
                      >
                        {quote.project.name}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                        <span className="text-xs text-text-muted font-mono shrink-0">{quote.project.code}</span>
                        <span className="text-text-muted">·</span>
                        <Link
                          href={`/customers/${quote.customer.id}`}
                          className="truncate text-xs text-text-secondary hover:text-primary"
                        >
                          {quote.customer.name}
                        </Link>
                      </div>
                    </td>

                    {/* Giá trị */}
                    <td className="w-36 px-3 py-3 align-middle">
                      <p className="text-base font-bold tabular-nums text-text-primary">
                        <CurrencyDisplay amount={quote.total} short />
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted tabular-nums">
                        <CurrencyDisplay amount={quote.subtotal} short />
                        {" + "}
                        <CurrencyDisplay amount={quote.taxAmount} short />
                        {" VAT"}
                      </p>
                    </td>

                    {/* Timeline */}
                    <td className="w-52 px-3 py-3 align-middle">
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-14 shrink-0 text-text-muted">Hiệu lực</span>
                          <span className={cn(
                            "font-medium",
                            quote.isExpiringSoon ? "text-warning" : "text-text-secondary"
                          )}>
                            {quote.validUntil ? formatDate(quote.validUntil) : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-14 shrink-0 text-text-muted">Gửi KH</span>
                          <span className="text-text-secondary">
                            {quote.sentAt ? formatDate(quote.sentAt) : "Chưa gửi"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-14 shrink-0 text-text-muted">Chốt</span>
                          <span className={cn(
                            "font-medium",
                            quote.acceptedAt ? "text-success" : "text-text-muted"
                          )}>
                            {quote.acceptedAt ? formatDate(quote.acceptedAt) : "—"}
                          </span>
                        </div>
                        <p className="text-text-muted pt-0.5">
                          Tạo {formatRelativeTime(quote.createdAt)}
                        </p>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="w-16 px-2 py-3 align-middle">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/quotes/${quote.id}/preview`}>
                          <button
                            type="button"
                            title="Xem bản in"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-primary"
                          >
                            <AppIcon name="preview" className="text-[16px]" />
                          </button>
                        </Link>
                        <Link href={`/quotes/${quote.id}`}>
                          <button
                            type="button"
                            title="Chi tiết"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-primary"
                          >
                            <AppIcon name="external-link" className="text-[16px]" />
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer pagination */}
        <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
          <p className="text-sm text-text-secondary">
            {meta?.total ?? items.length} báo giá · trang {currentPage}/{totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} variant="outline" size="sm">
              <AppIcon name="chevron-left" className="mr-1 text-base" />
              Trước
            </Button>
            <Button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} variant="outline" size="sm">
              Tiếp
              <AppIcon name="chevron-right" className="ml-1 text-base" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
