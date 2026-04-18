import { QuoteFormScreen } from "../../_components/quote-form-screen";

export default function EditQuotePage({
  params
}: {
  params: {
    id: string;
  };
}) {
  return <QuoteFormScreen mode="edit" quoteId={params.id} />;
}
