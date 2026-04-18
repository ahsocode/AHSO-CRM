import Link from "next/link";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { QuoteListItem, QuoteListMeta } from "@/lib/types";

export function QuoteTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange
}: {
  items: QuoteListItem[];
  meta?: QuoteListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
}) {
  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách báo giá</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-border/60 p-4 lg:grid-cols-[1.05fr_1fr_220px_220px]">
              <LoadingSkeleton className="h-24 w-full" />
              <LoadingSkeleton className="h-24 w-full" />
              <LoadingSkeleton className="h-24 w-full" />
              <LoadingSkeleton className="h-24 w-full" />
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
          <CardTitle>Danh sách báo giá</CardTitle>
        </CardHeader>
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
        <CardHeader>
          <CardTitle>Danh sách báo giá</CardTitle>
        </CardHeader>
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
      <CardHeader className="mb-0 gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Quote Ledger</p>
          <CardTitle>Danh sách báo giá</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            {meta?.total ?? items.length} báo giá, trang {currentPage}/{totalPages}
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
        <div className="grid gap-4 md:hidden">
          {items.map((quote) => (
            <article key={quote.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/quotes/${quote.id}`} className="font-heading text-lg font-bold text-text-primary hover:text-primary">
                  {quote.quoteNo}
                </Link>
                <Badge variant="neutral">v{quote.version}</Badge>
                <StatusBadge status={quote.status} />
                {quote.isExpiringSoon ? <Badge variant="warning">Sắp hết hạn</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-text-secondary">
                {quote.project.name} · {quote.customer.name}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-heading text-2xl font-extrabold text-text-primary">
                  <CurrencyDisplay amount={quote.total} short />
                </span>
                <span className="text-sm text-text-secondary">{quote.itemCount} hạng mục</span>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                <th className="px-4">Báo giá</th>
                <th className="px-4">Dự án & khách hàng</th>
                <th className="px-4">Giá trị</th>
                <th className="px-4">Timeline</th>
              </tr>
            </thead>
            <tbody>
              {items.map((quote) => (
                <tr key={quote.id} className="bg-white/80 shadow-sm">
                  <td className="rounded-l-2xl px-4 py-4 align-top">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/quotes/${quote.id}`} className="font-heading text-lg font-bold text-text-primary hover:text-primary">
                          {quote.quoteNo}
                        </Link>
                        <Badge variant="neutral">v{quote.version}</Badge>
                        <StatusBadge status={quote.status} />
                        {quote.isExpiringSoon ? <Badge variant="warning">Sắp hết hạn</Badge> : null}
                      </div>
                      <div className="space-y-1 text-sm text-text-secondary">
                        <p>{quote.itemCount} hạng mục báo giá</p>
                        <p>Tạo bởi {quote.createdBy.name}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex items-start gap-3">
                      <AvatarInitials name={quote.customer.assignedTo.name} className="h-10 w-10 rounded-full text-xs" />
                      <div className="space-y-1 text-sm">
                        <Link href={`/projects/${quote.project.id}`} className="font-semibold text-text-primary hover:text-primary">
                          {quote.project.name}
                        </Link>
                        <p className="text-text-secondary">{quote.project.code}</p>
                        <Link href={`/customers/${quote.customer.id}`} className="text-text-secondary hover:text-primary">
                          {quote.customer.name}
                        </Link>
                        <p className="text-text-secondary">Owner: {quote.customer.assignedTo.name}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="space-y-2 text-sm">
                      <p className="font-heading text-2xl font-extrabold text-text-primary">
                        <CurrencyDisplay amount={quote.total} short />
                      </p>
                      <p className="text-text-secondary">
                        Tạm tính <CurrencyDisplay amount={quote.subtotal} short /> · VAT{" "}
                        <CurrencyDisplay amount={quote.taxAmount} short />
                      </p>
                    </div>
                  </td>

                  <td className="rounded-r-2xl px-4 py-4 align-top">
                    <div className="space-y-2 text-sm text-text-secondary">
                      <p>Tạo {formatRelativeTime(quote.createdAt)}</p>
                      <p>
                        Hiệu lực: {quote.validUntil ? formatDate(quote.validUntil) : "Chưa đặt ngày"}
                      </p>
                      <p>{quote.sentAt ? `Gửi ${formatDate(quote.sentAt)}` : "Chưa gửi khách"}</p>
                      <p>{quote.acceptedAt ? `Chấp nhận ${formatDate(quote.acceptedAt)}` : "Chưa chốt"}</p>
                      <Link href={`/quotes/${quote.id}/preview`} className="inline-flex font-semibold text-primary hover:underline">
                        Xem bản in
                      </Link>
                    </div>
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
