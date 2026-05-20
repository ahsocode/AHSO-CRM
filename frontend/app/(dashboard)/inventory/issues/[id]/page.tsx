export const dynamic = "force-dynamic";

import { StockIssueDetailClient } from "../_components/stock-issue-detail-client";

export default function StockIssueDetailPage({ params }: { params: { id: string } }) {
  return <StockIssueDetailClient issueId={params.id} />;
}
