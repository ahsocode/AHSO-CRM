import { ContractDetailClient } from "../_components/contract-detail-client";

export default function ContractDetailPage({
  params
}: {
  params: {
    id: string;
  };
}) {
  return <ContractDetailClient contractId={params.id} />;
}
