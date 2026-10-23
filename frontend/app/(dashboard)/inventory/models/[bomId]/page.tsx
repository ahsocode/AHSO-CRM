import { ModelDetailClient } from "../_components/model-detail-client";

export default function ModelDetailPage({ params }: { params: { bomId: string } }) {
  return <ModelDetailClient bomId={params.bomId} />;
}
