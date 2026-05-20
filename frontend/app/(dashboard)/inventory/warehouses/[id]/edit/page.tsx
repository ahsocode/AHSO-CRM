export const dynamic = "force-dynamic";

import { WarehouseFormScreen } from "../../_components/warehouse-form-screen";

export default function EditWarehousePage({ params }: { params: { id: string } }) {
  return <WarehouseFormScreen mode="edit" warehouseId={params.id} />;
}
