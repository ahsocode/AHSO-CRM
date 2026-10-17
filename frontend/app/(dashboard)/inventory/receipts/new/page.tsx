export const dynamic = "force-dynamic";

import { StockReceiptFormScreen } from "../_components/stock-receipt-form-screen";

export default function NewStockReceiptPage({
  searchParams,
}: {
  searchParams?: { supplierId?: string | string[] };
}) {
  const initialSupplierId =
    typeof searchParams?.supplierId === "string" ? searchParams.supplierId : undefined;

  return <StockReceiptFormScreen mode="create" initialSupplierId={initialSupplierId} />;
}
