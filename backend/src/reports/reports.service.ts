import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { ReportFilterDto } from "./dto/report-filter.dto";

const OPEN_PIPELINE_STATUSES = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "DELIVERING"] as const;
const PROJECT_STATUS_LABELS = {
  SURVEY: "Khảo sát",
  QUOTING: "Báo giá",
  NEGOTIATING: "Đàm phán",
  WON: "Đã ký HĐ",
  LOST: "Không thành",
  DELIVERING: "Triển khai",
  COMPLETED: "Hoàn thành"
} as const;
const QUOTE_STATUS_LABELS = {
  DRAFT: "Bản nháp",
  SENT: "Đã gửi",
  ACCEPTED: "Chấp nhận",
  REJECTED: "Từ chối",
  EXPIRED: "Hết hạn"
} as const;
const CONTRACT_STATUS_LABELS = {
  ACTIVE: "Hiệu lực",
  SUSPENDED: "Tạm dừng",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Hủy"
} as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(filters: ReportFilterDto, user: JwtUser) {
    const { start, nextMonthStart } = this.resolveMonthsRange(filters.months);
    const paymentWhere = this.buildPaymentWhere(user, start, nextMonthStart);
    const projectWhere = this.buildProjectWhere(user);
    const quoteWhere = this.buildQuoteWhere(user, start);
    const contractWhere = this.buildContractWhere(user);

    const [payments, pipelineProjects, quotes, contracts, activeCustomers] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: paymentWhere,
        include: {
          contract: {
            include: {
              project: {
                include: {
                  customer: true
                }
              }
            }
          }
        },
        orderBy: {
          paidAt: "desc"
        }
      }),
      this.prisma.project.findMany({
        where: {
          ...projectWhere,
          status: {
            in: [...OPEN_PIPELINE_STATUSES]
          }
        },
        select: {
          estimatedValue: true
        }
      }),
      this.prisma.quote.findMany({
        where: quoteWhere,
        select: {
          status: true
        }
      }),
      this.prisma.contract.findMany({
        where: contractWhere,
        include: {
          payments: true
        }
      }),
      this.prisma.customer.count({
        where: this.buildCustomerWhere(user, {
          status: "ACTIVE"
        })
      })
    ]);

    const collectionsValue = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const openPipelineValue = pipelineProjects.reduce(
      (sum, project) => sum + Number(project.estimatedValue ?? 0),
      0
    );
    const outstandingDebt = contracts.reduce((sum, contract) => {
      const paidAmount = contract.payments.reduce((paid, payment) => paid + Number(payment.amount), 0);
      return sum + Math.max(0, Number(contract.value) - paidAmount);
    }, 0);
    const acceptedQuotes = quotes.filter((quote) => quote.status === "ACCEPTED").length;
    const quoteAcceptanceRate = quotes.length > 0 ? Number(((acceptedQuotes / quotes.length) * 100).toFixed(1)) : 0;
    const activeContracts = contracts.filter((contract) => contract.status === "ACTIVE").length;

    return {
      collectionsValue,
      openPipelineValue,
      outstandingDebt,
      quoteAcceptanceRate,
      activeContracts,
      activeCustomers,
      recentPayments: payments.slice(0, 5).map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        paidAt: payment.paidAt,
        contractNo: payment.contract.contractNo,
        customerName: payment.contract.project.customer.name,
        projectName: payment.contract.project.name,
        method: payment.method,
        reference: payment.reference
      }))
    };
  }

  async getRevenueTrend(filters: ReportFilterDto, user: JwtUser) {
    const { start, nextMonthStart, months } = this.resolveMonthsRange(filters.months);
    const payments = await this.prisma.payment.findMany({
      where: this.buildPaymentWhere(user, start, nextMonthStart),
      orderBy: {
        paidAt: "asc"
      }
    });

    return Array.from({ length: months }, (_, index) => {
      const date = new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth() - (months - index), 1);
      const revenue = payments
        .filter(
          (payment) =>
            payment.paidAt.getFullYear() === date.getFullYear() &&
            payment.paidAt.getMonth() === date.getMonth()
        )
        .reduce((sum, payment) => sum + Number(payment.amount), 0);

      return {
        month: date.toLocaleDateString("vi-VN", { month: "short" }).replace(".", ""),
        revenue,
        target: 200000000
      };
    });
  }

  async getStatusBreakdown(_filters: ReportFilterDto, user: JwtUser) {
    const [projects, quotes, contracts] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where: this.buildProjectWhere(user),
        select: {
          status: true,
          estimatedValue: true
        }
      }),
      this.prisma.quote.findMany({
        where: this.buildQuoteWhere(user),
        select: {
          status: true,
          total: true
        }
      }),
      this.prisma.contract.findMany({
        where: this.buildContractWhere(user),
        select: {
          status: true,
          value: true
        }
      })
    ]);

    return {
      projects: this.buildStatusBuckets(projects, PROJECT_STATUS_LABELS, "estimatedValue"),
      quotes: this.buildStatusBuckets(quotes, QUOTE_STATUS_LABELS, "total"),
      contracts: this.buildStatusBuckets(contracts, CONTRACT_STATUS_LABELS, "value")
    };
  }

  async getTopCustomers(filters: ReportFilterDto, user: JwtUser) {
    const { start, nextMonthStart } = this.resolveMonthsRange(filters.months);
    const payments = await this.prisma.payment.findMany({
      where: this.buildPaymentWhere(user, start, nextMonthStart),
      include: {
        contract: {
          include: {
            project: {
              include: {
                customer: {
                  include: {
                    projects: {
                      where: {
                        deletedAt: null
                      },
                      select: {
                        id: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const customerMap = new Map<
      string,
      {
        customerId: string;
        name: string;
        paidAmount: number;
        contractValue: number;
        contractIds: Set<string>;
        projectIds: Set<string>;
      }
    >();

    for (const payment of payments) {
      const customer = payment.contract.project.customer;
      const current = customerMap.get(customer.id) ?? {
        customerId: customer.id,
        name: customer.name,
        paidAmount: 0,
        contractValue: 0,
        contractIds: new Set<string>(),
        projectIds: new Set<string>()
      };

      current.paidAmount += Number(payment.amount);
      if (!current.contractIds.has(payment.contract.id)) {
        current.contractValue += Number(payment.contract.value);
        current.contractIds.add(payment.contract.id);
      }
      current.projectIds.add(payment.contract.project.id);
      customerMap.set(customer.id, current);
    }

    return Array.from(customerMap.values())
      .map((item) => ({
        customerId: item.customerId,
        name: item.name,
        paidAmount: item.paidAmount,
        contractValue: item.contractValue,
        projectCount: item.projectIds.size
      }))
      .sort((left, right) => right.paidAmount - left.paidAmount)
      .slice(0, filters.topLimit);
  }

  private buildStatusBuckets<T extends { status: string; [key: string]: Prisma.Decimal | string | null }>(
    items: T[],
    labels: Record<string, string>,
    valueKey: keyof T
  ) {
    return Object.entries(labels).map(([status, label]) => ({
      key: status,
      label,
      count: items.filter((item) => item.status === status).length,
      totalValue: items
        .filter((item) => item.status === status)
        .reduce((sum, item) => sum + Number(item[valueKey] ?? 0), 0)
    }));
  }

  private buildCustomerWhere(
    user: JwtUser,
    extra?: Prisma.CustomerWhereInput
  ): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...extra
    };

    if (user.role === "STAFF") {
      where.assignedToId = user.sub;
    }

    return where;
  }

  private buildProjectWhere(user: JwtUser, extra?: Prisma.ProjectWhereInput): Prisma.ProjectWhereInput {
    return {
      deletedAt: null,
      customer: this.buildCustomerWhere(user),
      ...extra
    };
  }

  private buildQuoteWhere(
    user: JwtUser,
    createdAfter?: Date
  ): Prisma.QuoteWhereInput {
    return {
      ...(createdAfter
        ? {
            createdAt: {
              gte: createdAfter
            }
          }
        : {}),
      project: this.buildProjectWhere(user)
    };
  }

  private buildContractWhere(user: JwtUser): Prisma.ContractWhereInput {
    return {
      project: this.buildProjectWhere(user)
    };
  }

  private buildPaymentWhere(user: JwtUser, start: Date, end: Date): Prisma.PaymentWhereInput {
    return {
      paidAt: {
        gte: start,
        lt: end
      },
      contract: {
        project: this.buildProjectWhere(user)
      }
    };
  }

  private resolveMonthsRange(months: number) {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const start = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - (months - 1), 1);

    return {
      start,
      nextMonthStart,
      months
    };
  }
}
