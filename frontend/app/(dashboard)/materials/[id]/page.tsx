import { MaterialDetailClient } from "../_components/material-detail-client";

export const dynamic = "force-dynamic";

export default function MaterialDetailPage({ params }: { params: { id: string } }) {
  return <MaterialDetailClient materialId={params.id} />;
}
