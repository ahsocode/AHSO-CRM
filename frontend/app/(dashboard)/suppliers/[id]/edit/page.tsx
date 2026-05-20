import { SupplierFormScreen } from "../../_components/supplier-form-screen";

export const dynamic = "force-dynamic";

export default function EditSupplierPage({ params }: { params: { id: string } }) {
  return <SupplierFormScreen mode="edit" supplierId={params.id} />;
}
