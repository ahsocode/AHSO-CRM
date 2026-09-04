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

export function buildAccessibleProjectWhere(user: JwtUser): Prisma.ProjectWhereInput {
  const customerWhere = scopeCustomerWhereToUser({ deletedAt: null }, user);

  return {
    deletedAt: null,
    customer: customerWhere
  };
}
