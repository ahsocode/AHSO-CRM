import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PipelineStage } from "@/lib/types";

export function PipelinePreview({
  data,
  isLoading
}: {
  data?: PipelineStage[];
  isLoading: boolean;
}) {
  return (
    <Card className="p-6">
      <CardHeader className="mb-6">
        <CardTitle>Pipeline dự án</CardTitle>
        <CardDescription>Rút gọn từ màn hình kanban để theo dõi nhanh các cơ hội đang dịch chuyển.</CardDescription>
      </CardHeader>

      {isLoading || !data ? (
        <div className="grid gap-4 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <LoadingSkeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          {data.map((stage) => (
            <div className="rounded-2xl bg-bg-hover/60 p-4" key={stage.status}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-text-muted">{stage.label}</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{stage.count} cơ hội</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-text-secondary shadow-sm">
                  <CurrencyDisplay amount={stage.totalValue} short />
                </span>
              </div>

              <div className="space-y-3">
                {stage.items.length > 0 ? (
                  stage.items.map((item) => (
                    <article className="rounded-xl bg-white p-3 shadow-sm" key={item.id}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">{item.code}</p>
                      <h4 className="mt-2 text-sm font-bold text-text-primary">{item.name}</h4>
                      <p className="mt-1 text-xs text-text-secondary">{item.customerName}</p>
                      <p className="mt-3 text-sm font-semibold text-primary">
                        <CurrencyDisplay amount={item.estimatedValue} />
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-white/60 px-3 py-6 text-center text-sm text-text-muted">
                    Chưa có cơ hội
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

