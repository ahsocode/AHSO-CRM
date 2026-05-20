export const dynamic = "force-dynamic";

import { StockCountFormScreen } from "../../_components/stock-count-form-screen";

export default function EditStockCountPage({ params }: { params: { id: string } }) {
  return <StockCountFormScreen mode="edit" countId={params.id} />;
}
