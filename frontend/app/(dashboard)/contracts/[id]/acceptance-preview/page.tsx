import { ContractAcceptancePreviewClient } from "../../_components/contract-acceptance-preview-client";

export default function ContractAcceptancePreviewPage({
  params
}: {
  params: {
    id: string;
  };
}) {
  return <ContractAcceptancePreviewClient contractId={params.id} />;
}
