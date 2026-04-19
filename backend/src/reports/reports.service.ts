import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import {
  CustomReportQueryDto,
  ReportTemplateDto,
  UpdateReportTemplateDto
} from "./dto/custom-report.dto";
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

  async getCustomerJourney(filters: ReportFilterDto, user: JwtUser) {
    const { start } = this.resolveMonthsRange(filters.months);
    const [customers, projects, quotes, contracts] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where: this.buildCustomerWhere(user, {
          createdAt: {
            gte: start
          }
        }),
        select: {
          id: true,
          status: true
        }
      }),
      this.prisma.project.findMany({
        where: this.buildProjectWhere(user, {
          createdAt: {
            gte: start
          }
        }),
        select: {
          customerId: true,
          status: true
        }
      }),
      this.prisma.quote.findMany({
        where: this.buildQuoteWhere(user, start),
        select: {
          project: {
            select: {
              customerId: true
            }
          },
          status: true
        }
      }),
      this.prisma.contract.findMany({
        where: this.buildContractWhere(user),
        select: {
          project: {
            select: {
              customerId: true
            }
          },
          status: true
        }
      })
    ]);

    return {
      nodes: [
        { id: "lead", label: "Lead" },
        { id: "project", label: "Dự án" },
        { id: "quote", label: "Báo giá" },
        { id: "contract", label: "Hợp đồng" },
        { id: "closed", label: "Chốt thành công" }
      ],
      links: [
        { source: "lead", target: "project", value: projects.length || customers.length },
        {
          source: "project",
          target: "quote",
          value: quotes.filter((item) => item.status === "SENT" || item.status === "ACCEPTED").length
        },
        {
          source: "quote",
          target: "contract",
          value: quotes.filter((item) => item.status === "ACCEPTED").length
        },
        {
          source: "contract",
          target: "closed",
          value: contracts.filter((item) => item.status === "ACTIVE" || item.status === "COMPLETED").length
        }
      ]
    };
  }

  async getActivityHeatmap(filters: ReportFilterDto, user: JwtUser) {
    const { start, nextMonthStart } = this.resolveMonthsRange(filters.months);
    const activities = await this.prisma.activity.findMany({
      where: {
        deletedAt: null,
        updatedAt: {
          gte: start,
          lt: nextMonthStart
        },
        ...(isStaff(user) ? { customer: { assignedToId: user.sub } } : {})
      },
      select: {
        scheduledAt: true,
        updatedAt: true
      }
    });

    const dayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const hourLabels = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
    const matrix = new Map<string, number>();

    for (const activity of activities) {
      const date = activity.scheduledAt ?? activity.updatedAt;
      const key = `${date.getDay()}-${date.getHours()}`;
      matrix.set(key, (matrix.get(key) ?? 0) + 1);
    }

    return dayLabels.flatMap((day, dayIndex) =>
      hourLabels.map((hour, hourIndex) => ({
        day,
        hour,
        value: matrix.get(`${dayIndex}-${hourIndex}`) ?? 0
      }))
    );
  }

  async getFunnel(filters: ReportFilterDto, user: JwtUser) {
    const projects = await this.prisma.project.findMany({
      where: this.buildProjectWhere(user),
      select: {
        status: true,
        estimatedValue: true
      }
    });

    return [
      "SURVEY",
      "QUOTING",
      "NEGOTIATING",
      "WON",
      "DELIVERING",
      "COMPLETED"
    ].map((status) => {
      const items = projects.filter((project) => project.status === status);
      return {
        id: status,
        label: PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS],
        value: items.length,
        totalValue: items.reduce((sum, item) => sum + Number(item.estimatedValue ?? 0), 0)
      };
    });
  }

  async getCohort(filters: ReportFilterDto, user: JwtUser) {
    const { start, months } = this.resolveMonthsRange(filters.months);
    const customers = await this.prisma.customer.findMany({
      where: this.buildCustomerWhere(user, {
        createdAt: {
          gte: start
        }
      }),
      select: {
        id: true,
        createdAt: true,
        projects: {
          select: {
            contract: {
              select: {
                payments: {
                  select: {
                    paidAt: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return customers.map((customer) => {
      const cohortMonth = `${customer.createdAt.getFullYear()}-${customer.createdAt.getMonth() + 1}`;
      const activeMonths = new Set(
        customer.projects.flatMap((project) =>
          project.contract?.payments.map((payment) => `${payment.paidAt.getFullYear()}-${payment.paidAt.getMonth() + 1}`) ?? []
        )
      );

      return {
        cohort: cohortMonth,
        values: Array.from({ length: months }, (_, index) => {
          const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
          const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
          return {
            month: key,
            retained: activeMonths.has(key) ? 1 : 0
          };
        })
      };
    });
  }

  async runCustomQuery(dto: CustomReportQueryDto, user: JwtUser) {
    const rows = await this.loadDatasetRows(dto.dataset, user);
    const filteredRows = rows.filter((row) => this.matchesFilters(row, dto.filters));
    const chartData = this.aggregateRows(filteredRows, dto.dimensions, dto.measures);

    return {
      rows: filteredRows,
      summary: {
        dataset: dto.dataset,
        rowCount: filteredRows.length
      },
      chartData
    };
  }

  async getTemplates(user: JwtUser) {
    return this.prisma.reportTemplate.findMany({
      where: {
        OR: [{ createdById: user.sub }, { isShared: true }]
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
    });
  }

  async createTemplate(dto: ReportTemplateDto, user: JwtUser) {
    return this.prisma.reportTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        resource: dto.resource,
        isShared: dto.isShared ?? false,
        config: dto.config,
        createdById: user.sub
      }
    });
  }

  async updateTemplate(id: string, dto: UpdateReportTemplateDto, user: JwtUser) {
    return this.prisma.reportTemplate.updateMany({
      where: {
        id,
        createdById: user.sub
      },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.resource !== undefined ? { resource: dto.resource } : {}),
        ...(dto.isShared !== undefined ? { isShared: dto.isShared } : {}),
        ...(dto.config !== undefined ? { config: dto.config } : {})
      }
    });
  }

  async removeTemplate(id: string, user: JwtUser) {
    const deleted = await this.prisma.reportTemplate.deleteMany({
      where: {
        id,
        createdById: user.sub
      }
    });

    return {
      success: deleted.count > 0
    };
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

    if (isStaff(user)) {
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

  private async loadDatasetRows(dataset: CustomReportQueryDto["dataset"], user: JwtUser) {
    switch (dataset) {
      case "customers": {
        const customers = await this.prisma.customer.findMany({
          where: this.buildCustomerWhere(user),
          include: {
            assignedTo: {
              select: {
                name: true
              }
            },
            _count: {
              select: {
                projects: true
              }
            }
          }
        });

        return customers.map((item) => ({
          id: item.id,
          name: item.name,
          status: item.status,
          industry: item.industry,
          assignedTo: item.assignedTo.name,
          isVip: item.isVip,
          projectCount: item._count.projects,
          createdAt: item.createdAt.toISOString()
        }));
      }
      case "projects": {
        const projects = await this.prisma.project.findMany({
          where: this.buildProjectWhere(user),
          include: {
            customer: {
              select: {
                name: true,
                assignedTo: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        });

        return projects.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          status: item.status,
          priority: item.priority,
          estimatedValue: Number(item.estimatedValue ?? 0),
          customerName: item.customer.name,
          assignedTo: item.customer.assignedTo.name,
          createdAt: item.createdAt.toISOString()
        }));
      }
      case "quotes": {
        const quotes = await this.prisma.quote.findMany({
          where: this.buildQuoteWhere(user),
          include: {
            createdBy: {
              select: {
                name: true
              }
            },
            project: {
              select: {
                name: true,
                customer: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        });

        return quotes.map((item) => ({
          id: item.id,
          quoteNo: item.quoteNo,
          status: item.status,
          total: Number(item.total),
          taxAmount: Number(item.taxAmount),
          createdBy: item.createdBy.name,
          projectName: item.project.name,
          customerName: item.project.customer.name,
          createdAt: item.createdAt.toISOString()
        }));
      }
      case "contracts": {
        const contracts = await this.prisma.contract.findMany({
          where: this.buildContractWhere(user),
          include: {
            project: {
              select: {
                name: true,
                customer: {
                  select: {
                    name: true,
                    assignedTo: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        });

        return contracts.map((item) => ({
          id: item.id,
          contractNo: item.contractNo,
          status: item.status,
          value: Number(item.value),
          projectName: item.project.name,
          customerName: item.project.customer.name,
          assignedTo: item.project.customer.assignedTo.name,
          createdAt: item.createdAt.toISOString()
        }));
      }
      case "activities": {
        const activities = await this.prisma.activity.findMany({
          where: {
            deletedAt: null,
            ...(isStaff(user) ? { customer: { assignedToId: user.sub } } : {})
          },
          include: {
            user: {
              select: {
                name: true
              }
            },
            customer: {
              select: {
                name: true
              }
            }
          }
        });

        return activities.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          isCompleted: item.isCompleted,
          scheduledAt: item.scheduledAt?.toISOString() ?? null,
          assignee: item.user.name,
          customerName: item.customer?.name ?? null,
          createdAt: item.createdAt.toISOString()
        }));
      }
      case "payments": {
        const payments = await this.prisma.payment.findMany({
          where: this.buildPaymentWhere(user, new Date(2000, 0, 1), new Date(2100, 0, 1)),
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
          }
        });

        return payments.map((item) => ({
          id: item.id,
          amount: Number(item.amount),
          paidAt: item.paidAt.toISOString(),
          method: item.method,
          contractNo: item.contract.contractNo,
          projectName: item.contract.project.name,
          customerName: item.contract.project.customer.name,
          createdAt: item.createdAt.toISOString()
        }));
      }
      default:
        return [];
    }
  }

  private matchesFilters(
    row: Record<string, unknown>,
    filters: Array<{ field: string; operator: string; value: unknown }>
  ) {
    return filters.every((filter) => {
      const currentValue = row[filter.field];

      switch (filter.operator) {
        case "eq":
          return currentValue === filter.value;
        case "neq":
          return currentValue !== filter.value;
        case "contains":
          return String(currentValue ?? "")
            .toLowerCase()
            .includes(String(filter.value ?? "").toLowerCase());
        case "gte":
          return Number(currentValue ?? 0) >= Number(filter.value ?? 0);
        case "lte":
          return Number(currentValue ?? 0) <= Number(filter.value ?? 0);
        case "in":
          return Array.isArray(filter.value) ? filter.value.includes(currentValue as never) : false;
        default:
          return true;
      }
    });
  }

  private aggregateRows(
    rows: Record<string, unknown>[],
    dimensions: string[],
    measures: Array<{ field: string; label: string; aggregator: "count" | "sum" }>
  ) {
    if (dimensions.length === 0) {
      return [
        measures.reduce<Record<string, unknown>>((acc, measure) => {
          acc[measure.label] =
            measure.aggregator === "count"
              ? rows.length
              : rows.reduce((sum, row) => sum + Number(row[measure.field] ?? 0), 0);
          return acc;
        }, {})
      ];
    }

    const groups = new Map<string, Record<string, unknown>>();

    for (const row of rows) {
      const groupKey = dimensions.map((dimension) => String(row[dimension] ?? "Chưa gán")).join(" / ");
      const current = groups.get(groupKey) ?? dimensions.reduce<Record<string, unknown>>((acc, dimension) => {
        acc[dimension] = row[dimension] ?? "Chưa gán";
        return acc;
      }, {});

      for (const measure of measures) {
        const currentValue = Number(current[measure.label] ?? 0);
        current[measure.label] =
          measure.aggregator === "count"
            ? currentValue + 1
            : currentValue + Number(row[measure.field] ?? 0);
      }

      groups.set(groupKey, current);
    }

    return Array.from(groups.values());
  }
}
