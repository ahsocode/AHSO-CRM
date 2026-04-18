import { QuotePreviewClient } from "../../_components/quote-preview-client";

export default function QuotePreviewPage({
  params
}: {
  params: {
    id: string;
  };
}) {
  return <QuotePreviewClient quoteId={params.id} />;
}
