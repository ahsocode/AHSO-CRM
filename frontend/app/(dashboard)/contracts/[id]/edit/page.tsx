import { ContractFormScreen } from "../../_components/contract-form-screen";

export default function EditContractPage({
  params
}: {
  params: {
    id: string;
  };
}) {
  return <ContractFormScreen mode="edit" contractId={params.id} />;
}
