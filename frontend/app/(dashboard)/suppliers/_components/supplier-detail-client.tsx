"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { useSupplier } from "@/hooks/use-suppliers";
import { formatDate } from "@/lib/format";

export function SupplierDetailClient({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const { data: supplier, isLoading, isError } = useSupplier(supplierId);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-20 w-full rounded-2xl" />
        <LoadingSkeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <div className="rounded-2xl bg-danger-bg/70 p-6 text-sm text-danger">
        Không thể tải thông tin nhà cung cấp.
      </div>
    );
  }

  const fields: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Mã NCC", value: supplier.code },
    { label: "Tên nhà cung cấp", value: supplier.name },
    { label: "Mã số thuế", value: supplier.taxCode },
    { label: "Địa chỉ", value: supplier.address },
    { label: "Số điện thoại", value: supplier.phone },
    { label: "Email", value: supplier.email },
    { label: "Người liên hệ", value: supplier.contactName },
    { label: "Ngày tạo", value: formatDate(supplier.createdAt) },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={supplier.name}
        description={`Mã NCC: ${supplier.code}`}
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/suppliers" as Route)}
            >
              ← Quay lại
            </Button>
            <Link href={`/suppliers/${supplierId}/edit` as Route}>
              <Button variant="primary">Chỉnh sửa</Button>
            </Link>
          </div>
        }
      />

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                Thông tin nhà cung cấp
              </p>
              <CardTitle>{supplier.name}</CardTitle>
            </div>
            <Badge variant={supplier.isActive ? "success" : "neutral"}>
              {supplier.isActive ? "Đang hoạt động" : "Ngưng hoạt động"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                  {label}
                </dt>
                <dd className="text-sm text-text-primary">{value || "—"}</dd>
              </div>
            ))}
          </dl>

          {supplier.notes ? (
            <div className="mt-6 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                Ghi chú
              </p>
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{supplier.notes}</p>
            </div>
          ) : null}

          {supplier._count.materialSuppliers > 0 ? (
            <div className="mt-6 rounded-xl bg-bg-subtle p-4">
              <p className="text-sm text-text-secondary">
                Nhà cung cấp này liên kết với{" "}
                <span className="font-semibold text-text-primary">
                  {supplier._count.materialSuppliers}
                </span>{" "}
                vật tư.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
