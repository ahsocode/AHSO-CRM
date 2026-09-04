import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { scopeCustomerWhereToUser } from "../common/scoping/customer-scope";
import type { ProjectFilterDto } from "./dto/project-filter.dto";

export function buildWhere(filters: Partial<ProjectFilterDto>, user: JwtUser): Prisma.ProjectWhereInput {
  const customerWhere = scopeCustomerWhereToUser(
    { deletedAt: null } as Prisma.CustomerWhereInput,
    user
  );

  if (filters.assignedToId && !isStaff(user)) {
    customerWhere.assignedToId = filters.assignedToId;
  }

  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
    customer: customerWhere
  };

  if (filters.search) {
    where.OR = [
      {
        code: {
          contains: filters.search,
          mode: "insensitive"
        }
      },
      {
        name: {
          contains: filters.search,
          mode: "insensitive"
        }
      },
      {
        description: {
          contains: filters.search,
          mode: "insensitive"
        }
      },
      {
        customer: {
          name: {
            contains: filters.search,
            mode: "insensitive"
          }
        }
      },
      {
        customer: {
          shortName: {
            contains: filters.search,
            mode: "insensitive"
          }
        }
      }
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.priority) {
    where.priority = filters.priority;
  }

  if (filters.customerId) {
    where.customerId = filters.customerId;
  }

  return where;
}

export function buildDeletedWhere(filters: Partial<ProjectFilterDto>, user: JwtUser): Prisma.ProjectWhereInput {
  return {
    ...buildWhere(filters, user),
    deletedAt: {
      not: null
    }
  };
}
