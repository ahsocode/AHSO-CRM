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
import { ContractListItem, ContractListMeta } from "@/lib/types";

export function ContractTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange
}: {
  items: ContractListItem[];
  meta?: ContractListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
}) {
  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách hợp đồng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
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
          <CardTitle>Danh sách hợp đồng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách hợp đồng."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách hợp đồng</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Chưa có hợp đồng phù hợp"
            description="Điều chỉnh bộ lọc hoặc tiếp tục chốt quote để mở thêm hợp đồng ở phase tiếp theo."
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Contract Ledger</p>
          <CardTitle>Danh sách hợp đồng</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            {meta?.total ?? items.length} hợp đồng, trang {currentPage}/{totalPages}
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
          {items.map((contract) => (
            <article key={contract.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/contracts/${contract.id}`} className="font-heading text-lg font-bold text-text-primary hover:text-primary">
                  {contract.contractNo}
                </Link>
                <StatusBadge kind="contract" status={contract.status} />
                {contract.isOverdue ? <Badge variant="danger">Quá hạn</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-text-secondary">
                {contract.project.name} · {contract.customer.name}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-heading text-2xl font-extrabold text-text-primary">
                  <CurrencyDisplay amount={contract.value} short />
                </span>
                <span className="text-sm text-text-secondary">{contract.milestoneCount} milestone</span>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                <th className="px-4">Hợp đồng</th>
                <th className="px-4">Dự án & khách hàng</th>
                <th className="px-4">Giá trị & công nợ</th>
                <th className="px-4">Timeline</th>
              </tr>
            </thead>
            <tbody>
              {items.map((contract) => (
                <tr key={contract.id} className="bg-white/80 shadow-sm">
                  <td className="rounded-l-2xl px-4 py-4 align-top">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/contracts/${contract.id}`} className="font-heading text-lg font-bold text-text-primary hover:text-primary">
                          {contract.contractNo}
                        </Link>
                        <StatusBadge kind="contract" status={contract.status} />
                        {contract.isOverdue ? <Badge variant="danger">Quá hạn</Badge> : null}
                      </div>
                      <div className="space-y-1 text-sm text-text-secondary">
                        <p>{contract.paymentCount} thanh toán · {contract.milestoneCount} milestone</p>
                        <p>Ký ngày {contract.signDate ? formatDate(contract.signDate) : "chưa cập nhật"}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex items-start gap-3">
                      <AvatarInitials name={contract.customer.assignedTo.name} className="h-10 w-10 rounded-full text-xs" />
                      <div className="space-y-1 text-sm">
                        <Link href={`/projects/${contract.project.id}`} className="font-semibold text-text-primary hover:text-primary">
                          {contract.project.name}
                        </Link>
                        <p className="text-text-secondary">{contract.project.code}</p>
                        <Link href={`/customers/${contract.customer.id}`} className="text-text-secondary hover:text-primary">
                          {contract.customer.name}
                        </Link>
                        <p className="text-text-secondary">Owner: {contract.customer.assignedTo.name}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="space-y-2 text-sm">
                      <p className="font-heading text-2xl font-extrabold text-text-primary">
                        <CurrencyDisplay amount={contract.value} short />
                      </p>
                      <p className="text-text-secondary">
                        Đã thu <CurrencyDisplay amount={contract.paidAmount} short />
                      </p>
                      <p className="text-text-secondary">
                        Còn lại <CurrencyDisplay amount={contract.outstandingAmount} short />
                      </p>
                    </div>
                  </td>

                  <td className="rounded-r-2xl px-4 py-4 align-top">
                    <div className="space-y-2 text-sm text-text-secondary">
                      <p>Bắt đầu {contract.startDate ? formatDate(contract.startDate) : "chưa cập nhật"}</p>
                      <p>Kết thúc {contract.endDate ? formatDate(contract.endDate) : "chưa cập nhật"}</p>
                      <p>Cập nhật {formatRelativeTime(contract.updatedAt)}</p>
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
