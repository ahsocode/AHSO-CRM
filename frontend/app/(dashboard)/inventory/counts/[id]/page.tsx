export const dynamic = "force-dynamic";

import { StockCountDetailClient } from "../_components/stock-count-detail-client";

export default function StockCountDetailPage({ params }: { params: { id: string } }) {
  return <StockCountDetailClient countId={params.id} />;
}
