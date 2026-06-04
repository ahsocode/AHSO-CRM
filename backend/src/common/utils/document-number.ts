import type { Prisma } from "@prisma/client";

// Shared advisory lock key — must be identical in every caller to guarantee serialization
const STOCK_ISSUE_LOCK = "stock_issue_number";

// Use createdAt desc (not issueNo desc) to avoid lexicographic sort overflow past 999.
// The advisory lock ensures sequential creation so createdAt desc is reliable.
export async function generateNextStockIssueNo(tx: Prisma.TransactionClient): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${STOCK_ISSUE_LOCK}))`;
  const year = new Date().getFullYear();
  const prefix = `PX-${year}-`;
  const latest = await tx.stockIssue.findFirst({
    where: { issueNo: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { issueNo: true }
  });
  const seq = latest?.issueNo.split("-").at(-1);
  const next = seq ? Number.parseInt(seq, 10) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}
