import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../../auth/auth.types";

/**
 * Row-level scoping for the "a STAFF user only sees their own customers" rule.
 *
 * Mutates `where` in place (and returns it for chaining) so a STAFF user only
 * matches customers assigned to them, with an active owner. No-op for
 * ADMIN/MANAGER.
 *
 * Works both on a top-level `Prisma.CustomerWhereInput` and on a nested
 * `customer:` relation filter inside a `ProjectWhereInput` / `QuoteWhereInput`
 * / `ContractWhereInput` — the shape is the same either way.
 */
export function scopeCustomerWhereToUser(
  where: Prisma.CustomerWhereInput,
  user: JwtUser
): Prisma.CustomerWhereInput {
  if (isStaff(user)) {
    where.assignedToId = user.sub;
    where.assignedTo = { isActive: true };
  }
  return where;
}
