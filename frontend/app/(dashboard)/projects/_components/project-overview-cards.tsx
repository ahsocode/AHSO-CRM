import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProjectListMeta } from "@/lib/types";

export function ProjectOverviewCards({
  meta,
  isLoading
}: {
  meta?: ProjectListMeta;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="metric-sheen noise-edge border border-white/70">
            <CardHeader>
              <LoadingSkeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent className="space-y-3">
              <LoadingSkeleton className="h-8 w-24" />
              <LoadingSkeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Giá trị pipeline",
      value: <CurrencyDisplay amount={meta?.summary.pipelineValue ?? 0} short />,
      helper: "Estimated value của dự án chưa đóng trong tập lọc"
    },
    {
      label: "Dự án đang hoạt động",
      value: meta?.summary.activeProjects ?? 0,
      helper: "Bao gồm khảo sát, báo giá, đàm phán, đã ký và triển khai"
    },
    {
      label: "Đang triển khai",
      value: meta?.summary.deliveringProjects ?? 0,
      helper: "Các job đã vào delivery hoặc chuẩn bị nghiệm thu"
    },
    {
      label: "Sắp đến hạn",
      value: meta?.summary.dueSoonProjects ?? 0,
      helper: `Trang ${meta?.page ?? 1}/${meta?.totalPages ?? 1}`
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="metric-sheen noise-edge border border-white/70">
          <CardHeader className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary">{card.label}</p>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-extrabold text-text-primary">{card.value}</p>
            <p className="mt-2 text-sm text-text-secondary">{card.helper}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
