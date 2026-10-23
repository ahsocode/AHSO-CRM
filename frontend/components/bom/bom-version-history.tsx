"use client";

import type { Route } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBomModelVersions } from "@/hooks/use-boms";
import { formatDate, formatVND } from "@/lib/format";
import { BomStatusBadge } from "./bom-status-badge";

export function BomVersionHistory({ productId, currentBomId }: { productId: string; currentBomId: string }) {
  const versionsQuery = useBomModelVersions(productId);
  const versions = versionsQuery.data ?? [];

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <CardTitle>Lịch sử phiên bản</CardTitle>
      </CardHeader>
      <CardContent>
        {versionsQuery.isLoading ? (
          <p className="text-sm text-text-secondary">Đang tải...</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-text-secondary">Chưa có phiên bản nào.</p>
        ) : (
          <div className="space-y-2">
            {versions.map((version) => (
              <Link
                key={version.id}
                href={`/inventory/models/${version.id}` as Route}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-bg-subtle px-4 py-3 text-sm hover:bg-primary-bg"
              >
                <span className="font-semibold text-text-primary">v{version.version}</span>
                <span className="font-mono text-xs text-text-muted">{version.code}</span>
                <BomStatusBadge status={version.status} />
                {version.id === currentBomId ? <span className="text-xs font-semibold text-primary">Đang xem</span> : null}
                <span className="ml-auto tabular-nums text-text-secondary">{formatVND(version.total)}</span>
                <span className="text-xs text-text-muted">
                  {version.approvedAt ? `Duyệt ${formatDate(version.approvedAt)}` : `Tạo ${formatDate(version.createdAt)}`}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
