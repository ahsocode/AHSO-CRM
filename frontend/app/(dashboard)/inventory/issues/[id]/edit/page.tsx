export const dynamic = "force-dynamic";

import { StockIssueFormScreen } from "../../_components/stock-issue-form-screen";

export default function EditStockIssuePage({ params }: { params: { id: string } }) {
  return <StockIssueFormScreen mode="edit" issueId={params.id} />;
}
