import type { Prisma } from "@prisma/client";

export const CUSTOMER_SORT_FIELDS = ["updatedAt", "createdAt", "name"] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

/**
 * Quote statuses counted in the list column "Giá trị báo giá".
 * Definition: sum of `total` (VAT-inclusive) of the customer's non-deleted
 * quotes that are SENT or ACCEPTED (i.e. sent to the customer or won).
 * DRAFT/REJECTED/EXPIRED are excluded on purpose.
 */
export const QUOTE_VALUE_STATUSES = ["SENT", "ACCEPTED"] as const;

/**
 * Default order keeps VIP customers on top; an explicit sort is applied as-is
 * (id is the tiebreaker so pagination stays stable).
 */
export function buildCustomerOrderBy(
  sortBy: CustomerSortField | undefined,
  sortDir: "asc" | "desc" | undefined
): Prisma.CustomerOrderByWithRelationInput[] {
  if (!sortBy) {
    return [{ isVip: "desc" }, { updatedAt: "desc" }];
  }

  return [{ [sortBy]: sortDir ?? (sortBy === "name" ? "asc" : "desc") }, { id: "asc" }];
}

type AmountRow = {
  amount: { toString(): string } | number | string;
  project: { customerId: string };
};

/** Sums `amount` per customerId. Customers without rows are absent from the map. */
export function sumByCustomer(rows: AmountRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const customerId = row.project.customerId;
    totals.set(customerId, (totals.get(customerId) ?? 0) + Number(row.amount.toString()));
  }
  return totals;
}
