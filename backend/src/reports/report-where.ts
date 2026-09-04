import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { scopeCustomerWhereToUser } from "../common/scoping/customer-scope";

export function buildCustomerWhere(
  user: JwtUser,
  extra?: Prisma.CustomerWhereInput
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {
    deletedAt: null,
    ...extra
  };

  return scopeCustomerWhereToUser(where, user);
}

export function buildProjectWhere(user: JwtUser, extra?: Prisma.ProjectWhereInput): Prisma.ProjectWhereInput {
  return {
    deletedAt: null,
    customer: buildCustomerWhere(user),
    ...extra
  };
}

export function buildQuoteWhere(
  user: JwtUser,
  createdAfter?: Date,
  createdBefore?: Date
): Prisma.QuoteWhereInput {
  return {
    ...(createdAfter
      ? {
          createdAt: {
            gte: createdAfter,
            ...(createdBefore ? { lt: createdBefore } : {})
          }
        }
      : {}),
    project: buildProjectWhere(user)
  };
}

export function buildContractWhere(user: JwtUser, extra?: Prisma.ContractWhereInput): Prisma.ContractWhereInput {
  return {
    project: buildProjectWhere(user),
    ...extra
  };
}

export function buildPaymentWhere(user: JwtUser, start: Date, end: Date): Prisma.PaymentWhereInput {
  return {
    paidAt: {
      gte: start,
      lt: end
    },
    project: buildProjectWhere(user),
    // Loại các khoản thanh toán gắn với hợp đồng đã HUỶ (vd: hợp đồng trùng lặp bị
    // huỷ nhưng vẫn giữ lịch sử thanh toán để tra soát) — không tính vào doanh thu.
    OR: [{ contractId: null }, { contract: { status: { not: "CANCELLED" } } }]
  };
}

export function buildActivityWhere(user: JwtUser, extra?: Prisma.ActivityWhereInput): Prisma.ActivityWhereInput {
  if (isStaff(user)) {
    return {
      deletedAt: null,
      ...extra,
      OR: [
        {
          customer: buildCustomerWhere(user)
        },
        {
          project: buildProjectWhere(user)
        },
        {
          customerId: null,
          projectId: null,
          userId: user.sub
        }
      ]
    };
  }

  return {
    deletedAt: null,
    ...extra,
    AND: [
      {
        OR: [
          {
            customerId: null
          },
          {
            customer: buildCustomerWhere(user)
          }
        ]
      },
      {
        OR: [
          {
            projectId: null
          },
          {
            project: buildProjectWhere(user)
          }
        ]
      }
    ]
  };
}
