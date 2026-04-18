import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectFilterDto } from "./dto/project-filter.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { UpdateProjectStatusDto } from "./dto/update-project-status.dto";

const ACTIVE_PROJECT_STATUSES = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "DELIVERING"] as const;
const CLOSED_PROJECT_STATUSES = ["LOST", "COMPLETED"] as const;
const DUE_SOON_WINDOW_DAYS = 30;
const KANBAN_PROJECT_STATUSES = [
  "SURVEY",
  "QUOTING",
  "NEGOTIATING",
  "WON",
  "DELIVERING",
  "COMPLETED",
  "LOST"
] as const;
const PROJECT_STATUS_LABELS = {
  SURVEY: "Khảo sát",
  QUOTING: "Báo giá",
  NEGOTIATING: "Đàm phán",
  WON: "Đã ký HĐ",
  LOST: "Không thành",
  DELIVERING: "Triển khai",
  COMPLETED: "Hoàn thành"
} as const;

const projectListInclude = {
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
      updatedAt: "desc" as const
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
} satisfies Prisma.ProjectInclude;

type ProjectListRecord = Prisma.ProjectGetPayload<{
  include: typeof projectListInclude;
}>;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: ProjectFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters, user);
    const view = filters.view ?? "list";
    const now = new Date();
    const dueSoonBoundary = new Date(now.getTime() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [total, matchingProjects] = await this.prisma.$transaction([
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

    const meta = {
      total,
      page: view === "kanban" ? 1 : page,
      limit: view === "kanban" ? total || limit : limit,
      totalPages: view === "kanban" ? 1 : Math.max(1, Math.ceil(total / limit)),
      summary
    };

    if (view === "kanban") {
      const projects = await this.prisma.project.findMany({
        where,
        orderBy: [{ expectedEndDate: "asc" }, { updatedAt: "desc" }],
        include: projectListInclude
      });

      const items = projects.map((project) => this.mapProjectListItem(project, now));

      return {
        data: KANBAN_PROJECT_STATUSES.map((status) => {
          const columnItems = items.filter((item) => item.status === status);

          return {
            key: status,
            label: PROJECT_STATUS_LABELS[status],
            itemCount: columnItems.length,
            totalValue: columnItems.reduce((totalValue, item) => totalValue + item.estimatedValue, 0),
            items: columnItems
          };
        }),
        meta
      };
    }

    const projects = await this.prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ expectedEndDate: "asc" }, { updatedAt: "desc" }],
      include: projectListInclude
    });

    return {
      items: projects.map((project) => this.mapProjectListItem(project, now)),
      meta
    };
  }

  async create(dto: CreateProjectDto, user: JwtUser) {
    await this.assertCustomerAccess(dto.customerId, user);

    const project = await this.prisma.project.create({
      data: {
        code: await this.generateProjectCode(),
        customerId: dto.customerId,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        estimatedValue: dto.estimatedValue ?? null,
        startDate: dto.startDate,
        expectedEndDate: dto.expectedEndDate,
        notes: dto.notes
      }
    });

    return {
      id: project.id,
      code: project.code
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

  async update(id: string, dto: UpdateProjectDto, user: JwtUser) {
    const project = await this.findAccessibleProjectRecord(id, user);
    const nextStartDate = dto.startDate ?? project.startDate;
    const nextExpectedEndDate = dto.expectedEndDate ?? project.expectedEndDate;

    if (nextStartDate && nextExpectedEndDate && nextExpectedEndDate.getTime() < nextStartDate.getTime()) {
      throw new BadRequestException("Ngày kết thúc dự kiến phải sau hoặc bằng ngày bắt đầu");
    }

    if (dto.customerId && dto.customerId !== project.customerId) {
      await this.assertCustomerAccess(dto.customerId, user);
    }

    const updatedProject = await this.prisma.project.update({
      where: {
        id
      },
      data: {
        ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.estimatedValue !== undefined ? { estimatedValue: dto.estimatedValue } : {}),
        ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
        ...(dto.expectedEndDate !== undefined ? { expectedEndDate: dto.expectedEndDate } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {})
      }
    });

    return {
      id: updatedProject.id
    };
  }

  async updateStatus(id: string, dto: UpdateProjectStatusDto, user: JwtUser) {
    await this.findAccessibleProjectRecord(id, user);

    const updatedProject = await this.prisma.project.update({
      where: {
        id
      },
      data: {
        status: dto.status
      }
    });

    return {
      id: updatedProject.id,
      status: updatedProject.status
    };
  }

  async remove(id: string, user: JwtUser) {
    const project = await this.findAccessibleProjectRecord(id, user);

    if (project.contract) {
      throw new BadRequestException("Không thể xóa dự án đã có hợp đồng");
    }

    await this.prisma.project.update({
      where: {
        id
      },
      data: {
        deletedAt: new Date()
      }
    });

    return {
      success: true
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

  private mapProjectListItem(project: ProjectListRecord, now: Date) {
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
    };
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

  private async findAccessibleProjectRecord(id: string, user: JwtUser) {
    const project = await this.prisma.project.findFirst({
      where: {
        ...this.buildWhere({}, user),
        id
      },
      select: {
        id: true,
        customerId: true,
        startDate: true,
        expectedEndDate: true,
        contract: {
          select: {
            id: true
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException("Không tìm thấy dự án");
    }

    return project;
  }

  private async assertCustomerAccess(customerId: string, user: JwtUser) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        deletedAt: null,
        ...(user.role === "STAFF" ? { assignedToId: user.sub } : {})
      },
      select: {
        id: true
      }
    });

    if (!customer) {
      throw new NotFoundException("Không tìm thấy khách hàng để gắn dự án");
    }
  }

  private async generateProjectCode() {
    const projects = await this.prisma.project.findMany({
      where: {
        code: {
          startsWith: "AHSO-"
        }
      },
      select: {
        code: true
      }
    });

    const maxNumber = projects.reduce((currentMax, project) => {
      const match = project.code.match(/AHSO-(\d+)/);
      const nextValue = match ? Number(match[1]) : 0;
      return Number.isFinite(nextValue) ? Math.max(currentMax, nextValue) : currentMax;
    }, 0);

    return `AHSO-${String(maxNumber + 1).padStart(3, "0")}`;
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
