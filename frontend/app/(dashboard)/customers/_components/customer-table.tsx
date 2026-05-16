import Link from "next/link";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { AppIcon } from "@/components/shared/app-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getRoleLabelByName } from "@/lib/constants";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { CustomerListItem, CustomerListMeta } from "@/lib/types";

export function CustomerTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange,
  selectedIds,
  allVisibleSelected,
  onToggleSelect,
  onToggleSelectAll,
  hasActiveFilters = false,
  onResetFilters
}: {
  items: CustomerListItem[];
  meta?: CustomerListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
  selectedIds: string[];
  allVisibleSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
}) {
  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách khách hàng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-border/60 p-4 lg:grid-cols-[1.3fr_1fr_220px_90px_180px]">
              <LoadingSkeleton className="h-16 w-full" />
              <LoadingSkeleton className="h-16 w-full" />
              <LoadingSkeleton className="h-16 w-full" />
              <LoadingSkeleton className="h-16 w-full" />
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
          <CardTitle>Danh sách khách hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách khách hàng. Kiểm tra lại backend hoặc quyền truy cập."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    const title = hasActiveFilters ? "Không có khách hàng khớp bộ lọc" : "Chưa có khách hàng";
    const description = hasActiveFilters
      ? "Dữ liệu có thể đang bị bộ lọc hoặc trang hiện tại che mất. Xóa bộ lọc để xem lại toàn bộ danh sách."
      : "Tạo khách hàng mới hoặc import CSV để bắt đầu theo dõi pipeline.";

    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách khách hàng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EmptyState title={title} description={description} />
          {hasActiveFilters && onResetFilters ? (
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={onResetFilters}>
                Xóa bộ lọc và về trang đầu
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const currentPage = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <Card className="overflow-hidden border border-white/70 p-0">
      <CardHeader className="mb-0 gap-2 border-b border-border-light px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="v2-label">Customer Ledger</p>
          <CardTitle className="text-base">Danh sách khách hàng</CardTitle>
          <p className="mt-1 text-xs text-text-secondary">
            {meta?.total ?? items.length} kết quả · Trang {currentPage}/{totalPages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
            Trang trước
          </Button>
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Trang sau
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 bg-white p-4 md:p-0">
        <div className="grid gap-3 lg:hidden">
          {items.map((customer) => (
            <div key={customer.id} className="rounded-2xl border border-border/60 bg-white/80">
              <div className="flex items-center gap-3 p-3">
                <Checkbox checked={selectedIds.includes(customer.id)} onCheckedChange={() => onToggleSelect(customer.id)} />
                <Link href={`/customers/${customer.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <AvatarInitials
                    name={customer.name}
                    className="h-10 w-10 shrink-0 rounded-full bg-primary-bg text-sm text-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">{customer.name}</p>
                      {customer.isVip ? <Badge variant="warning">VIP</Badge> : null}
                    </div>
                    <p className="truncate text-xs text-text-secondary">
                      {customer.primaryContact?.phone ??
                        customer.primaryContact?.email ??
                        customer.taxCode ??
                        customer.industry ??
                        "Chưa có liên hệ"}
                    </p>
                  </div>
                  <StatusBadge status={customer.status} />
                  <AppIcon name="arrow-right" className="h-4 w-4 shrink-0 text-text-muted" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="v2-table-head">
                <th className="w-10 px-4 py-2.5">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={onToggleSelectAll} />
                </th>
                <th className="px-4 py-2.5">Khách hàng</th>
                <th className="px-4 py-2.5">Liên hệ chính</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5">Dự án</th>
                <th className="px-4 py-2.5">Phụ trách</th>
                <th className="px-4 py-2.5">Cập nhật</th>
                <th className="w-12 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((customer) => (
                <tr key={customer.id} className="border-b border-border-light transition hover:bg-primary-bg/30">
                  <td className="px-4 py-3 align-middle">
                    <Checkbox checked={selectedIds.includes(customer.id)} onCheckedChange={() => onToggleSelect(customer.id)} />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <AvatarInitials name={customer.name} className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary-mid text-xs text-white" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="truncate font-heading text-[13.5px] font-semibold text-text-primary hover:text-primary"
                          >
                            {customer.name}
                          </Link>
                          {customer.isVip ? <Badge variant="warning">VIP</Badge> : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-text-muted">{customer.industry ?? customer.taxCode ?? "Chưa gắn ngành"}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <div className="space-y-1 text-sm">
                      <p className="text-[13px] font-medium text-text-primary">
                        {customer.primaryContact?.name ?? "Chưa gắn liên hệ chính"}
                      </p>
                      <p className="text-xs text-text-muted">{customer.primaryContact?.phone ?? customer.primaryContact?.email ?? "Chưa có liên hệ"}</p>
                    </div>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <StatusBadge status={customer.status} />
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <p className="text-[13px] font-semibold text-text-primary">{customer.projectCount} dự án</p>
                    <p className="text-xs text-text-muted">Đang gắn</p>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <AvatarInitials name={customer.assignedTo.name} className="h-7 w-7 rounded-full bg-primary-bg text-[10px] text-primary" />
                      <div className="text-xs">
                        <p className="font-semibold text-text-primary">{customer.assignedTo.name}</p>
                        <p className="text-text-muted">{getRoleLabelByName(customer.assignedTo.role)}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <div className="space-y-0.5 text-xs text-text-muted">
                      <p>{formatDate(customer.updatedAt)}</p>
                      <p>{formatRelativeTime(customer.updatedAt)}</p>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center align-middle">
                    <Link href={`/customers/${customer.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg-hover hover:text-primary">
                      <AppIcon name="arrow-right" className="h-4 w-4" />
                    </Link>
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
