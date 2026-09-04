import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { scopeCustomerWhereToUser } from "../common/scoping/customer-scope";
import type { QuoteFilterDto } from "./dto/quote-filter.dto";

export function buildWhere(filters: Partial<QuoteFilterDto>, user: JwtUser): Prisma.QuoteWhereInput {
  const projectWhere: Prisma.ProjectWhereInput = buildAccessibleProjectWhere(user);

  if (filters.projectId) {
    projectWhere.id = filters.projectId;
  }

  if (filters.customerId) {
    projectWhere.customerId = filters.customerId;
  }

  const where: Prisma.QuoteWhereInput = {
    deletedAt: null,
    project: projectWhere
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.createdById && !isStaff(user)) {
    where.createdById = filters.createdById;
  }

  if (filters.search) {
    where.OR = [
      {
        quoteNo: {
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
      },
      {
        items: {
          some: {
            name: {
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
