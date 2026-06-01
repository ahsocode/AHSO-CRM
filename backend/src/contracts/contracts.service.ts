import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { MilestoneStatus, Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { decimalToNumber, sumDecimal } from "../common/utils/decimal";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { EmailService } from "../email/email.service";
import { UploadService } from "../upload/upload.service";
import { ContractFilterDto } from "./dto/contract-filter.dto";
import { CreateContractDto } from "./dto/create-contract.dto";
import { CreateMilestoneDto } from "./dto/create-milestone.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { UpdateContractDto } from "./dto/update-contract.dto";
import { UpdateMilestoneDto } from "./dto/update-milestone.dto";

const CLOSED_CONTRACT_STATUSES = ["COMPLETED", "CANCELLED"] as const;

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customFieldsService: CustomFieldsService,
    private readonly uploadService: UploadService,
    private readonly emailService: EmailService,
    private readonly domainEvents: DomainEventsService
  ) {}

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

  async create(dto: CreateContractDto, user: JwtUser) {
    const createdContract = await this.prisma.$transaction(async (tx) => {
      const project = await this.findAccessibleProjectForContract(tx, dto.projectId, user);

      if (project.contract) {
        throw new BadRequestException("Dự án này đã có hợp đồng");
      }

      if (dto.sourceQuoteId) {
        const sourceQuote = project.quotes.find((quote) => quote.id === dto.sourceQuoteId);

        if (!sourceQuote) {
          throw new BadRequestException("Không tìm thấy báo giá nguồn đã được chấp nhận cho dự án này");
        }
      }

      const selectedSourceQuote = dto.sourceQuoteId
        ? project.quotes.find((quote) => quote.id === dto.sourceQuoteId)
        : null;
      const selectedQuoteItems = selectedSourceQuote
        ? this.resolveSelectedQuoteItems(selectedSourceQuote.items, dto.sourceQuoteItemIds)
        : [];
      const resolvedContractValue = selectedSourceQuote
        ? this.calculateContractValueFromQuoteItems(selectedQuoteItems, selectedSourceQuote.taxRate)
        : dto.value;

      if (resolvedContractValue <= 0) {
        throw new BadRequestException("Giá trị hợp đồng theo hạng mục đã chọn phải lớn hơn 0");
      }

      const contract = await tx.contract.create({
        data: {
          contractNo: await this.generateNextContractNo(tx),
          signDate: dto.signDate,
          startDate: dto.startDate,
          endDate: dto.endDate,
          value: resolvedContractValue,
          status: dto.status,
          fileUrl: dto.fileUrl,
          notes: dto.notes,
          projectId: dto.projectId,
          ...(selectedQuoteItems.length > 0
            ? {
                items: {
                  create: selectedQuoteItems.map((item, index) => ({
                    order: index + 1,
                    name: item.name,
                    description: item.description,
                    unit: item.unit,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total,
                    quoteItemId: item.id
                  }))
                }
              }
            : {})
        },
        select: {
          id: true,
          contractNo: true,
          status: true
        }
      });

      await this.syncProjectStatusForContract(tx, project.id, project.status, dto.status, resolvedContractValue);

      return contract;
    });

    await this.customFieldsService.saveValues("contract", createdContract.id, dto.customFieldValues);
    await this.handleContractStatusSideEffects(createdContract.id, null, createdContract.status);

    return createdContract;
  }

  async findOne(id: string, user: JwtUser) {
    const contract = await this.findAccessibleContract(id, user);
    const paidAmount = contract.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const contractValue = Number(contract.value);
    const milestoneCount = contract.milestones.length;
    const completedMilestones = contract.milestones.filter(
      (milestone) => milestone.status === "DONE" || milestone.status === "ACCEPTED"
    ).length;
    const customFieldValues = await this.customFieldsService.getValues("contract", contract.id);

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
      customFieldValues,
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
      items: contract.items.map((item) => this.mapContractItem(item)),
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

  async update(id: string, dto: UpdateContractDto, user: JwtUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      const contract = await this.findAccessibleContractForMutation(tx, id, user);
      const nextStartDate = dto.startDate ?? contract.startDate;
      const nextEndDate = dto.endDate ?? contract.endDate;

      if (nextStartDate && nextEndDate && nextEndDate.getTime() < nextStartDate.getTime()) {
        throw new BadRequestException("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
      }

      const updatedContract = await tx.contract.update({
        where: {
          id
        },
        data: {
          ...(dto.signDate !== undefined ? { signDate: dto.signDate } : {}),
          ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
          ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
          ...(dto.value !== undefined ? { value: dto.value } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.fileUrl !== undefined ? { fileUrl: dto.fileUrl } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {})
        },
        select: {
          id: true,
          contractNo: true,
          status: true,
          value: true
        }
      });

      await this.syncProjectStatusForContract(
        tx,
        contract.projectId,
        contract.project.status,
        updatedContract.status,
        Number(updatedContract.value)
      );

      return {
        updatedContract,
        previousStatus: contract.status,
        previousLocalFileUrl: this.shouldDeletePreviousLocalFile(contract.fileUrl, dto.fileUrl)
          ? contract.fileUrl
          : null
      };
    });

    if (result.previousLocalFileUrl) {
      await this.uploadService.deleteFile(result.previousLocalFileUrl);
    }

    await this.customFieldsService.saveValues("contract", id, dto.customFieldValues);
    await this.handleContractStatusSideEffects(id, result.previousStatus, result.updatedContract.status);

    return {
      id: result.updatedContract.id,
      contractNo: result.updatedContract.contractNo,
      status: result.updatedContract.status
    };
  }

  async createMilestone(contractId: string, dto: CreateMilestoneDto, user: JwtUser) {
    const contract = await this.findAccessibleContractEntity(contractId, user);
    const milestone = await this.prisma.milestone.create({
      data: {
        name: dto.name,
        description: dto.description,
        dueDate: dto.dueDate,
        status: dto.status,
        completedAt: this.resolveMilestoneCompletedAt(dto.status),
        paymentAmount: dto.paymentAmount ?? null,
        notes: dto.notes,
        contractId: contract.id,
        projectId: contract.projectId
      }
    });

    return this.mapMilestone(milestone);
  }

  async updateMilestone(milestoneId: string, dto: UpdateMilestoneDto, user: JwtUser) {
    const milestone = await this.findAccessibleMilestone(milestoneId, user);
    const nextStatus = dto.status ?? milestone.status;
    const nextCompletedAt = this.resolveMilestoneCompletedAt(nextStatus, milestone.completedAt, dto.completedAt);
    const updatedMilestone = await this.prisma.milestone.update({
      where: {
        id: milestoneId
      },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.paymentAmount !== undefined ? { paymentAmount: dto.paymentAmount } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        completedAt: nextCompletedAt
      }
    });

    return this.mapMilestone(updatedMilestone);
  }

  async createPayment(contractId: string, dto: CreatePaymentDto, user: JwtUser) {
    const { payment, projectId } = await this.prisma.$transaction(async (tx) => {
      const contract = await tx.contract.findFirst({
        where: { id: contractId, project: this.buildAccessibleProjectWhere(user) },
        select: {
          id: true,
          projectId: true,
          value: true,
          payments: { select: { amount: true } }
        }
      });

      if (!contract) {
        throw new NotFoundException("Không tìm thấy hợp đồng");
      }

      const paidAmount = contract.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const contractValue = Number(contract.value);
      const nextPaidAmount = paidAmount + dto.amount;

      if (nextPaidAmount > contractValue) {
        throw new BadRequestException(
          `Tổng thanh toán (${this.formatNumber(nextPaidAmount)} VND) không được vượt giá trị hợp đồng (${this.formatNumber(contractValue)} VND)`
        );
      }

      const payment = await tx.payment.create({
        data: {
          amount: dto.amount,
          paidAt: dto.paidAt,
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
          projectId: contract.projectId,
          contractId: contract.id
        }
      });

      return { payment, projectId: contract.projectId };
    });

    const context = await this.loadContractNotificationContext(contractId);

    void Promise.resolve(this.domainEvents
      .emit("payment.received", {
        paymentId: payment.id,
        contractId,
        projectId,
        ownerUserId: context.project.customer.assignedTo.id,
        contractNo: context.contractNo,
        amount: Number(payment.amount),
        paidAt: payment.paidAt,
        method: payment.method
      }))
      .catch((err: unknown) =>
        this.logger.error("Domain event handler failed", { event: "payment.received", err })
      );

    return {
      id: payment.id,
      amount: Number(payment.amount),
      paidAt: payment.paidAt,
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
      projectId,
      contractId,
      quoteId: null,
      sourceType: "contract",
      sourceLabel: context.contractNo
    };
  }

  async remove(id: string, user: JwtUser) {
    const contract = await this.findAccessibleContract(id, user);

    await this.prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return { success: true, id: contract.id };
  }

  private buildWhere(filters: Partial<ContractFilterDto>, user: JwtUser): Prisma.ContractWhereInput {
    const projectWhere: Prisma.ProjectWhereInput = this.buildAccessibleProjectWhere(user);
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

  private buildAccessibleProjectWhere(user: JwtUser): Prisma.ProjectWhereInput {
    const customerWhere: Prisma.CustomerWhereInput = {
      deletedAt: null
    };

    if (isStaff(user)) {
      customerWhere.assignedToId = user.sub;
      customerWhere.assignedTo = { isActive: true };
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
        items: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }]
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

  private async findAccessibleContractEntity(id: string, user: JwtUser) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id,
        project: this.buildAccessibleProjectWhere(user)
      },
      select: {
        id: true,
        projectId: true,
        value: true,
        payments: {
          select: {
            amount: true
          }
        }
      }
    });

    if (!contract) {
      throw new NotFoundException("Không tìm thấy hợp đồng");
    }

    return contract;
  }

  private formatNumber(value: number) {
    return new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0
    }).format(value);
  }

  private async findAccessibleContractForMutation(
    tx: Prisma.TransactionClient,
    id: string,
    user: JwtUser
  ) {
    const contract = await tx.contract.findFirst({
      where: {
        id,
        project: this.buildAccessibleProjectWhere(user)
      },
      select: {
        id: true,
        projectId: true,
        startDate: true,
        endDate: true,
        fileUrl: true,
        status: true,
        project: {
          select: {
            status: true
          }
        },
        value: true
      }
    });

    if (!contract) {
      throw new NotFoundException("Không tìm thấy hợp đồng");
    }

    return contract;
  }

  private async findAccessibleProjectForContract(
    tx: Prisma.TransactionClient,
    projectId: string,
    user: JwtUser
  ) {
    const project = await tx.project.findFirst({
      where: {
        ...this.buildAccessibleProjectWhere(user),
        id: projectId
      },
      select: {
        id: true,
        status: true,
        contract: {
          select: {
            id: true
          }
        },
        quotes: {
          where: {
            status: "ACCEPTED"
          },
          select: {
            id: true,
            taxRate: true,
            items: {
              select: {
                id: true,
                order: true,
                name: true,
                description: true,
                unit: true,
                quantity: true,
                unitPrice: true,
                total: true
              },
              orderBy: [{ order: "asc" }]
            }
          },
          orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }, { version: "desc" }]
        }
      }
    });

    if (!project) {
      throw new NotFoundException("Không tìm thấy dự án để tạo hợp đồng");
    }

    return project;
  }

  private async findAccessibleMilestone(id: string, user: JwtUser) {
    const milestone = await this.prisma.milestone.findFirst({
      where: {
        id,
        contract: {
          project: this.buildAccessibleProjectWhere(user)
        }
      }
    });

    if (!milestone) {
      throw new NotFoundException("Không tìm thấy milestone");
    }

    return milestone;
  }

  private resolveMilestoneCompletedAt(
    status: MilestoneStatus,
    currentCompletedAt?: Date | null,
    explicitCompletedAt?: Date
  ) {
    if (explicitCompletedAt) {
      return explicitCompletedAt;
    }

    if (status === "DONE" || status === "ACCEPTED") {
      return currentCompletedAt ?? new Date();
    }

    return null;
  }

  private mapMilestone(milestone: {
    id: string;
    name: string;
    description: string | null;
    dueDate: Date | null;
    completedAt: Date | null;
    status: MilestoneStatus;
    paymentAmount: Prisma.Decimal | null;
    notes: string | null;
  }) {
    return {
      id: milestone.id,
      name: milestone.name,
      description: milestone.description,
      dueDate: milestone.dueDate,
      completedAt: milestone.completedAt,
      status: milestone.status,
      paymentAmount: Number(milestone.paymentAmount ?? 0),
      notes: milestone.notes
    };
  }

  private resolveSelectedQuoteItems(
    quoteItems: Array<{
      id: string;
      order: number;
      name: string;
      description: string | null;
      unit: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      total: Prisma.Decimal;
    }>,
    selectedItemIds?: string[]
  ) {
    if (quoteItems.length === 0) {
      throw new BadRequestException("Báo giá nguồn chưa có hạng mục để chốt hợp đồng");
    }

    if (!selectedItemIds || selectedItemIds.length === 0) {
      return quoteItems;
    }

    const availableIds = new Set(quoteItems.map((item) => item.id));
    const invalidIds = selectedItemIds.filter((itemId) => !availableIds.has(itemId));

    if (invalidIds.length > 0) {
      throw new BadRequestException("Một số hạng mục được chọn không thuộc báo giá nguồn");
    }

    const selectedIds = new Set(selectedItemIds);
    const selectedItems = quoteItems.filter((item) => selectedIds.has(item.id));

    if (selectedItems.length === 0) {
      throw new BadRequestException("Cần chọn ít nhất một hạng mục để chốt hợp đồng");
    }

    return selectedItems;
  }

  private calculateContractValueFromQuoteItems(
    quoteItems: Array<{
      total: Prisma.Decimal;
    }>,
    taxRate: Prisma.Decimal
  ) {
    const subtotal = sumDecimal(quoteItems.map((item) => item.total));
    const taxAmount = subtotal.mul(taxRate).div(100).round();

    return decimalToNumber(subtotal.plus(taxAmount));
  }

  private mapContractItem(item: {
    id: string;
    order: number;
    name: string;
    description: string | null;
    unit: string | null;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    total: Prisma.Decimal;
    quoteItemId: string | null;
  }) {
    return {
      id: item.id,
      order: item.order,
      name: item.name,
      description: item.description,
      unit: item.unit,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
      quoteItemId: item.quoteItemId
    };
  }

  private async generateNextContractNo(tx: Prisma.TransactionClient) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('contract_number'))`;
    const year = new Date().getFullYear();
    const prefix = `HD-${year}-`;
    const latestContract = await tx.contract.findFirst({
      where: {
        contractNo: {
          startsWith: prefix
        }
      },
      orderBy: {
        contractNo: "desc"
      },
      select: {
        contractNo: true
      }
    });

    const currentSequence = latestContract?.contractNo.split("-").at(-1);
    const nextSequence = currentSequence ? Number.parseInt(currentSequence, 10) + 1 : 1;

    return `${prefix}${String(nextSequence).padStart(3, "0")}`;
  }

  private shouldDeletePreviousLocalFile(previousFileUrl?: string | null, nextFileUrl?: string | null) {
    if (!previousFileUrl || nextFileUrl === undefined || previousFileUrl === nextFileUrl) {
      return false;
    }

    return this.uploadService.isLocalUploadPath(previousFileUrl);
  }

  private async handleContractStatusSideEffects(
    contractId: string,
    previousStatus: string | null,
    nextStatus: string
  ) {
    if (previousStatus === nextStatus) {
      return;
    }

    const contract = await this.loadContractNotificationContext(contractId);

    if (nextStatus === "ACTIVE") {
      const recipients = [
        contract.project.customer.contacts[0]?.email,
        contract.project.customer.assignedTo.email
      ].filter((value): value is string => Boolean(value));

      if (recipients.length > 0) {
        await this.emailService.sendEmail(
          recipients,
          `AHSO CRM | Hợp đồng ${contract.contractNo} đã có hiệu lực`,
          "contract-signed",
          {
            recipientName:
              contract.project.customer.contacts[0]?.name ?? contract.project.customer.assignedTo.name,
            contractNo: contract.contractNo,
            projectName: contract.project.name,
            customerName: contract.project.customer.name,
            contractValue: formatCurrency(Number(contract.value))
          }
        );
      }

      void Promise.resolve(this.domainEvents
        .emit("contract.signed", {
          contractId: contract.id,
          contractNo: contract.contractNo,
          projectId: contract.projectId,
          customerId: contract.project.customer.id,
          ownerUserId: contract.project.customer.assignedTo.id,
          status: contract.status,
          value: Number(contract.value)
        }))
        .catch((err: unknown) =>
          this.logger.error("Domain event handler failed", { event: "contract.signed", err })
        );
      return;
    }

    if (nextStatus === "COMPLETED") {
      void Promise.resolve(this.domainEvents
        .emit("contract.completed", {
          contractId: contract.id,
          contractNo: contract.contractNo,
          projectId: contract.projectId,
          customerId: contract.project.customer.id,
          ownerUserId: contract.project.customer.assignedTo.id,
          status: contract.status,
          value: Number(contract.value)
        }))
        .catch((err: unknown) =>
          this.logger.error("Domain event handler failed", { event: "contract.completed", err })
        );
    }
  }

  private async loadContractNotificationContext(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: {
        id: contractId
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            customer: {
              select: {
                id: true,
                name: true,
                assignedTo: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                },
                contacts: {
                  where: {
                    isPrimary: true
                  },
                  select: {
                    id: true,
                    name: true,
                    email: true
                  },
                  take: 1
                }
              }
            }
          }
        }
      }
    });

    if (!contract) {
      throw new NotFoundException("Không tìm thấy hợp đồng");
    }

    return contract;
  }

  private async syncProjectStatusForContract(
    tx: Prisma.TransactionClient,
    projectId: string,
    currentStatus: string,
    contractStatus: string,
    contractValue: number
  ) {
    const nextProjectStatus =
      contractStatus === "COMPLETED"
        ? "COMPLETED"
        : contractStatus === "CANCELLED"
          ? "LOST"
        : contractStatus === "ACTIVE" || contractStatus === "SUSPENDED"
          ? "DELIVERING"
          : "WON";
    const data: Prisma.ProjectUpdateInput = {
      estimatedValue: contractValue
    };

    if (currentStatus !== nextProjectStatus) {
      data.status = nextProjectStatus;
    }

    await tx.project.update({
      where: {
        id: projectId
      },
      data
    });
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}
