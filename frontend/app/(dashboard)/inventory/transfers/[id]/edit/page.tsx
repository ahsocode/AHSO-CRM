export const dynamic = "force-dynamic";

import { StockTransferFormScreen } from "../../_components/stock-transfer-form-screen";

export default function EditStockTransferPage({ params }: { params: { id: string } }) {
  return <StockTransferFormScreen mode="edit" transferId={params.id} />;
}
