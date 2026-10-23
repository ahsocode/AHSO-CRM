"use client";

import { Fragment, useState } from "react";
import { COST_GROUP_LABELS, COST_GROUP_ORDER } from "@/lib/constants";
import { formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectCostSummary } from "@/types/bom";

const REVENUE_SOURCE_LABELS = {
  CONTRACT: "Theo hợp đồng",
  QUOTE: "Theo báo giá đã chấp nhận",
  NONE: "Chưa có hợp đồng / báo giá"
} as const;

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

function SummaryCard({
  label,
  value,
  hint,
  testId,
  tone
}: {
  label: string;
  value: string;
  hint?: string;
  testId: string;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-xl bg-bg-subtle p-4" data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">{label}</p>
      <p
        className={cn(
          "mt-2 font-heading text-xl font-bold text-text-primary",
          tone === "danger" && "text-danger",
          tone === "success" && "text-success"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-text-secondary">{hint}</p> : null}
    </div>
  );
}

function varianceClass(variance: number): string {
  return variance > 0 ? "font-semibold text-danger" : "text-text-primary";
}

export function CostSummaryView({ summary }: { summary: ProjectCostSummary }) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const profitTone = summary.grossProfit < 0 ? "danger" : "success";

  const groupRows = COST_GROUP_ORDER.map((group) => summary.byGroup.find((row) => row.group === group)).filter(
    (row): row is NonNullable<typeof row> => Boolean(row) && (row?.estimated !== 0 || row?.actual !== 0)
  );
  const totalEstimated = groupRows.reduce((sum, row) => sum + row.estimated, 0);
  const totalActual = groupRows.reduce((sum, row) => sum + row.actual, 0);

  function toggleGroup(group: string) {
    setExpandedGroups((current) =>
      current.includes(group) ? current.filter((item) => item !== group) : [...current, group]
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          testId="summary-revenue"
          label="Doanh thu"
          value={formatVND(summary.revenue)}
          hint={`${REVENUE_SOURCE_LABELS[summary.revenueSource]}${summary.revenueRef ? ` ${summary.revenueRef.no}` : ""} · trước VAT`}
        />
        <SummaryCard testId="summary-material-cost" label="Giá vốn vật tư" value={formatVND(summary.materialCost)} />
        <SummaryCard testId="summary-direct-cost" label="Chi phí trực tiếp" value={formatVND(summary.directCost)} />
        <SummaryCard
          testId="summary-gross-profit"
          label="Lãi gộp"
          value={formatVND(summary.grossProfit)}
          tone={profitTone}
        />
        <SummaryCard
          testId="summary-gross-margin"
          label="Tỷ suất lãi gộp"
          value={formatPercent(summary.grossMarginPct)}
          tone={profitTone}
          hint={
            summary.estimateBasis === "NONE"
              ? "Chưa có BOM để so sánh dự toán"
              : `Dự toán: ${formatPercent(summary.estimatedMarginPct)}`
          }
        />
      </div>

      <div className="space-y-3">
        <h3 className="font-heading text-base font-bold text-text-primary">Dự toán – thực tế</h3>
        {groupRows.length === 0 ? (
          <div className="rounded-lg bg-bg-subtle px-4 py-6 text-center text-sm text-text-secondary">
            Chưa có số liệu dự toán hoặc thực tế theo nhóm.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="variance-table">
              <thead className="text-left text-text-secondary">
                <tr>
                  <th className="pb-2 pr-4">Nhóm</th>
                  <th className="pb-2 pr-4 text-right">Dự toán</th>
                  <th className="pb-2 pr-4 text-right">Thực tế</th>
                  <th className="pb-2 text-right">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {groupRows.map((row) => {
                  const lines = summary.byLine.filter((line) => line.group === row.group);
                  const isOpen = expandedGroups.includes(row.group);
                  return (
                    <Fragment key={row.group}>
                      <tr className="odd:bg-bg-subtle" data-testid={`variance-group-${row.group}`}>
                        <td className="py-2 pr-4 font-semibold text-text-primary">
                          {lines.length > 0 ? (
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              className="text-left hover:text-primary"
                              onClick={() => toggleGroup(row.group)}
                            >
                              {isOpen ? "▾" : "▸"} {COST_GROUP_LABELS[row.group]}
                            </button>
                          ) : (
                            COST_GROUP_LABELS[row.group]
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right">{formatVND(row.estimated)}</td>
                        <td className="py-2 pr-4 text-right">{formatVND(row.actual)}</td>
                        <td className={cn("py-2 text-right", varianceClass(row.variance))}>{formatVND(row.variance)}</td>
                      </tr>
                      {isOpen
                        ? lines.map((line) => (
                            <tr key={line.bomLineId} className="text-text-secondary" data-testid="variance-line">
                              <td className="py-1.5 pl-6 pr-4">
                                {line.bomCode} · {line.name}
                              </td>
                              <td className="py-1.5 pr-4 text-right">{formatVND(line.estimated)}</td>
                              <td className="py-1.5 pr-4 text-right">{formatVND(line.actual)}</td>
                              <td className={cn("py-1.5 text-right", varianceClass(line.variance))}>
                                {formatVND(line.variance)}
                              </td>
                            </tr>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
                <tr className="bg-bg-hover font-semibold text-text-primary">
                  <td className="py-2 pl-2 pr-4">Cộng</td>
                  <td className="py-2 pr-4 text-right">{formatVND(totalEstimated)}</td>
                  <td className="py-2 pr-4 text-right">{formatVND(totalActual)}</td>
                  <td className={cn("py-2 text-right", varianceClass(totalActual - totalEstimated))}>
                    {formatVND(totalActual - totalEstimated)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {summary.unassigned.materialCost + summary.unassigned.directCost > 0 ? (
          <p className="text-xs text-text-secondary">
            Chưa gắn dòng BOM: vật tư {formatVND(summary.unassigned.materialCost)} · chi phí trực tiếp{" "}
            {formatVND(summary.unassigned.directCost)}
          </p>
        ) : null}
        <p className="text-xs text-text-secondary">Chênh lệch dương (màu đỏ) nghĩa là thực tế vượt dự toán.</p>
      </div>
    </div>
  );
}
