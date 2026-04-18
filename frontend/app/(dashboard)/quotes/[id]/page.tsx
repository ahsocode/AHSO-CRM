import { QuoteDetailClient } from "../_components/quote-detail-client";

export default function QuoteDetailPage({
  params
}: {
  params: {
    id: string;
  };
}) {
  return <QuoteDetailClient quoteId={params.id} />;
}
