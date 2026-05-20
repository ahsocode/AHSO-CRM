export const dynamic = "force-dynamic";

import { StockTransferDetailClient } from "../_components/stock-transfer-detail-client";

export default function StockTransferDetailPage({ params }: { params: { id: string } }) {
  return <StockTransferDetailClient transferId={params.id} />;
}
