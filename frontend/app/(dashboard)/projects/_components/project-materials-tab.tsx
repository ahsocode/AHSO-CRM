"use client";

import type { Route } from "next";
import Link from "next/link";
import { useStockIssues } from "@/hooks/use-stock-issues";
import { formatVND } from "@/lib/format";
import { STOCK_DOC_STATUS_LABELS } from "@/lib/constants";

export function ProjectMaterialsTab({ projectId }: { projectId: string }) {
  const issues = useStockIssues({ projectId, status: "CONFIRMED", limit: 50, page: 1 });

  if (issues.isLoading) {
    return <div className="p-4 text-sm text-text-secondary">Đang tải...</div>;
  }

  const items = issues.data?.items ?? [];
  const totalValue = items.reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="space-y-4">
      {totalValue > 0 && (
        <div className="rounded-lg bg-bg-subtle px-4 py-3 text-sm">
          Tổng giá trị vật tư đã cấp:{" "}
          <span className="font-semibold text-primary">{formatVND(totalValue)}</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-secondary">
          Chưa có phiếu xuất kho nào cho dự án này
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-text-secondary">
            <tr>
              <th className="pb-2 pr-4">Số phiếu</th>
              <th className="pb-2 pr-4">Ngày</th>
              <th className="pb-2 pr-4">Kho</th>
              <th className="pb-2 pr-4">Trạng thái</th>
              <th className="pb-2 text-right">Giá trị</th>
            </tr>
          </thead>
          <tbody>
            {items.map((issue) => (
              <tr key={issue.id} className="border-b border-border/30">
                <td className="py-2 pr-4">
                  <Link
                    href={`/inventory/issues/${issue.id}` as Route}
                    className="text-primary hover:underline"
                  >
                    {issue.issueNo}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  {new Date(issue.date).toLocaleDateString("vi-VN")}
                </td>
                <td className="py-2 pr-4">{issue.warehouse.name}</td>
                <td className="py-2 pr-4">{STOCK_DOC_STATUS_LABELS[issue.status]}</td>
                <td className="py-2 text-right">{formatVND(issue.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pt-2">
        <Link
          href={`/inventory/issues/new?projectId=${projectId}` as Route}
          className="text-sm text-primary hover:underline"
        >
          + Tạo phiếu xuất kho mới cho dự án này
        </Link>
      </div>
    </div>
  );
}
