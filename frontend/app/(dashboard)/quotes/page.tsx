import { Suspense } from "react";
import { QuotesClient } from "./_components/quotes-client";

export default function QuotesPage() {
  return (
    <Suspense fallback={null}>
      <QuotesClient />
    </Suspense>
  );
}
