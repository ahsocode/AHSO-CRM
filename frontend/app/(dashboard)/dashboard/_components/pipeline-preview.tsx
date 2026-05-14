import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { formatVNDShort } from "@/lib/format";
import { PipelineStage } from "@/lib/types";

const STAGE_COLORS = ["#78909c", "#2e86c1", "#e67e22", "#1a5276", "#1e8449", "#c0392b", "#5d6d7e"];

export function PipelinePreview({
  data,
  isLoading
}: {
  data?: PipelineStage[];
  isLoading: boolean;
}) {
  if (isLoading || !data) {
    return (
      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Pipeline Overview</p>
          <CardTitle>Phân bổ pipeline theo giai đoạn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoadingSkeleton className="h-9 w-full rounded-full" />
          <LoadingSkeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalValue = data.reduce((sum, stage) => sum + stage.totalValue, 0);

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Pipeline Overview</p>
        <CardTitle>Phân bổ pipeline theo giai đoạn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-9 overflow-hidden rounded-full">
          {data.map((stage, index) => {
            const pct = totalValue > 0 ? (stage.totalValue / totalValue) * 100 : 0;
            if (pct < 0.5) {
              return null;
            }

            return (
              <div
                key={stage.status}
                title={`${stage.label}: ${stage.count} dự án · ${formatVNDShort(stage.totalValue)}`}
                className="transition-opacity hover:opacity-80"
                style={{
                  flex: stage.totalValue,
                  backgroundColor: STAGE_COLORS[index % STAGE_COLORS.length]
                }}
              />
            );
          })}
        </div>

        <div className="flex divide-x divide-border/40">
          {data.map((stage, index) => (
            <div key={stage.status} className="flex flex-1 flex-col items-center gap-1 px-2 text-center">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: STAGE_COLORS[index % STAGE_COLORS.length] }}
              />
              <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-text-muted">
                {stage.label}
              </p>
              <p className="text-lg font-bold leading-none text-text-primary">{stage.count}</p>
              <p className="text-[11px] text-text-muted">{formatVNDShort(stage.totalValue)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
