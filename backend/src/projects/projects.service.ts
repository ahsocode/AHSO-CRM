import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DocumentType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { DocumentsService } from "../documents/documents.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { CreatePaymentDto } from "../contracts/dto/create-payment.dto";
import { BulkProjectDto } from "./dto/bulk-project.dto";
import { CreateProjectHandoverDto } from "./dto/create-project-handover.dto";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectFilterDto } from "./dto/project-filter.dto";
import { GenerateProjectDocumentPlanDto, UpdateProjectDocumentPlanDto } from "./dto/project-document-plan.dto";
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
const PROJECT_DOCUMENT_ENTITY: Record<DocumentType, "quote" | "project" | "contract" | "customer"> = {
  QUOTATION: "quote",
  PROPOSAL: "project",
  SURVEY_REPORT: "project",
  CONTRACT: "contract",
  CONTRACT_ADDENDUM: "contract",
  NDA: "customer",
  DELIVERY_NOTE: "contract",
  DOC_HANDOVER: "contract",
  INSTALLATION_REPORT: "contract",
  ACCEPTANCE_REPORT: "contract",
  PARTIAL_ACCEPTANCE: "contract",
  WARRANTY_CERT: "contract",
  MAINTENANCE_RECORD: "contract",
  PAYMENT_REQUEST: "contract",
  PAYMENT_RECEIPT: "contract",
  AR_RECONCILIATION: "customer"
};

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
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customFieldsService: CustomFieldsService,
    private readonly domainEvents: DomainEventsService,
    private readonly documentsService: DocumentsService
  ) {}

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
          completedAt: true,
          contract: {
            select: {
              value: true
            }
          },
          expectedEndDate: true
        }
      })
    ]);

    const activeProjects = matchingProjects.filter((project) =>
      ACTIVE_PROJECT_STATUSES.includes(project.status as (typeof ACTIVE_PROJECT_STATUSES)[number])
    );

    const summary = {
      pipelineValue: activeProjects.reduce(
        (totalValue, project) => totalValue + this.resolveProjectCommercialValue(project),
        0
      ),
      activeProjects: activeProjects.length,
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
        completedAt: dto.status === "COMPLETED" ? dto.completedAt ?? new Date() : null,
        notes: dto.notes
      }
    });

    await this.customFieldsService.saveValues("project", project.id, dto.customFieldValues);

    void Promise.resolve(this.domainEvents
      .emit("project.created", {
        projectId: project.id,
        code: project.code,
        customerId: dto.customerId,
        status: project.status,
        estimatedValue: Number(project.estimatedValue ?? 0)
      }))
      .catch((err: unknown) =>
        this.logger.error("Domain event handler failed", { event: "project.created", err })
      );

    return {
      id: project.id,
      code: project.code
    };
  }

  async findOne(id: string, user: JwtUser) {
    const project = await this.findAccessibleProject(id, user);
    const customFieldValues = await this.customFieldsService.getValues("project", id);

    const [quotes, milestones, activities, contract, payments] = await this.prisma.$transaction([
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
      }),
      this.prisma.payment.findMany({
        where: {
          projectId: id
        },
        include: {
          contract: {
            select: {
              id: true,
              contractNo: true
            }
          },
          quote: {
            select: {
              id: true,
              quoteNo: true
            }
          }
        },
        orderBy: {
          paidAt: "desc"
        }
      })
    ]);

    const paidAmount = payments.reduce((total, payment) => total + Number(payment.amount), 0);
    const contractPaidAmount = contract
      ? contract.payments.reduce((total, payment) => total + Number(payment.amount), 0)
      : 0;
    const contractValue = Number(contract?.value ?? 0);
    const projectValue = contract ? contractValue : Number(project.estimatedValue ?? 0);
    const outstandingAmount = projectValue > 0 ? Math.max(0, projectValue - paidAmount) : 0;

    return {
      id: project.id,
      code: project.code,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      estimatedValue: projectValue,
      progressPercent: this.mapProjectProgress(project.status),
      startDate: project.startDate,
      expectedEndDate: project.expectedEndDate,
      completedAt: project.completedAt,
      notes: project.notes,
      customFieldValues,
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
      projectContact: project.contact ?? null,
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
            paidAmount: contractPaidAmount,
            outstandingAmount: Math.max(0, contractValue - contractPaidAmount),
            paymentCount: contract.payments.length,
            payments: contract.payments.map((payment) => ({
              id: payment.id,
              amount: Number(payment.amount),
              paidAt: payment.paidAt,
              method: payment.method,
              reference: payment.reference,
              notes: payment.notes,
              projectId: id,
              contractId: contract.id,
              quoteId: null,
              sourceType: "contract",
              sourceLabel: contract.contractNo
            }))
          }
        : null,
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        paidAt: payment.paidAt,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        projectId: id,
        contractId: payment.contractId,
        quoteId: payment.quoteId,
        sourceType: payment.contractId ? "contract" : payment.quoteId ? "quote" : "project",
        sourceLabel: payment.contract?.contractNo ?? payment.quote?.quoteNo ?? project.code
      })),
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

  async getOverview360(id: string, user: JwtUser) {
    const project = await this.findOne(id, user);
    const now = new Date();

    const [nextActivity, latestSurvey, latestDocuments, handovers, openMilestones] = await this.prisma.$transaction([
      this.prisma.activity.findFirst({
        where: {
          projectId: id,
          isCompleted: false,
          deletedAt: null,
          OR: [{ scheduledAt: { gte: now } }, { scheduledAt: null }]
        },
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [{ scheduledAt: "asc" }, { updatedAt: "desc" }]
      }),
      this.prisma.survey.findFirst({
        where: {
          projectId: id
        },
        include: {
          media: {
            orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
            take: 4
          },
          notes: {
            orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
            take: 3
          }
        },
        orderBy: [{ surveyedAt: "desc" }, { createdAt: "desc" }]
      }),
      this.prisma.businessDocument.findMany({
        where: {
          OR: [
            { projectId: id },
            { quote: { projectId: id } },
            { contract: { projectId: id } },
            { payment: { projectId: id } }
          ]
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
        take: 5
      }),
      this.prisma.projectHandover.findMany({
        where: {
          projectId: id
        },
        include: {
          fromUser: {
            select: {
              id: true,
              name: true
            }
          },
          toUser: {
            select: {
              id: true,
              name: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 3
      }),
      this.prisma.milestone.findMany({
        where: {
          projectId: id,
          status: {
            in: ["PENDING", "IN_PROGRESS", "DONE"]
          }
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        take: 5
      })
    ]);

    return {
      project,
      nextActivity: nextActivity
        ? {
            id: nextActivity.id,
            title: nextActivity.title,
            type: nextActivity.type,
            scheduledAt: nextActivity.scheduledAt,
            user: nextActivity.user
          }
        : null,
      latestSurvey: latestSurvey
        ? {
            id: latestSurvey.id,
            title: latestSurvey.title,
            surveyedAt: latestSurvey.surveyedAt,
            location: latestSurvey.location,
            summary: latestSurvey.summary,
            nextStep: latestSurvey.nextStep,
            media: latestSurvey.media.map((media) => ({
              id: media.id,
              kind: media.kind,
              url: media.url,
              caption: media.caption,
              area: media.area,
              isImportant: media.isImportant
            })),
            notes: latestSurvey.notes.map((note) => ({
              id: note.id,
              type: note.type,
              content: note.content,
              isImportant: note.isImportant,
              createdAt: note.createdAt
            }))
          }
        : null,
      importantDocuments: latestDocuments.map((document) => this.mapBusinessDocumentSummary(document)),
      openMilestones: openMilestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        status: milestone.status,
        dueDate: milestone.dueDate,
        paymentAmount: Number(milestone.paymentAmount ?? 0)
      })),
      paymentSnapshot: project.contract
        ? {
            contractValue: project.contract.value,
            paidAmount: project.contract.paidAmount,
            outstandingAmount: project.contract.outstandingAmount,
            paymentCount: project.contract.paymentCount
          }
        : null,
      handovers: handovers.map((handover) => this.mapHandover(handover))
    };
  }

  async getTimeline(id: string, user: JwtUser) {
    await this.findAccessibleProjectRecord(id, user);
    const [activities, surveys, quotes, contract, payments, documents, milestones, handovers] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        where: {
          projectId: id,
          deletedAt: null
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
        take: 80
      }),
      this.prisma.survey.findMany({
        where: {
          projectId: id
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              media: true,
              notes: true
            }
          }
        },
        orderBy: [{ surveyedAt: "desc" }, { createdAt: "desc" }]
      }),
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
        orderBy: {
          createdAt: "desc"
        }
      }),
      this.prisma.contract.findUnique({
        where: {
          projectId: id
        }
      }),
      this.prisma.payment.findMany({
        where: {
          projectId: id
        },
        include: {
          contract: {
            select: {
              id: true,
              contractNo: true
            }
          },
          quote: {
            select: {
              id: true,
              quoteNo: true
            }
          }
        },
        orderBy: {
          paidAt: "desc"
        }
      }),
      this.prisma.businessDocument.findMany({
        where: {
          OR: [
            { projectId: id },
            { quote: { projectId: id } },
            { contract: { projectId: id } },
            { payment: { projectId: id } }
          ]
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }]
      }),
      this.prisma.milestone.findMany({
        where: {
          projectId: id
        },
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }]
      }),
      this.prisma.projectHandover.findMany({
        where: {
          projectId: id
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true
            }
          },
          fromUser: {
            select: {
              id: true,
              name: true
            }
          },
          toUser: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      })
    ]);

    const items = [
      ...activities.map((activity) => ({
        id: `activity:${activity.id}`,
        type: "activity",
        title: activity.title,
        description: activity.content,
        happenedAt: activity.doneAt ?? activity.scheduledAt ?? activity.updatedAt,
        actorName: activity.user.name,
        link: `/activities?projectId=${id}`,
        meta: {
          activityType: activity.type,
          isCompleted: activity.isCompleted
        }
      })),
      ...surveys.map((survey) => ({
        id: `survey:${survey.id}`,
        type: "survey",
        title: survey.title,
        description: survey.summary ?? survey.location,
        happenedAt: survey.surveyedAt ?? survey.createdAt,
        actorName: survey.createdBy.name,
        link: `/projects/${id}?tab=surveys`,
        meta: {
          mediaCount: survey._count.media,
          noteCount: survey._count.notes
        }
      })),
      ...quotes.map((quote) => ({
        id: `quote:${quote.id}`,
        type: "quote",
        title: `Báo giá ${quote.quoteNo} v${quote.version}`,
        description: `Trạng thái ${quote.status}, giá trị ${Number(quote.total).toLocaleString("vi-VN")} VND`,
        happenedAt: quote.acceptedAt ?? quote.sentAt ?? quote.createdAt,
        actorName: quote.createdBy.name,
        link: `/quotes/${quote.id}`,
        meta: {
          status: quote.status,
          total: Number(quote.total)
        }
      })),
      ...(contract
        ? [
            {
              id: `contract:${contract.id}`,
              type: "contract",
              title: `Hợp đồng ${contract.contractNo}`,
              description: `Trạng thái ${contract.status}, giá trị ${Number(contract.value).toLocaleString("vi-VN")} VND`,
              happenedAt: contract.signDate ?? contract.createdAt,
              actorName: null,
              link: `/contracts/${contract.id}`,
              meta: {
                status: contract.status,
                value: Number(contract.value)
              }
            }
          ]
        : []),
      ...payments.map((payment) => ({
        id: `payment:${payment.id}`,
        type: "payment",
        title: `Thanh toán ${Number(payment.amount).toLocaleString("vi-VN")} VND`,
        description: payment.reference ?? payment.method ?? payment.notes ?? payment.contract?.contractNo ?? payment.quote?.quoteNo,
        happenedAt: payment.paidAt,
        actorName: null,
        link: payment.contract ? `/contracts/${payment.contract.id}` : `/projects/${id}?tab=payments`,
        meta: {
          amount: Number(payment.amount),
          source: payment.contract?.contractNo ?? payment.quote?.quoteNo ?? "Dự án"
        }
      })),
      ...documents.map((document) => ({
        id: `document:${document.id}`,
        type: "document",
        title: document.title,
        description: `${document.type} · ${document.status}`,
        happenedAt: document.documentDate ?? document.createdAt,
        actorName: document.createdBy.name,
        link: document.fileUrl ?? `/projects/${id}?tab=documents`,
        meta: {
          documentType: document.type,
          status: document.status,
          source: document.source
        }
      })),
      ...milestones.map((milestone) => ({
        id: `milestone:${milestone.id}`,
        type: "milestone",
        title: milestone.name,
        description: milestone.description ?? milestone.notes,
        happenedAt: milestone.completedAt ?? milestone.dueDate ?? milestone.createdAt,
        actorName: null,
        link: `/projects/${id}?tab=delivery`,
        meta: {
          status: milestone.status,
          paymentAmount: Number(milestone.paymentAmount ?? 0)
        }
      })),
      ...handovers.map((handover) => ({
        id: `handover:${handover.id}`,
        type: "handover",
        title: "Bàn giao dự án",
        description: handover.summary,
        happenedAt: handover.createdAt,
        actorName: handover.createdBy.name,
        link: `/projects/${id}?tab=handover`,
        meta: {
          fromUser: handover.fromUser?.name ?? null,
          toUser: handover.toUser?.name ?? null
        }
      }))
    ];

    return items
      .filter((item) => item.happenedAt)
      .sort((first, second) => new Date(second.happenedAt).getTime() - new Date(first.happenedAt).getTime());
  }

  async getDocuments(id: string, user: JwtUser) {
    await this.findAccessibleProjectRecord(id, user);

    const [businessDocuments, projectLinks, documentRequirements] = await this.prisma.$transaction([
      this.prisma.businessDocument.findMany({
        where: {
          OR: [
            { projectId: id },
            { quote: { projectId: id } },
            { contract: { projectId: id } },
            { payment: { projectId: id } }
          ]
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              shortName: true
            }
          },
          project: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          quote: {
            select: {
              id: true,
              quoteNo: true,
              version: true
            }
          },
          contract: {
            select: {
              id: true,
              contractNo: true
            }
          },
          payment: {
            select: {
              id: true,
              amount: true,
              paidAt: true
            }
          },
          generatedDocument: {
            select: {
              id: true,
              number: true,
              pdfPath: true
            }
          },
          parent: {
            select: {
              id: true,
              title: true,
              status: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }]
      }),
      this.prisma.project.findUnique({
        where: {
          id
        },
        select: {
          customerId: true,
          quotes: {
            select: {
              id: true
            }
          },
          contract: {
            select: {
              id: true
            }
          },
          payments: {
            select: {
              id: true
            }
          }
        }
      }),
      this.prisma.projectDocumentRequirement.findMany({
        where: {
          projectId: id,
          isRequired: true
        },
        orderBy: {
          createdAt: "asc"
        }
      })
    ]);

    const entityIds = [
      id,
      ...(projectLinks?.customerId ? [projectLinks.customerId] : []),
      ...(projectLinks?.quotes.map((quote) => quote.id) ?? []),
      ...(projectLinks?.contract ? [projectLinks.contract.id] : []),
      ...(projectLinks?.payments.map((payment) => payment.id) ?? [])
    ];

    const generatedDocuments = entityIds.length
      ? await this.prisma.document.findMany({
          where: {
            entityId: {
              in: entityIds
            }
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: [{ renderedAt: "desc" }, { createdAt: "desc" }]
        })
      : [];

    return {
      businessDocuments: businessDocuments.map((document) => this.mapBusinessDocument(document)),
      documentPlan: {
        requiredTypes: documentRequirements.map((requirement) => requirement.type)
      },
      generatedDocuments: generatedDocuments.map((document) => ({
        id: document.id,
        type: document.type,
        number: document.number,
        version: document.version,
        language: document.language,
        entityType: document.entityType,
        entityId: document.entityId,
        customerId: document.customerId,
        pdfPath: document.pdfPath,
        renderedAt: document.renderedAt,
        createdAt: document.createdAt,
        createdBy: document.createdBy
      }))
    };
  }

  async updateDocumentPlan(id: string, dto: UpdateProjectDocumentPlanDto, user: JwtUser) {
    await this.findAccessibleProjectRecord(id, user);

    const requiredTypes = Array.from(new Set(dto.requiredTypes));

    await this.prisma.$transaction(async (tx) => {
      await tx.projectDocumentRequirement.deleteMany({
        where: {
          projectId: id,
          ...(requiredTypes.length > 0 ? { type: { notIn: requiredTypes } } : {})
        }
      });

      await Promise.all(
        requiredTypes.map((type) =>
          tx.projectDocumentRequirement.upsert({
            where: {
              projectId_type: {
                projectId: id,
                type
              }
            },
            create: {
              projectId: id,
              type,
              isRequired: true
            },
            update: {
              isRequired: true
            }
          })
        )
      );
    });

    return this.getDocuments(id, user);
  }

  async generateDocumentPlan(id: string, dto: GenerateProjectDocumentPlanDto, user: JwtUser) {
    const project = await this.getProjectDocumentSources(id, user);
    const requirements = await this.prisma.projectDocumentRequirement.findMany({
      where: {
        projectId: id,
        isRequired: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const generated: Array<{
      type: DocumentType;
      documentId: string;
      number: string;
      downloadUrl: string;
    }> = [];
    const skipped: Array<{ type: DocumentType; reason: string; documentId?: string; number?: string }> = [];
    const failed: Array<{ type: DocumentType; reason: string }> = [];

    for (const requirement of requirements) {
      const source = this.resolveProjectDocumentSource(project, requirement.type);
      if (!source.entityId) {
        skipped.push({
          type: requirement.type,
          reason: source.missingReason
        });
        continue;
      }

      if (dto.mode === "missing") {
        const existing = await this.prisma.document.findFirst({
          where: {
            type: requirement.type,
            entityType: source.entityType,
            entityId: source.entityId,
            language: "vi"
          },
          orderBy: [{ renderedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            number: true
          }
        });

        if (existing) {
          skipped.push({
            type: requirement.type,
            reason: "Đã có tài liệu được sinh trước đó.",
            documentId: existing.id,
            number: existing.number
          });
          continue;
        }
      }

      try {
        const result = await this.documentsService.renderPdf(
          requirement.type,
          source.entityId,
          "vi",
          undefined,
          undefined,
          user
        );

        generated.push({
          type: requirement.type,
          documentId: result.documentId,
          number: result.number,
          downloadUrl: result.downloadUrl
        });
      } catch (error) {
        failed.push({
          type: requirement.type,
          reason: error instanceof Error ? error.message : "Không sinh được tài liệu."
        });
      }
    }

    return {
      generated,
      skipped,
      failed
    };
  }

  async getSurveys(id: string, user: JwtUser) {
    await this.findAccessibleProjectRecord(id, user);

    const surveys = await this.prisma.survey.findMany({
      where: {
        projectId: id
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            shortName: true
          }
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        media: {
          orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }]
        },
        notes: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }]
        },
        _count: {
          select: {
            media: true,
            notes: true
          }
        }
      },
      orderBy: [{ surveyedAt: "desc" }, { createdAt: "desc" }]
    });

    return surveys.map((survey) => ({
      id: survey.id,
      title: survey.title,
      surveyedAt: survey.surveyedAt,
      location: survey.location,
      customerParticipants: survey.customerParticipants,
      objectives: survey.objectives,
      summary: survey.summary,
      nextStep: survey.nextStep,
      customerId: survey.customerId,
      projectId: survey.projectId,
      createdAt: survey.createdAt,
      updatedAt: survey.updatedAt,
      customer: survey.customer,
      project: survey.project,
      createdBy: survey.createdBy,
      media: survey.media,
      notes: survey.notes.map((note) => ({
        id: note.id,
        surveyId: note.surveyId,
        type: note.type,
        content: note.content,
        isImportant: note.isImportant,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        createdBy: note.createdBy
      })),
      counts: {
        media: survey._count.media,
        notes: survey._count.notes
      }
    }));
  }

  async createHandover(id: string, dto: CreateProjectHandoverDto, user: JwtUser) {
    await this.findAccessibleProjectRecord(id, user);

    const handover = await this.prisma.projectHandover.create({
      data: {
        projectId: id,
        summary: dto.summary,
        customerRequirements: dto.customerRequirements,
        risks: dto.risks,
        decisions: dto.decisions,
        openTasks: dto.openTasks,
        importantDocumentIds: dto.importantDocumentIds,
        fromUserId: dto.fromUserId,
        toUserId: dto.toUserId,
        createdById: user.sub
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true
          }
        },
        toUser: {
          select: {
            id: true,
            name: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return this.mapHandover(handover);
  }

  async createPayment(id: string, dto: CreatePaymentDto, user: JwtUser) {
    if (dto.contractId && dto.quoteId) {
      throw new BadRequestException("Chỉ chọn một nguồn thu: hợp đồng hoặc báo giá");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: {
          ...this.buildWhere({}, user),
          id
        },
        select: {
          id: true,
          code: true,
          name: true,
          estimatedValue: true,
          payments: {
            select: {
              amount: true
            }
          },
          customer: {
            select: {
              assignedTo: {
                select: {
                  id: true
                }
              }
            }
          }
        }
      });

      if (!project) {
        throw new NotFoundException("Không tìm thấy dự án");
      }

      let contractId: string | null = null;
      let quoteId: string | null = null;
      let sourceType: "contract" | "quote" | "project" = "project";
      let sourceLabel = project.code;

      if (dto.contractId) {
        const contract = await tx.contract.findFirst({
          where: {
            id: dto.contractId,
            projectId: id,
            deletedAt: null
          },
          select: {
            id: true,
            contractNo: true,
            value: true,
            payments: {
              select: {
                amount: true
              }
            }
          }
        });

        if (!contract) {
          throw new BadRequestException("Hợp đồng không thuộc dự án này hoặc đã bị xóa");
        }

        this.assertPaymentLimit({
          currentPaid: contract.payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
          nextAmount: dto.amount,
          limit: Number(contract.value),
          sourceLabel: `hợp đồng ${contract.contractNo}`
        });

        contractId = contract.id;
        sourceType = "contract";
        sourceLabel = contract.contractNo;
      } else if (dto.quoteId) {
        const quote = await tx.quote.findFirst({
          where: {
            id: dto.quoteId,
            projectId: id,
            deletedAt: null
          },
          select: {
            id: true,
            quoteNo: true,
            total: true,
            payments: {
              select: {
                amount: true
              }
            }
          }
        });

        if (!quote) {
          throw new BadRequestException("Báo giá không thuộc dự án này hoặc đã bị xóa");
        }

        this.assertPaymentLimit({
          currentPaid: quote.payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
          nextAmount: dto.amount,
          limit: Number(quote.total),
          sourceLabel: `báo giá ${quote.quoteNo}`
        });

        quoteId = quote.id;
        sourceType = "quote";
        sourceLabel = quote.quoteNo;
      } else {
        const projectValue = Number(project.estimatedValue ?? 0);

        if (projectValue > 0) {
          this.assertPaymentLimit({
            currentPaid: project.payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
            nextAmount: dto.amount,
            limit: projectValue,
            sourceLabel: `dự án ${project.code}`
          });
        }
      }

      const payment = await tx.payment.create({
        data: {
          amount: dto.amount,
          paidAt: dto.paidAt,
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
          projectId: project.id,
          contractId,
          quoteId
        }
      });

      return {
        payment,
        projectId: project.id,
        projectCode: project.code,
        ownerUserId: project.customer.assignedTo.id,
        contractId,
        quoteId,
        sourceType,
        sourceLabel
      };
    });

    void Promise.resolve(this.domainEvents
      .emit("payment.received", {
        paymentId: result.payment.id,
        projectId: result.projectId,
        contractId: result.contractId,
        quoteId: result.quoteId,
        ownerUserId: result.ownerUserId,
        contractNo: result.sourceType === "contract" ? result.sourceLabel : undefined,
        sourceLabel: result.sourceLabel,
        amount: Number(result.payment.amount),
        paidAt: result.payment.paidAt,
        method: result.payment.method
      }))
      .catch((err: unknown) =>
        this.logger.error("Domain event handler failed", { event: "payment.received", err })
      );

    return {
      id: result.payment.id,
      amount: Number(result.payment.amount),
      paidAt: result.payment.paidAt,
      method: result.payment.method,
      reference: result.payment.reference,
      notes: result.payment.notes,
      projectId: result.projectId,
      contractId: result.contractId,
      quoteId: result.quoteId,
      sourceType: result.sourceType,
      sourceLabel: result.sourceLabel
    };
  }

  async update(id: string, dto: UpdateProjectDto, user: JwtUser) {
    const project = await this.findAccessibleProjectRecord(id, user);
    const nextStartDate = dto.startDate ?? project.startDate;
    const nextExpectedEndDate = dto.expectedEndDate ?? project.expectedEndDate;
    const nextStatus = dto.status ?? project.status;
    const nextCompletedAt = this.resolveNextCompletedAt({
      currentStatus: project.status,
      nextStatus,
      currentCompletedAt: project.completedAt,
      providedCompletedAt: dto.completedAt,
      statusWasProvided: dto.status !== undefined,
      completedAtWasProvided: dto.completedAt !== undefined
    });

    if (nextStartDate && nextExpectedEndDate && nextExpectedEndDate.getTime() < nextStartDate.getTime()) {
      throw new BadRequestException("Ngày kết thúc dự kiến phải sau hoặc bằng ngày bắt đầu");
    }

    if (nextStartDate && nextCompletedAt && nextCompletedAt.getTime() < nextStartDate.getTime()) {
      throw new BadRequestException("Ngày hoàn thành phải sau hoặc bằng ngày bắt đầu");
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
        ...this.buildCompletedAtUpdate({
          statusWasProvided: dto.status !== undefined,
          completedAtWasProvided: dto.completedAt !== undefined,
          nextStatus,
          nextCompletedAt
        }),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {})
      }
    });

    await this.customFieldsService.saveValues("project", updatedProject.id, dto.customFieldValues);

    return {
      id: updatedProject.id
    };
  }

  async updateStatus(id: string, dto: UpdateProjectStatusDto, user: JwtUser) {
    const project = await this.findAccessibleProjectRecord(id, user);
    const completedAt = this.resolveNextCompletedAt({
      currentStatus: project.status,
      nextStatus: dto.status,
      currentCompletedAt: project.completedAt,
      providedCompletedAt: dto.completedAt,
      statusWasProvided: true,
      completedAtWasProvided: dto.completedAt !== undefined
    });

    const updatedProject = await this.prisma.project.update({
      where: {
        id
      },
      data: {
        status: dto.status,
        completedAt
      }
    });

    if (project.status !== updatedProject.status) {
      void Promise.resolve(this.domainEvents
        .emit("project.status_changed", {
          projectId: updatedProject.id,
          previousStatus: project.status,
          status: updatedProject.status
        }))
        .catch((err: unknown) =>
          this.logger.error("Domain event handler failed", { event: "project.status_changed", err })
        );
    }

    return {
      id: updatedProject.id,
      status: updatedProject.status,
      completedAt: updatedProject.completedAt
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

  async restore(id: string, user: JwtUser) {
    const project = await this.findDeletedAccessibleProjectRecord(id, user);

    if (!project.deletedAt) {
      throw new BadRequestException("Dự án chưa bị xóa");
    }

    const restored = await this.prisma.project.update({
      where: {
        id
      },
      data: {
        deletedAt: null
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        deletedAt: true
      }
    });

    return restored;
  }

  async findDeleted(filters: ProjectFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const now = new Date();
    const where = this.buildDeletedWhere(filters, user);

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          deletedAt: "desc"
        },
        include: projectListInclude
      }),
      this.prisma.project.count({ where })
    ]);

    return {
      items: projects.map((project) => ({
        ...this.mapProjectListItem(project, now),
        deletedAt: project.deletedAt
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async bulk(dto: BulkProjectDto, user: JwtUser) {
    const projects = await this.prisma.project.findMany({
      where: {
        ...this.buildWhere({}, user),
        id: {
          in: dto.ids
        }
      },
      include: projectListInclude
    });

    if (dto.action === "export") {
      return {
        action: dto.action,
        items: projects.map((project) => this.mapProjectListItem(project, new Date()))
      };
    }

    if (dto.action === "status" && dto.status) {
      const results = await Promise.allSettled(
        projects.map((project) =>
          this.updateStatus(project.id, { status: dto.status! }, user)
        )
      );

      return this.mapBulkMutationResult(dto.action, projects, results);
    }

    if (dto.action === "delete") {
      const results = await Promise.allSettled(projects.map((project) => this.remove(project.id, user)));
      return this.mapBulkMutationResult(dto.action, projects, results);
    }

    return {
      action: dto.action,
      processedCount: projects.length
    };
  }

  private mapBulkMutationResult(
    action: BulkProjectDto["action"],
    projects: Array<{ id: string; name: string }>,
    results: PromiseSettledResult<unknown>[]
  ) {
    const errors = results.flatMap((result, index) => {
      if (result.status === "fulfilled") {
        return [];
      }

      const project = projects[index];
      const reason = result.reason instanceof Error ? result.reason.message : "Không thể xử lý dự án";
      return [{
        id: project?.id,
        name: project?.name,
        message: reason
      }];
    });
    const processedCount = results.length - errors.length;

    if (results.length > 0 && processedCount === 0) {
      throw new BadRequestException("Không xử lý được dự án nào trong danh sách đã chọn.");
    }

    return {
      action,
      processedCount,
      failedCount: errors.length,
      errors
    };
  }

  private mapBusinessDocumentSummary(document: {
    id: string;
    type: string;
    source: string;
    status: string;
    title: string;
    documentNo: string | null;
    documentDate: Date | null;
    fileUrl: string | null;
    createdAt: Date;
    createdBy: { id: string; name: string };
  }) {
    return {
      id: document.id,
      type: document.type,
      source: document.source,
      status: document.status,
      title: document.title,
      documentNo: document.documentNo,
      documentDate: document.documentDate,
      fileUrl: document.fileUrl,
      createdAt: document.createdAt,
      createdBy: document.createdBy
    };
  }

  private mapBusinessDocument(document: {
    id: string;
    type: string;
    source: string;
    status: string;
    title: string;
    documentNo: string | null;
    documentDate: Date | null;
    fileUrl: string | null;
    filename: string | null;
    mimeType: string | null;
    size: number | null;
    notes: string | null;
    customerId: string | null;
    projectId: string | null;
    quoteId: string | null;
    contractId: string | null;
    paymentId: string | null;
    generatedDocumentId: string | null;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    customer: { id: string; name: string; shortName: string | null } | null;
    project: { id: string; code: string; name: string } | null;
    quote: { id: string; quoteNo: string; version: number } | null;
    contract: { id: string; contractNo: string } | null;
    payment: { id: string; amount: Prisma.Decimal; paidAt: Date } | null;
    generatedDocument: { id: string; number: string; pdfPath: string | null } | null;
    parent: { id: string; title: string; status: string } | null;
    createdBy: { id: string; name: string };
  }) {
    return {
      id: document.id,
      type: document.type,
      source: document.source,
      status: document.status,
      title: document.title,
      documentNo: document.documentNo,
      documentDate: document.documentDate,
      fileUrl: document.fileUrl,
      filename: document.filename,
      mimeType: document.mimeType,
      size: document.size,
      notes: document.notes,
      customerId: document.customerId,
      projectId: document.projectId,
      quoteId: document.quoteId,
      contractId: document.contractId,
      paymentId: document.paymentId,
      generatedDocumentId: document.generatedDocumentId,
      parentId: document.parentId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      customer: document.customer,
      project: document.project,
      quote: document.quote,
      contract: document.contract,
      payment: document.payment
        ? {
            ...document.payment,
            amount: Number(document.payment.amount)
          }
        : null,
      generatedDocument: document.generatedDocument,
      parent: document.parent,
      createdBy: document.createdBy
    };
  }

  private mapHandover(handover: {
    id: string;
    projectId: string;
    summary: string | null;
    customerRequirements: string | null;
    risks: string | null;
    decisions: string | null;
    openTasks: string | null;
    importantDocumentIds: string[];
    fromUserId: string | null;
    toUserId: string | null;
    createdById: string;
    createdAt: Date;
    fromUser: { id: string; name: string } | null;
    toUser: { id: string; name: string } | null;
    createdBy: { id: string; name: string };
  }) {
    return {
      id: handover.id,
      projectId: handover.projectId,
      summary: handover.summary,
      customerRequirements: handover.customerRequirements,
      risks: handover.risks,
      decisions: handover.decisions,
      openTasks: handover.openTasks,
      importantDocumentIds: handover.importantDocumentIds,
      fromUserId: handover.fromUserId,
      toUserId: handover.toUserId,
      createdById: handover.createdById,
      createdAt: handover.createdAt,
      fromUser: handover.fromUser,
      toUser: handover.toUser,
      createdBy: handover.createdBy
    };
  }

  private assertPaymentLimit({
    currentPaid,
    nextAmount,
    limit,
    sourceLabel
  }: {
    currentPaid: number;
    nextAmount: number;
    limit: number;
    sourceLabel: string;
  }) {
    const nextPaidAmount = currentPaid + nextAmount;

    if (nextPaidAmount > limit) {
      throw new BadRequestException(
        `Tổng thanh toán (${this.formatNumber(nextPaidAmount)} VND) không được vượt giá trị ${sourceLabel} (${this.formatNumber(limit)} VND)`
      );
    }
  }

  private formatNumber(value: number) {
    return new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0
    }).format(value);
  }

  private buildWhere(filters: Partial<ProjectFilterDto>, user: JwtUser): Prisma.ProjectWhereInput {
    const customerWhere: Prisma.CustomerWhereInput = {
      deletedAt: null
    };

    if (isStaff(user)) {
      customerWhere.assignedToId = user.sub;
    }

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

  private buildDeletedWhere(filters: Partial<ProjectFilterDto>, user: JwtUser): Prisma.ProjectWhereInput {
    return {
      ...this.buildWhere(filters, user),
      deletedAt: {
        not: null
      }
    };
  }

  private resolveNextCompletedAt({
    currentStatus,
    nextStatus,
    currentCompletedAt,
    providedCompletedAt,
    statusWasProvided,
    completedAtWasProvided
  }: {
    currentStatus: string;
    nextStatus: string;
    currentCompletedAt: Date | null;
    providedCompletedAt?: Date;
    statusWasProvided: boolean;
    completedAtWasProvided: boolean;
  }) {
    if (nextStatus !== "COMPLETED") {
      return null;
    }

    if (completedAtWasProvided) {
      return providedCompletedAt ?? null;
    }

    if (currentStatus === "COMPLETED" && currentCompletedAt) {
      return currentCompletedAt;
    }

    return statusWasProvided ? new Date() : currentCompletedAt;
  }

  private buildCompletedAtUpdate({
    statusWasProvided,
    completedAtWasProvided,
    nextStatus,
    nextCompletedAt
  }: {
    statusWasProvided: boolean;
    completedAtWasProvided: boolean;
    nextStatus: string;
    nextCompletedAt: Date | null;
  }) {
    if (!statusWasProvided && !completedAtWasProvided) {
      return {};
    }

    return {
      completedAt: nextStatus === "COMPLETED" ? nextCompletedAt : null
    };
  }

  private resolveProjectCommercialValue(project: {
    estimatedValue: Prisma.Decimal | number | null;
    contract?: { value: Prisma.Decimal | number } | null;
  }) {
    return Number(project.contract?.value ?? project.estimatedValue ?? 0);
  }

  private mapProjectListItem(project: ProjectListRecord, now: Date) {
    const estimatedValue = this.resolveProjectCommercialValue(project);

    return {
      id: project.id,
      code: project.code,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      estimatedValue,
      progressPercent: this.mapProjectProgress(project.status),
      startDate: project.startDate,
      expectedEndDate: project.expectedEndDate,
      completedAt: project.completedAt,
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

  private async getProjectDocumentSources(id: string, user: JwtUser) {
    const project = await this.prisma.project.findFirst({
      where: {
        ...this.buildWhere({}, user),
        id
      },
      select: {
        id: true,
        customerId: true,
        contract: {
          select: {
            id: true
          }
        },
        quotes: {
          where: { status: "ACCEPTED", deletedAt: null },
          orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }, { version: "desc" }],
          take: 1,
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

  private resolveProjectDocumentSource(
    project: {
      id: string;
      customerId: string;
      contract: { id: string } | null;
      quotes: Array<{ id: string }>;
    },
    type: DocumentType
  ) {
    const entity = PROJECT_DOCUMENT_ENTITY[type];

    if (entity === "project") {
      return {
        entityType: "project",
        entityId: project.id,
        missingReason: ""
      };
    }

    if (entity === "customer") {
      return {
        entityType: "customer",
        entityId: project.customerId,
        missingReason: ""
      };
    }

    if (entity === "quote") {
      return {
        entityType: "quote",
        entityId: project.quotes[0]?.id ?? null,
        missingReason: "Dự án chưa có báo giá để sinh tài liệu loại này."
      };
    }

    if (!project.contract?.id) {
      return {
        entityType: "quote",
        entityId: project.quotes[0]?.id ?? null,
        missingReason: "Dự án chưa có hợp đồng hoặc báo giá để sinh tài liệu loại này."
      };
    }

    return {
      entityType: "contract",
      entityId: project.contract.id,
      missingReason: ""
    };
  }

  private async findAccessibleProject(id: string, user: JwtUser) {
    const project = await this.prisma.project.findFirst({
      where: {
        ...this.buildWhere({}, user),
        id
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            title: true,
            phone: true,
            email: true
          }
        },
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
        status: true,
        startDate: true,
        expectedEndDate: true,
        completedAt: true,
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

  private async findDeletedAccessibleProjectRecord(id: string, user: JwtUser) {
    const project = await this.prisma.project.findFirst({
      where: {
        ...this.buildDeletedWhere({}, user),
        id
      },
      select: {
        id: true,
        status: true,
        deletedAt: true
      }
    });

    if (!project) {
      throw new NotFoundException("Không tìm thấy dự án đã xóa");
    }

    return project;
  }

  private async assertCustomerAccess(customerId: string, user: JwtUser) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        deletedAt: null,
        ...(isStaff(user) ? { assignedToId: user.sub } : {})
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
