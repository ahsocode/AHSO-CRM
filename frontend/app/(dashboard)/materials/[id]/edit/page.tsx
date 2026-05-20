import { MaterialFormScreen } from "../../_components/material-form-screen";

export const dynamic = "force-dynamic";

export default function EditMaterialPage({ params }: { params: { id: string } }) {
  return <MaterialFormScreen mode="edit" materialId={params.id} />;
}
