export const dynamic = "force-dynamic";

import { StockReceiptDetailClient } from "../_components/stock-receipt-detail-client";

export default function StockReceiptDetailPage({ params }: { params: { id: string } }) {
  return <StockReceiptDetailClient receiptId={params.id} />;
}
