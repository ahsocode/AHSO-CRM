"use client";

import { ResponsivePie } from "@nivo/pie";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVNDShort } from "@/lib/format";
import { ReportStatusBreakdown, ReportStatusBucket } from "@/lib/types";
import { CHART_COLORS } from "@/lib/constants";

const PROJECT_COLORS = [CHART_COLORS.axis, CHART_COLORS.primaryLight, CHART_COLORS.accent, CHART_COLORS.primaryMid, CHART_COLORS.danger, CHART_COLORS.success];
const QUOTE_COLORS = [CHART_COLORS.axis, CHART_COLORS.primaryLight, CHART_COLORS.success, CHART_COLORS.danger];
const CONTRACT_COLORS = [CHART_COLORS.accent, CHART_COLORS.primaryLight, CHART_COLORS.success, CHART_COLORS.axis];

type DonutDatum = {
  id: string;
  value: number;
  label: string;
  totalValue: number;
};

export function StatusBreakdown({
  data,
  isLoading
}: {
  data?: ReportStatusBreakdown;
  isLoading: boolean;
}) {
  if (isLoading || !data) {
    return (
      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Status Ledger</p>
          <CardTitle>Phân bổ trạng thái</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <LoadingSkeleton key={index} className="h-[280px] w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Status Ledger</p>
        <CardTitle>Phân bổ trạng thái</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <DonutSection title="Project Status" items={data.projects} colors={PROJECT_COLORS} />
          <DonutSection title="Quote Status" items={data.quotes} colors={QUOTE_COLORS} />
          <DonutSection title="Contract Status" items={data.contracts} colors={CONTRACT_COLORS} />
        </div>
      </CardContent>
    </Card>
  );
}

function DonutSection({
  title,
  items,
  colors
}: {
  title: string;
  items: ReportStatusBucket[];
  colors: string[];
}) {
  const chartData: DonutDatum[] = items.map((item) => ({
    id: item.key,
    value: item.count,
    label: item.label,
    totalValue: item.totalValue
  }));
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  const totalValue = items.reduce((sum, item) => sum + item.totalValue, 0);
  const chartColors = items.map((_, index) => colors[index % colors.length]);

  return (
    <section className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{title}</p>
          <p className="mt-1 text-xs text-text-secondary">
            Tổng {totalCount} bản ghi · <CurrencyDisplay amount={totalValue} short />
          </p>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border/60 bg-white/60 p-6 text-center text-sm text-text-secondary">
          Chưa có dữ liệu
        </div>
      ) : (
        <>
          <div className="h-[200px]">
            <ResponsivePie<DonutDatum>
              data={chartData}
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              innerRadius={0.62}
              padAngle={2}
              cornerRadius={4}
              colors={chartColors}
              enableArcLabels={false}
              enableArcLinkLabels={false}
              animate={false}
              tooltip={({ datum }) => {
                const item = datum.data;
                return (
                  <div className="rounded-xl border border-[rgba(213,216,220,0.8)] bg-white px-3 py-2 text-xs shadow-sm">
                    <p className="font-semibold text-text-primary">{item.label}</p>
                    <p className="mt-1 text-text-secondary">
                      {item.value} bản ghi · {formatVNDShort(item.totalValue)}
                    </p>
                  </div>
                );
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {items.map((item, index) => (
              <div key={item.key} className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="truncate text-sm text-text-primary">{item.label}</span>
                <span className="ml-auto rounded-full bg-bg-hover px-2 py-0.5 text-xs font-semibold text-text-secondary">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
