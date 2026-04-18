import { QuoteFormScreen } from "../_components/quote-form-screen";

export default function NewQuotePage({
  searchParams
}: {
  searchParams?: {
    projectId?: string;
  };
}) {
  const initialProjectId = typeof searchParams?.projectId === "string" ? searchParams.projectId : "";

  return <QuoteFormScreen initialProjectId={initialProjectId} />;
}
