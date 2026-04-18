import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportStatusBreakdown, ReportStatusBucket } from "@/lib/types";

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
        <CardHeader>
          <CardTitle>Phân bổ trạng thái</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-40 w-full" />
          ))}
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
      <CardContent className="space-y-8">
        <StatusSection items={data.projects} title="Project Status" />
        <StatusSection items={data.quotes} title="Quote Status" />
        <StatusSection items={data.contracts} title="Contract Status" />
      </CardContent>
    </Card>
  );
}

function StatusSection({
  title,
  items
}: {
  title: string;
  items: ReportStatusBucket[];
}) {
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className="space-y-4">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-text-secondary">{title}</p>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="rounded-2xl border border-border/60 bg-white/80 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-text-primary">{item.label}</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {item.count} bản ghi · <CurrencyDisplay amount={item.totalValue} short />
                </p>
              </div>
              <div className="w-full max-w-[320px]">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / maxCount) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
