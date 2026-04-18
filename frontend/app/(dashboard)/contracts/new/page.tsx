import { ContractFormScreen } from "../_components/contract-form-screen";

export default function NewContractPage({
  searchParams
}: {
  searchParams?: {
    projectId?: string;
    sourceQuoteId?: string;
  };
}) {
  const initialProjectId = typeof searchParams?.projectId === "string" ? searchParams.projectId : "";
  const initialSourceQuoteId =
    typeof searchParams?.sourceQuoteId === "string" ? searchParams.sourceQuoteId : "";

  return (
    <ContractFormScreen
      mode="create"
      initialProjectId={initialProjectId}
      initialSourceQuoteId={initialSourceQuoteId}
    />
  );
}
