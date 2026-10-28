import type { Prisma } from "@prisma/client";
import type { ProjectFilterDto } from "./dto/project-filter.dto";

export const TERMINAL_PROJECT_STATUSES = ["COMPLETED", "LOST"] as const;

type SortField = NonNullable<ProjectFilterDto["sortBy"]>;

/** Explicit sort: only allow-listed columns, always tie-broken for stable pagination. */
export function buildExplicitOrderBy(sortBy: SortField, sortDir: "asc" | "desc"): Prisma.ProjectOrderByWithRelationInput[] {
  const primary: Prisma.ProjectOrderByWithRelationInput =
    sortBy === "expectedEndDate" ? { expectedEndDate: { sort: sortDir, nulls: "last" } } : { [sortBy]: sortDir };

  return [primary, { updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }];
}

/** Default order inside one status group: newest activity first. */
export const DEFAULT_PROJECT_ORDER_BY: Prisma.ProjectOrderByWithRelationInput[] = [
  { updatedAt: "desc" },
  { createdAt: "desc" },
  { id: "desc" }
];

/**
 * Default list order = active statuses first, terminal statuses last. Prisma cannot order by a
 * computed CASE, so the page window [skip, skip + limit) over the concatenation
 * [active..., terminal...] is split into two consistent queries.
 */
export function planGroupedPage(skip: number, limit: number, activeCount: number) {
  const activeSkip = Math.min(skip, activeCount);
  const activeTake = Math.max(0, Math.min(limit, activeCount - skip));

  return {
    active: { skip: activeSkip, take: activeTake },
    terminal: { skip: Math.max(0, skip - activeCount), take: limit - activeTake }
  };
}
