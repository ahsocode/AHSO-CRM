"use client";

import type { Route } from "next";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { BomStatusBadge } from "@/components/bom/bom-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBomModels } from "@/hooks/use-boms";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatVND } from "@/lib/format";

export function ModelsClient() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const modelsQuery = useBomModels({ search: deferredSearch || undefined, latestOnly: true, limit: 100 });
  const models = modelsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Kho"
        title="Mẫu máy"
        description="Các thành phẩm đã có BOM mẫu. Mở một mẫu để xem, sửa bản nháp hoặc tạo phiên bản mới."
      />

      <Card className="border border-white/70">
        <CardContent className="space-y-4 p-5">
          <Input
            aria-label="Tìm mẫu máy"
            placeholder="Tìm mã BOM, tên mẫu hoặc thành phẩm..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-md"
          />

          {modelsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <LoadingSkeleton key={index} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : modelsQuery.isError ? (
            <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
              {getApiErrorMessage(modelsQuery.error, "Không thể tải danh sách mẫu máy.")}
            </div>
          ) : models.length === 0 ? (
            <EmptyState
              title="Chưa có mẫu máy"
              description="Mở BOM của một dự án và chọn “Lưu thành mẫu máy” để tạo mẫu đầu tiên."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    <th className="px-4 py-2">Thành phẩm</th>
                    <th className="px-4 py-2">Mã BOM</th>
                    <th className="px-4 py-2">Phiên bản mới nhất</th>
                    <th className="px-4 py-2">Trạng thái</th>
                    <th className="px-4 py-2 text-right">Số dòng</th>
                    <th className="px-4 py-2 text-right">Giá vốn dự kiến</th>
                    <th className="px-4 py-2">Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr key={model.id} className="bg-bg-subtle" data-testid="model-row">
                      <td className="rounded-l-xl px-4 py-3">
                        <Link
                          href={`/inventory/models/${model.id}` as Route}
                          className="font-semibold text-text-primary hover:text-primary"
                        >
                          {model.product?.name ?? model.name}
                        </Link>
                        {model.product ? <p className="text-xs text-text-muted">{model.product.code}</p> : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-text-secondary">{model.code}</td>
                      <td className="px-4 py-3 text-sm text-text-primary">v{model.version}</td>
                      <td className="px-4 py-3">
                        <BomStatusBadge status={model.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-text-secondary">{model.lineCount}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-text-primary">
                        {formatVND(model.total)}
                      </td>
                      <td className="rounded-r-xl px-4 py-3 text-sm text-text-secondary">{formatDate(model.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
