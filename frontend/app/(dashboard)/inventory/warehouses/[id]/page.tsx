export const dynamic = "force-dynamic";

import { WarehouseDetailClient } from "../_components/warehouse-detail-client";

export default function WarehouseDetailPage({ params }: { params: { id: string } }) {
  return <WarehouseDetailClient warehouseId={params.id} />;
}
