"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { usePermission } from "@/components/shared/permission-gate";
import { Button } from "@/components/ui/button";
import { useProjectMaterialAllocations } from "@/hooks/use-project-costs";
import { useStockIssues } from "@/hooks/use-stock-issues";
import { getApiErrorMessage } from "@/lib/api-client";
import { STOCK_DOC_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatVND } from "@/lib/format";
import type { ProjectMaterialAllocation } from "@/lib/types";
import { AllocationBatchCard } from "./project-finance/allocation-batch-card";
import { AllocationBatchEditor } from "./project-finance/allocation-batch-editor";

type EditorState = { mode: "new" } | { mode: "edit"; allocation: ProjectMaterialAllocation } | null;

export function ProjectMaterialsTab({ projectId }: { projectId: string }) {
  const allocationsQuery = useProjectMaterialAllocations(projectId);
  const issues = useStockIssues({ projectId, status: "CONFIRMED", limit: 50, page: 1 });
  const canEdit = usePermission("projects.edit");
  const [editor, setEditor] = useState<EditorState>(null);

  const allocations = allocationsQuery.data ?? [];
  const issueItems = issues.data?.items ?? [];
  const totalIssuedValue = issueItems.reduce((sum, issue) => sum + issue.totalAmount, 0);
  const confirmedTotal = allocations
    .filter((allocation) => allocation.status === "CONFIRMED")
    .reduce((sum, allocation) => sum + allocation.totalAmount, 0);

  if (allocationsQuery.isLoading || issues.isLoading) {
    return <div className="p-4 text-sm text-text-secondary">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Đợt phân bổ giá vốn</p>
          <p className="mt-1 text-sm text-text-secondary">
            Mỗi đợt ứng với một hóa đơn bán ra. Giá vốn đã xác nhận:{" "}
            <span className="font-semibold text-primary">{formatVND(confirmedTotal)}</span>
          </p>
        </div>
        {canEdit && editor === null ? (
          <Button type="button" onClick={() => setEditor({ mode: "new" })}>
            Tạo đợt phân bổ
          </Button>
        ) : null}
      </div>

      {allocationsQuery.isError || issues.isError ? (
        <p role="alert" className="text-sm text-danger">
          {getApiErrorMessage(allocationsQuery.error ?? issues.error, "Không thể tải vật tư dự án. Vui lòng thử lại.")}
        </p>
      ) : null}

      {editor ? (
        <AllocationBatchEditor
          key={editor.mode === "edit" ? editor.allocation.id : "new"}
          projectId={projectId}
          allocation={editor.mode === "edit" ? editor.allocation : undefined}
          onClose={() => setEditor(null)}
        />
      ) : null}

      {allocations.length === 0 ? (
        <div className="rounded-lg bg-bg-subtle px-4 py-6 text-center text-sm text-text-secondary">
          Chưa có đợt phân bổ vật tư nào cho dự án này.
        </div>
      ) : (
        <div className="space-y-4">
          {allocations.map((allocation) => (
            <AllocationBatchCard
              key={allocation.id}
              projectId={projectId}
              allocation={allocation}
              canEdit={canEdit}
              onEdit={(target) => setEditor({ mode: "edit", allocation: target })}
            />
          ))}
        </div>
      )}

      {totalIssuedValue > 0 && (
        <div className="rounded-lg bg-bg-subtle px-4 py-3 text-sm">
          Tổng giá trị vật tư đã xuất:{" "}
          <span className="font-semibold text-primary">{formatVND(totalIssuedValue)}</span>
        </div>
      )}

      {issueItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-secondary">
          Chưa có phiếu xuất kho nào cho dự án này
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-text-secondary">
            <tr>
              <th className="pb-2 pr-4">Số phiếu</th>
              <th className="pb-2 pr-4">Ngày</th>
              <th className="pb-2 pr-4">Kho</th>
              <th className="pb-2 pr-4">Trạng thái</th>
              <th className="pb-2 text-right">Giá trị</th>
            </tr>
          </thead>
          <tbody>
            {issueItems.map((issue) => (
              <tr key={issue.id} className="odd:bg-bg-subtle">
                <td className="py-2 pr-4">
                  <Link href={`/inventory/issues/${issue.id}` as Route} className="text-primary hover:underline">
                    {issue.issueNo}
                  </Link>
                </td>
                <td className="py-2 pr-4">{formatDate(issue.date)}</td>
                <td className="py-2 pr-4">{issue.warehouse.name}</td>
                <td className="py-2 pr-4">{STOCK_DOC_STATUS_LABELS[issue.status]}</td>
                <td className="py-2 text-right">{formatVND(issue.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pt-2">
        <Link href={`/inventory/issues/new?projectId=${projectId}` as Route} className="text-sm text-primary hover:underline">
          + Tạo phiếu xuất kho thủ công cho dự án này
        </Link>
      </div>
    </div>
  );
}
