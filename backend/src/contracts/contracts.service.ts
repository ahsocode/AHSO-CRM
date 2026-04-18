import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { ContractFilterDto } from "./dto/contract-filter.dto";

const CLOSED_CONTRACT_STATUSES = ["COMPLETED", "CANCELLED"] as const;

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: ContractFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters, user);
    const now = new Date();

    const [contracts, total, matchingContracts] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: {
          project: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                  status: true,
                  assignedTo: {
                    select: {
                      id: true,
                      name: true,
                      role: true
                    }
                  }
                }
              }
            }
          },
          payments: {
            select: {
              amount: true
            }
          },
          _count: {
            select: {
              payments: true,
              milestones: true
            }
          }
        }
      }),
      this.prisma.contract.count({ where }),
      this.prisma.contract.findMany({
        where,
        select: {
          id: true,
          status: true,
          value: true,
          payments: {
            select: {
              amount: true
            }
          }
        }
      })
    ]);

    return {
      items: contracts.map((contract) => {
        const paidAmount = contract.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const contractValue = Number(contract.value);

        return {
          id: contract.id,
          contractNo: contract.contractNo,
          status: contract.status,
          value: contractValue,
          signDate: contract.signDate,
          startDate: contract.startDate,
          endDate: contract.endDate,
          createdAt: contract.createdAt,
          updatedAt: contract.updatedAt,
          paidAmount,
          outstandingAmount: Math.max(0, contractValue - paidAmount),
          paymentCount: contract._count.payments,
          milestoneCount: contract._count.milestones,
          isOverdue: Boolean(
            contract.endDate &&
              contract.endDate < now &&
              !CLOSED_CONTRACT_STATUSES.includes(
                contract.status as (typeof CLOSED_CONTRACT_STATUSES)[number]
              )
          ),
          project: {
            id: contract.project.id,
            code: contract.project.code,
            name: contract.project.name,
            status: contract.project.status
          },
          customer: {
            id: contract.project.customer.id,
            name: contract.project.customer.name,
            shortName: contract.project.customer.shortName,
            status: contract.project.customer.status,
            assignedTo: contract.project.customer.assignedTo
          }
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        summary: {
          totalValue: matchingContracts.reduce((sum, contract) => sum + Number(contract.value), 0),
          activeCount: matchingContracts.filter((contract) => contract.status === "ACTIVE").length,
          completedCount: matchingContracts.filter((contract) => contract.status === "COMPLETED").length,
          outstandingAmount: matchingContracts.reduce((sum, contract) => {
            const paidAmount = contract.payments.reduce((paid, payment) => paid + Number(payment.amount), 0);
            return sum + Math.max(0, Number(contract.value) - paidAmount);
          }, 0)
        }
      }
    };
  }

  async findOne(id: string, user: JwtUser) {
    const contract = await this.findAccessibleContract(id, user);
    const paidAmount = contract.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const contractValue = Number(contract.value);
    const milestoneCount = contract.milestones.length;
    const completedMilestones = contract.milestones.filter(
      (milestone) => milestone.status === "DONE" || milestone.status === "ACCEPTED"
    ).length;

    return {
      id: contract.id,
      contractNo: contract.contractNo,
      status: contract.status,
      value: contractValue,
      signDate: contract.signDate,
      startDate: contract.startDate,
      endDate: contract.endDate,
      fileUrl: contract.fileUrl,
      notes: contract.notes,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      stats: {
        paidAmount,
        outstandingAmount: Math.max(0, contractValue - paidAmount),
        paymentCount: contract.payments.length,
        milestoneCount,
        completedMilestones,
        completionRate: milestoneCount > 0 ? Number(((completedMilestones / milestoneCount) * 100).toFixed(1)) : 0
      },
      project: {
        id: contract.project.id,
        code: contract.project.code,
        name: contract.project.name,
        description: contract.project.description,
        status: contract.project.status,
        estimatedValue: Number(contract.project.estimatedValue ?? 0),
        startDate: contract.project.startDate,
        expectedEndDate: contract.project.expectedEndDate,
        customer: {
          id: contract.project.customer.id,
          name: contract.project.customer.name,
          shortName: contract.project.customer.shortName,
          taxCode: contract.project.customer.taxCode,
          address: contract.project.customer.address,
          status: contract.project.customer.status,
          assignedTo: contract.project.customer.assignedTo,
          primaryContact: contract.project.customer.contacts[0]
            ? {
                id: contract.project.customer.contacts[0].id,
                name: contract.project.customer.contacts[0].name,
                title: contract.project.customer.contacts[0].title,
                phone: contract.project.customer.contacts[0].phone,
                email: contract.project.customer.contacts[0].email
              }
            : null
        },
        quotes: contract.project.quotes.map((quote) => ({
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
        activities: contract.project.activities.map((activity) => ({
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
      },
      milestones: contract.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        description: milestone.description,
        status: milestone.status,
        dueDate: milestone.dueDate,
        completedAt: milestone.completedAt,
        paymentAmount: Number(milestone.paymentAmount ?? 0),
        notes: milestone.notes
      })),
      payments: contract.payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        paidAt: payment.paidAt,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes
      }))
    };
  }

  private buildWhere(filters: Partial<ContractFilterDto>, user: JwtUser): Prisma.ContractWhereInput {
    const projectWhere: Prisma.ProjectWhereInput = this.buildAccessibleProjectWhere(user);
    const where: Prisma.ContractWhereInput = {
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

  private buildAccessibleProjectWhere(user: JwtUser): Prisma.ProjectWhereInput {
    const customerWhere: Prisma.CustomerWhereInput = {
      deletedAt: null
    };

    if (user.role === "STAFF") {
      customerWhere.assignedToId = user.sub;
    }

    return {
      deletedAt: null,
      customer: customerWhere
    };
  }

  private async findAccessibleContract(id: string, user: JwtUser) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id,
        project: this.buildAccessibleProjectWhere(user)
      },
      include: {
        project: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                shortName: true,
                taxCode: true,
                address: true,
                status: true,
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
            },
            quotes: {
              include: {
                createdBy: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              },
              orderBy: [{ createdAt: "desc" }, { version: "desc" }]
            },
            activities: {
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
              take: 8
            }
          }
        },
        milestones: {
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }]
        },
        payments: {
          orderBy: {
            paidAt: "desc"
          }
        }
      }
    });

    if (!contract) {
      throw new NotFoundException("Không tìm thấy hợp đồng");
    }

    return contract;
  }
}
