import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MaterialListItem } from "@/lib/types";

export function MaterialOverviewCards({
  items,
  isLoading,
}: {
  items: MaterialListItem[];
  isLoading: boolean;
}) {
  const totalValue = items.reduce((sum, m) => sum + m.totalStock * m.costPrice, 0);
  const lowStockCount = items.filter((m) => m.isLowStock).length;
  const inactiveCount = items.filter((m) => !m.isActive).length;

  const cards = [
    {
      label: "Tổng vật tư",
      description: "Tổng số mã vật tư đang quản lý trong hệ thống.",
      value: <span>{items.length}</span>,
    },
    {
      label: "Cảnh báo tồn thấp",
      description: "Số vật tư có tồn kho dưới mức tối thiểu.",
      value: (
        <span className={lowStockCount > 0 ? "text-danger" : undefined}>{lowStockCount}</span>
      ),
    },
    {
      label: "Không hoạt động",
      description: "Vật tư đã ngưng sử dụng hoặc tạm dừng kinh doanh.",
      value: <span>{inactiveCount}</span>,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label} className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="industrial-chip bg-primary/10 text-primary">VT Signal</p>
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
