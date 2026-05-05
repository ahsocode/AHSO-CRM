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
  onToggleSelectAll
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
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách khách hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Không có khách hàng phù hợp"
            description="Hãy nới bộ lọc hiện tại hoặc tạo thêm dữ liệu seed để kiểm tra các luồng pipeline tiếp theo."
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Customer Ledger</p>
          <CardTitle>Danh sách khách hàng</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            {meta?.total ?? items.length} khách hàng, trang {currentPage}/{totalPages}
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

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:hidden">
          {items.map((customer) => (
            <article key={customer.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-3">
                    <Checkbox checked={selectedIds.includes(customer.id)} onCheckedChange={() => onToggleSelect(customer.id)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="font-heading text-lg font-bold text-text-primary hover:text-primary"
                    >
                      {customer.name}
                    </Link>
                    <StatusBadge status={customer.status} />
                    {customer.isVip ? <Badge variant="warning">VIP</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {customer.industry ?? "Chưa gắn ngành"} · {customer.taxCode ?? "Chưa có MST"}
                  </p>
                </div>
                <Link href={`/customers/${customer.id}`} className="text-primary">
                  <AppIcon name="arrow-right" className="h-5 w-5" />
                </Link>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-text-secondary">
                <div className="flex items-start gap-3">
                  <AvatarInitials name={customer.assignedTo.name} className="h-10 w-10 rounded-full text-xs" />
                  <div>
                    <p className="font-semibold text-text-primary">{customer.assignedTo.name}</p>
                    <p>{getRoleLabelByName(customer.assignedTo.role)}</p>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-text-primary">Liên hệ chính</p>
                  <p>{customer.primaryContact?.name ?? "Chưa gắn liên hệ chính"}</p>
                  {customer.primaryContact?.phone ? <p>{customer.primaryContact.phone}</p> : null}
                </div>
                <div className="flex items-center justify-between">
                  <span>{customer.projectCount} dự án</span>
                  <span>{formatRelativeTime(customer.updatedAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                <th className="px-4">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={onToggleSelectAll} />
                </th>
                <th className="px-4">Khách hàng</th>
                <th className="px-4">Liên hệ chính</th>
                <th className="px-4">Phụ trách</th>
                <th className="px-4">Dự án</th>
                <th className="px-4">Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {items.map((customer) => (
                <tr key={customer.id} className="rounded-2xl bg-white/80 shadow-sm">
                  <td className="px-4 py-4 align-top">
                    <Checkbox checked={selectedIds.includes(customer.id)} onCheckedChange={() => onToggleSelect(customer.id)} />
                  </td>
                  <td className="rounded-l-2xl px-4 py-4 align-top">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="font-heading text-lg font-bold text-text-primary hover:text-primary"
                        >
                          {customer.name}
                        </Link>
                        <StatusBadge status={customer.status} />
                        {customer.isVip ? <Badge variant="warning">VIP</Badge> : null}
                      </div>
                      <div className="space-y-1 text-sm text-text-secondary">
                        <p>{customer.industry ?? "Chưa gắn ngành"}</p>
                        <p>{customer.address ?? customer.taxCode ?? "Chưa bổ sung địa chỉ"}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-text-primary">
                        {customer.primaryContact?.name ?? "Chưa gắn liên hệ chính"}
                      </p>
                      <p className="text-text-secondary">{customer.primaryContact?.title ?? "Đầu mối làm việc"}</p>
                      {customer.primaryContact?.phone ? (
                        <p className="text-text-secondary">{customer.primaryContact.phone}</p>
                      ) : null}
                      {customer.primaryContact?.email ? (
                        <p className="text-text-secondary">{customer.primaryContact.email}</p>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex items-start gap-3">
                      <AvatarInitials name={customer.assignedTo.name} className="h-10 w-10 rounded-full text-xs" />
                      <div className="text-sm">
                        <p className="font-semibold text-text-primary">{customer.assignedTo.name}</p>
                        <p className="text-text-secondary">{getRoleLabelByName(customer.assignedTo.role)}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <p className="font-heading text-2xl font-extrabold text-text-primary">{customer.projectCount}</p>
                    <p className="text-sm text-text-secondary">Dự án đang gắn</p>
                  </td>

                  <td className="rounded-r-2xl px-4 py-4 align-top">
                    <div className="space-y-1 text-sm text-text-secondary">
                      <p>{formatDate(customer.updatedAt)}</p>
                      <p>{formatRelativeTime(customer.updatedAt)}</p>
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
