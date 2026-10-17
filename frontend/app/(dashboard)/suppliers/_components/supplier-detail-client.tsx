"use client";

import { isAxiosError } from "axios";
import type { Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupplier } from "@/hooks/use-suppliers";
import { getApiErrorMessage } from "@/lib/api-client";
import { STOCK_DOC_STATUS_COLORS, STOCK_DOC_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatVND, formatVNDShort } from "@/lib/format";
import type { SupplierDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_LISTED_MATERIALS = 50;

export function SupplierDetailClient({ supplierId }: { supplierId: string }) {
  const supplierQuery = useSupplier(supplierId);
  const { data: supplier, isLoading, isError, error, refetch, isFetching } = supplierQuery;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton className="h-20 w-full rounded-lg" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <LoadingSkeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !supplier) {
    const isNotFound = isAxiosError(error) && error.response?.status === 404;
    return (
      <EmptyState
        title={isNotFound ? "Không tìm thấy nhà cung cấp" : "Không thể tải thông tin nhà cung cấp"}
        description={
          isNotFound
            ? "Nhà cung cấp có thể đã bị xóa hoặc đường dẫn không đúng."
            : getApiErrorMessage(error, "Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.")
        }
        action={
          <div className="flex gap-2">
            <Link href={"/suppliers" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
            {!isNotFound ? (
              <Button type="button" variant="primary" disabled={isFetching} onClick={() => void refetch()}>
                {isFetching ? "Đang tải..." : "Thử lại"}
              </Button>
            ) : null}
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.name}
        description={`Mã NCC: ${supplier.code}`}
        action={
          <div className="flex items-center gap-2">
            <Link href={"/suppliers" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
              ← Danh sách
            </Link>
            <Link
              href={`/inventory/receipts/new?supplierId=${supplierId}` as Route}
              className={cn(buttonVariants({ variant: "outline" }), "hidden md:inline-flex")}
            >
              Tạo phiếu nhập
            </Link>
            <Link
              href={`/suppliers/${supplierId}/edit` as Route}
              className={cn(buttonVariants({ variant: "primary" }))}
            >
              Chỉnh sửa
            </Link>
          </div>
        }
      />

      <SupplierStats supplier={supplier} />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <SupplierInfoCard supplier={supplier} />
        <div className="space-y-6">
          <SupplierMaterialsCard supplier={supplier} />
          <SupplierReceiptsCard supplier={supplier} />
        </div>
      </div>
    </div>
  );
}

function SupplierStats({ supplier }: { supplier: SupplierDetail }) {
  const stats = [
    {
      label: "Vật tư cung cấp",
      value: `${supplier._count.materialSuppliers}`,
      hint: `${supplier.materials.filter((item) => item.isPreferred).length} vật tư ưu tiên`,
    },
    {
      label: "Tổng giá trị nhập",
      value: formatVNDShort(supplier.stats.confirmedPurchaseTotal),
      hint: "Phiếu nhập đã xác nhận",
    },
    {
      label: "Phiếu nhập",
      value: `${supplier._count.receipts}`,
      hint: supplier.stats.lastReceiptDate
        ? `Lần nhập gần nhất ${formatDate(supplier.stats.lastReceiptDate)}`
        : "Chưa có lần nhập nào",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <article key={stat.label} className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{stat.label}</p>
          <p className="mt-2 font-heading text-[26px] font-extrabold leading-none tabular-nums text-text-primary">
            {stat.value}
          </p>
          <p className="mt-2 text-sm text-text-secondary">{stat.hint}</p>
        </article>
      ))}
    </div>
  );
}

function SupplierInfoCard({ supplier }: { supplier: SupplierDetail }) {
  const fields: Array<{ label: string; value: string | null | undefined; href?: string }> = [
    { label: "Mã số thuế", value: supplier.taxCode },
    { label: "Người liên hệ", value: supplier.contactName },
    { label: "Số điện thoại", value: supplier.phone, href: supplier.phone ? `tel:${supplier.phone}` : undefined },
    { label: "Email", value: supplier.email, href: supplier.email ? `mailto:${supplier.email}` : undefined },
    { label: "Địa chỉ", value: supplier.address },
    { label: "Ngày tạo", value: formatDate(supplier.createdAt) },
  ];

  return (
    <Card>
      <CardHeader className="mb-0 gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Thông tin liên hệ</p>
            <CardTitle>{supplier.name}</CardTitle>
          </div>
          <Badge variant={supplier.isActive ? "success" : "neutral"}>
            {supplier.isActive ? "Đang hoạt động" : "Ngưng hoạt động"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4">
          {fields.map(({ label, value, href }) => (
            <div key={label} className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-text-secondary">{label}</dt>
              <dd className="text-sm text-text-primary">
                {value ? (
                  href ? (
                    <a href={href} className="text-primary-mid hover:text-primary hover:underline">
                      {value}
                    </a>
                  ) : (
                    value
                  )
                ) : (
                  <span className="text-text-secondary">Chưa cập nhật</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {supplier.notes ? (
          <div className="mt-6 rounded-lg bg-bg-subtle p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-secondary">Ghi chú</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{supplier.notes}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SupplierMaterialsCard({ supplier }: { supplier: SupplierDetail }) {
  const visible = supplier.materials.slice(0, MAX_LISTED_MATERIALS);

  return (
    <Card>
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Danh mục cung ứng</p>
        <CardTitle>Vật tư cung cấp ({supplier._count.materialSuppliers})</CardTitle>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="rounded-lg bg-bg-subtle p-4 text-sm text-text-secondary">
            Chưa gắn vật tư nào. Gắn nhà cung cấp ở trang chi tiết từng vật tư để theo dõi giá nhập và thời gian giao.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.15em] text-text-secondary">
                  <th className="px-3 py-2">Vật tư</th>
                  <th className="px-3 py-2 text-right">Giá nhập</th>
                  <th className="px-3 py-2 text-right">Giao hàng</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className="bg-bg-subtle/70 hover:bg-primary-bg/40">
                    <td className="rounded-l-lg px-3 py-2.5">
                      <Link
                        href={`/materials/${item.materialId}` as Route}
                        className="text-sm font-semibold text-text-primary hover:text-primary"
                      >
                        {item.materialName}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                        <span>{item.materialCode}</span>
                        {item.supplierCode ? <span>· Mã NCC: {item.supplierCode}</span> : null}
                        {item.isPreferred ? <Badge variant="info">Ưu tiên</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-text-primary">
                      {formatVND(item.costPrice)}
                      <span className="block text-xs font-normal text-text-secondary">/ {item.unit}</span>
                    </td>
                    <td className="rounded-r-lg px-3 py-2.5 text-right text-sm text-text-secondary">
                      {item.leadTimeDays !== null ? `${item.leadTimeDays} ngày` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {supplier.materials.length > MAX_LISTED_MATERIALS ? (
              <p className="mt-2 text-xs text-text-secondary">
                Đang hiển thị {MAX_LISTED_MATERIALS}/{supplier.materials.length} vật tư.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SupplierReceiptsCard({ supplier }: { supplier: SupplierDetail }) {
  return (
    <Card>
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Lịch sử nhập hàng</p>
        <CardTitle>Phiếu nhập gần đây</CardTitle>
      </CardHeader>
      <CardContent>
        {supplier.recentReceipts.length === 0 ? (
          <p className="rounded-lg bg-bg-subtle p-4 text-sm text-text-secondary">
            Chưa có phiếu nhập nào từ nhà cung cấp này.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.15em] text-text-secondary">
                  <th className="px-3 py-2">Số phiếu</th>
                  <th className="px-3 py-2">Ngày</th>
                  <th className="px-3 py-2">Kho</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2 text-right">Giá trị</th>
                </tr>
              </thead>
              <tbody>
                {supplier.recentReceipts.map((receipt) => (
                  <tr key={receipt.id} className="bg-bg-subtle/70 hover:bg-primary-bg/40">
                    <td className="rounded-l-lg px-3 py-2.5">
                      <Link
                        href={`/inventory/receipts/${receipt.id}` as Route}
                        className="text-sm font-semibold text-text-primary hover:text-primary"
                      >
                        {receipt.receiptNo}
                      </Link>
                      {receipt.purchaseInvoiceNo ? (
                        <span className="block text-xs text-text-secondary">HĐ mua: {receipt.purchaseInvoiceNo}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-text-secondary">{formatDate(receipt.date)}</td>
                    <td className="px-3 py-2.5 text-sm text-text-secondary">{receipt.warehouse.name}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          STOCK_DOC_STATUS_COLORS[receipt.status]
                        )}
                      >
                        {STOCK_DOC_STATUS_LABELS[receipt.status]}
                      </span>
                    </td>
                    <td className="rounded-r-lg px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-text-primary">
                      {formatVND(receipt.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {supplier._count.receipts > supplier.recentReceipts.length ? (
              <p className="mt-2 text-xs text-text-secondary">
                Đang hiển thị {supplier.recentReceipts.length}/{supplier._count.receipts} phiếu gần nhất.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
