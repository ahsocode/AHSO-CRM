export const dynamic = "force-dynamic";

import { StockReceiptFormScreen } from "../../_components/stock-receipt-form-screen";

export default function EditStockReceiptPage({ params }: { params: { id: string } }) {
  return <StockReceiptFormScreen mode="edit" receiptId={params.id} />;
}
