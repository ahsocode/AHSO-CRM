import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// We accept computed values rather than the full meta to stay flexible
export function SupplierOverviewCards({
  total,
  activeCount,
  isLoading,
}: {
  total: number;
  activeCount: number;
  isLoading: boolean;
}) {
  const cards = [
    {
      label: "Tổng nhà cung cấp",
      description: "Tổng số NCC đang có trong hệ thống.",
      value: total,
    },
    {
      label: "Đang hoạt động",
      description: "NCC hiện đang hợp tác và cung ứng hàng.",
      value: activeCount,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <Card key={card.label} className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="industrial-chip bg-primary/10 text-primary">NCC Signal</p>
            <CardTitle>{card.label}</CardTitle>
            <CardDescription>{card.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSkeleton className="h-9 w-20" />
            ) : (
              <div className="font-heading text-3xl font-extrabold text-text-primary">
                {card.value}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
