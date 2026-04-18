import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { ProjectFilterDto } from "./dto/project-filter.dto";

const ACTIVE_PROJECT_STATUSES = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "DELIVERING"] as const;
const CLOSED_PROJECT_STATUSES = ["LOST", "COMPLETED"] as const;
const DUE_SOON_WINDOW_DAYS = 30;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: ProjectFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters, user);
    const now = new Date();
    const dueSoonBoundary = new Date(now.getTime() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [projects, total, matchingProjects] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expectedEndDate: "asc" }, { updatedAt: "desc" }],
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              industry: true,
              status: true,
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  role: true
                }
              }
            }
          },
          contract: {
            select: {
              id: true,
              contractNo: true,
              value: true,
              status: true
            }
          },
          activities: {
            select: {
              updatedAt: true
            },
            orderBy: {
              updatedAt: "desc"
            },
            take: 1
          },
          _count: {
            select: {
              quotes: true,
              milestones: true,
              activities: true
            }
          }
        }
      }),
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        select: {
          id: true,
          status: true,
          estimatedValue: true,
          expectedEndDate: true
        }
      })
    ]);

    const summary = {
      pipelineValue: matchingProjects.reduce(
        (totalValue, project) => totalValue + Number(project.estimatedValue ?? 0),
        0
      ),
      activeProjects: matchingProjects.filter((project) =>
        ACTIVE_PROJECT_STATUSES.includes(project.status as (typeof ACTIVE_PROJECT_STATUSES)[number])
      ).length,
      deliveringProjects: matchingProjects.filter((project) => project.status === "DELIVERING").length,
      dueSoonProjects: matchingProjects.filter((project) => {
        const expectedEndDate = project.expectedEndDate;

        return Boolean(
          expectedEndDate &&
            expectedEndDate >= now &&
            expectedEndDate <= dueSoonBoundary &&
            !CLOSED_PROJECT_STATUSES.includes(project.status as (typeof CLOSED_PROJECT_STATUSES)[number])
        );
      }).length
    };

    return {
      items: projects.map((project) => ({
        id: project.id,
        code: project.code,
        name: project.name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        estimatedValue: Number(project.estimatedValue ?? 0),
        progressPercent: this.mapProjectProgress(project.status),
        startDate: project.startDate,
        expectedEndDate: project.expectedEndDate,
        updatedAt: project.updatedAt,
        lastActivityAt: project.activities[0]?.updatedAt ?? null,
        isOverdue: Boolean(
          project.expectedEndDate &&
            project.expectedEndDate < now &&
            !CLOSED_PROJECT_STATUSES.includes(project.status as (typeof CLOSED_PROJECT_STATUSES)[number])
        ),
        customer: {
          id: project.customer.id,
          name: project.customer.name,
          industry: project.customer.industry,
          status: project.customer.status,
          assignedTo: project.customer.assignedTo
        },
        contract: project.contract
          ? {
              id: project.contract.id,
              contractNo: project.contract.contractNo,
              value: Number(project.contract.value),
              status: project.contract.status
            }
          : null,
        quoteCount: project._count.quotes,
        milestoneCount: project._count.milestones,
        activityCount: project._count.activities
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        summary
      }
    };
  }

  async findOne(id: string, user: JwtUser) {
    const project = await this.findAccessibleProject(id, user);

    const [quotes, milestones, activities, contract] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where: {
          projectId: id
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }, { version: "desc" }]
      }),
      this.prisma.milestone.findMany({
        where: {
          projectId: id
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }]
      }),
      this.prisma.activity.findMany({
        where: {
          projectId: id
        },
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 12
      }),
      this.prisma.contract.findUnique({
        where: {
          projectId: id
        },
        include: {
          payments: {
            orderBy: {
              paidAt: "desc"
            }
          }
        }
      })
    ]);

    const paidAmount = contract
      ? contract.payments.reduce((total, payment) => total + Number(payment.amount), 0)
      : 0;
    const contractValue = Number(contract?.value ?? 0);
    const outstandingAmount = Math.max(0, contractValue - paidAmount);

    return {
      id: project.id,
      code: project.code,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      estimatedValue: Number(project.estimatedValue ?? 0),
      progressPercent: this.mapProjectProgress(project.status),
      startDate: project.startDate,
      expectedEndDate: project.expectedEndDate,
      notes: project.notes,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      stats: {
        quoteCount: quotes.length,
        milestoneCount: milestones.length,
        activityCount: activities.length,
        paidAmount,
        outstandingAmount,
        progressPercent: this.mapProjectProgress(project.status)
      },
      customer: {
        id: project.customer.id,
        name: project.customer.name,
        shortName: project.customer.shortName,
        industry: project.customer.industry,
        status: project.customer.status,
        address: project.customer.address,
        assignedTo: project.customer.assignedTo,
        primaryContact: project.customer.contacts[0]
          ? {
              id: project.customer.contacts[0].id,
              name: project.customer.contacts[0].name,
              title: project.customer.contacts[0].title,
              phone: project.customer.contacts[0].phone,
              email: project.customer.contacts[0].email
            }
          : null
      },
      contract: contract
        ? {
            id: contract.id,
            contractNo: contract.contractNo,
            status: contract.status,
            value: contractValue,
            signDate: contract.signDate,
            startDate: contract.startDate,
            endDate: contract.endDate,
            fileUrl: contract.fileUrl,
            notes: contract.notes,
            paidAmount,
            outstandingAmount,
            paymentCount: contract.payments.length,
            payments: contract.payments.map((payment) => ({
              id: payment.id,
              amount: Number(payment.amount),
              paidAt: payment.paidAt,
              method: payment.method,
              reference: payment.reference,
              notes: payment.notes
            }))
          }
        : null,
      quotes: quotes.map((quote) => ({
        id: quote.id,
        quoteNo: quote.quoteNo,
        version: quote.version,
        status: quote.status,
        total: Number(quote.total),
        validUntil: quote.validUntil,
        sentAt: quote.sentAt,
        acceptedAt: quote.acceptedAt,
        createdAt: quote.createdAt,
        createdBy: quote.createdBy
      })),
      milestones: milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        description: milestone.description,
        status: milestone.status,
        dueDate: milestone.dueDate,
        completedAt: milestone.completedAt,
        paymentAmount: Number(milestone.paymentAmount ?? 0),
        notes: milestone.notes
      })),
      activities: activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        content: activity.content,
        type: activity.type,
        scheduledAt: activity.scheduledAt,
        doneAt: activity.doneAt,
        isCompleted: activity.isCompleted,
        updatedAt: activity.updatedAt,
        user: activity.user
      }))
    };
  }

  private buildWhere(filters: Partial<ProjectFilterDto>, user: JwtUser): Prisma.ProjectWhereInput {
    const customerWhere: Prisma.CustomerWhereInput = {
      deletedAt: null
    };

    if (user.role === "STAFF") {
      customerWhere.assignedToId = user.sub;
    }

    if (filters.assignedToId && user.role !== "STAFF") {
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

  private async findAccessibleProject(id: string, user: JwtUser) {
    const project = await this.prisma.project.findFirst({
      where: {
        ...this.buildWhere({}, user),
        id
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            shortName: true,
            industry: true,
            status: true,
            address: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                role: true
              }
            },
            contacts: {
              where: {
                isPrimary: true
              },
              orderBy: {
                createdAt: "asc"
              },
              take: 1
            }
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException("Không tìm thấy dự án");
    }

    return project;
  }

  private mapProjectProgress(status: string) {
    switch (status) {
      case "SURVEY":
        return 15;
      case "QUOTING":
        return 35;
      case "NEGOTIATING":
        return 60;
      case "WON":
        return 75;
      case "DELIVERING":
        return 85;
      case "COMPLETED":
        return 100;
      default:
        return 0;
    }
  }
}
