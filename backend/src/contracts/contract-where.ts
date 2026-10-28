import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { scopeCustomerWhereToUser } from "../common/scoping/customer-scope";
import type { ContractFilterDto } from "./dto/contract-filter.dto";

export function buildWhere(filters: Partial<ContractFilterDto>, user: JwtUser): Prisma.ContractWhereInput {
  const projectWhere: Prisma.ProjectWhereInput = buildAccessibleProjectWhere(user);
  const where: Prisma.ContractWhereInput = {
    deletedAt: null,
    project: projectWhere
  };

  if (filters.projectId) {
    where.projectId = filters.projectId;
  }

  if (filters.customerId) {
    projectWhere.customerId = filters.customerId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    where.OR = [
      {
        contractNo: {
          contains: filters.search,
          mode: "insensitive"
        }
      },
      {
        project: {
          code: {
            contains: filters.search,
            mode: "insensitive"
          }
        }
      },
      {
        project: {
          name: {
            contains: filters.search,
            mode: "insensitive"
          }
        }
      },
      {
        project: {
          customer: {
            name: {
              contains: filters.search,
              mode: "insensitive"
            }
          }
        }
      },
      {
        project: {
          customer: {
            shortName: {
              contains: filters.search,
              mode: "insensitive"
            }
          }
        }
      }
    ];
  }

  return where;
}

/**
 * List filter: same as buildWhere, but hides CANCELLED contracts unless the caller
 * asks for them (includeCancelled) or filters by an explicit status.
 */
export function buildListWhere(filters: Partial<ContractFilterDto>, user: JwtUser): Prisma.ContractWhereInput {
  const where = buildWhere(filters, user);

  if (!filters.status && !filters.includeCancelled) {
    where.status = { not: "CANCELLED" };
  }

  return where;
}

export function isCancelledMixed(filters: Partial<ContractFilterDto>): boolean {
  return !filters.status && Boolean(filters.includeCancelled) && !filters.sortBy;
}

export const DEFAULT_CONTRACT_ORDER: Prisma.ContractOrderByWithRelationInput[] = [
  { updatedAt: "desc" },
  { createdAt: "desc" }
];

export function buildContractOrderBy(
  filters: Partial<ContractFilterDto>
): Prisma.ContractOrderByWithRelationInput[] {
  if (!filters.sortBy) {
    return DEFAULT_CONTRACT_ORDER;
  }

  const dir = filters.sortDir ?? "desc";
  const primary = { [filters.sortBy]: dir } as Prisma.ContractOrderByWithRelationInput;
  return [primary, { createdAt: "desc" }];
}

export function buildAccessibleProjectWhere(user: JwtUser): Prisma.ProjectWhereInput {
  const customerWhere = scopeCustomerWhereToUser({ deletedAt: null }, user);

  return {
    deletedAt: null,
    customer: customerWhere
  };
}
