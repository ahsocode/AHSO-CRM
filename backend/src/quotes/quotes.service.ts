import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { QuoteFilterDto } from "./dto/quote-filter.dto";
import { UpdateQuoteDto } from "./dto/update-quote.dto";
import { UpdateQuoteStatusDto } from "./dto/update-quote-status.dto";

const EXPIRING_SOON_WINDOW_DAYS = 7;
const EDITABLE_QUOTE_STATUSES = ["DRAFT", "REJECTED"] as const;
const PRE_SALE_PROJECT_STATUSES = ["SURVEY", "QUOTING", "NEGOTIATING"] as const;

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: QuoteFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters, user);
    const now = new Date();
    const expiringSoonBoundary = new Date(now.getTime() + EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [quotes, total, matchingQuotes] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { version: "desc" }],
        include: {
          createdBy: {
            select: {
              id: true,
              name: true
            }
          },
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
          _count: {
            select: {
              items: true
            }
          }
        }
      }),
      this.prisma.quote.count({ where }),
      this.prisma.quote.findMany({
        where,
        select: {
          id: true,
          status: true,
          total: true,
          validUntil: true
        }
      })
    ]);

    return {
      items: quotes.map((quote) => ({
        id: quote.id,
        quoteNo: quote.quoteNo,
        version: quote.version,
        status: quote.status,
        validUntil: quote.validUntil,
        subtotal: Number(quote.subtotal),
        taxAmount: Number(quote.taxAmount),
        total: Number(quote.total),
        createdAt: quote.createdAt,
        updatedAt: quote.updatedAt,
        sentAt: quote.sentAt,
        acceptedAt: quote.acceptedAt,
        isExpiringSoon: this.isExpiringSoon(quote.validUntil, quote.status, now, expiringSoonBoundary),
        itemCount: quote._count.items,
        createdBy: quote.createdBy,
        project: {
          id: quote.project.id,
          code: quote.project.code,
          name: quote.project.name,
          status: quote.project.status
        },
        customer: {
          id: quote.project.customer.id,
          name: quote.project.customer.name,
          shortName: quote.project.customer.shortName,
          status: quote.project.customer.status,
          assignedTo: quote.project.customer.assignedTo
        }
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        summary: {
          totalValue: matchingQuotes.reduce((sum, quote) => sum + Number(quote.total), 0),
          draftCount: matchingQuotes.filter((quote) => quote.status === "DRAFT").length,
          sentCount: matchingQuotes.filter((quote) => quote.status === "SENT").length,
          acceptedCount: matchingQuotes.filter((quote) => quote.status === "ACCEPTED").length,
          expiringSoonCount: matchingQuotes.filter((quote) =>
            this.isExpiringSoon(quote.validUntil, quote.status, now, expiringSoonBoundary)
          ).length
        }
      }
    };
  }

  async findOne(id: string, user: JwtUser) {
    const quote = await this.findAccessibleQuote(id, user);

    return {
      id: quote.id,
      quoteNo: quote.quoteNo,
      version: quote.version,
      status: quote.status,
      validUntil: quote.validUntil,
      subtotal: Number(quote.subtotal),
      taxRate: Number(quote.taxRate),
      taxAmount: Number(quote.taxAmount),
      total: Number(quote.total),
      terms: quote.terms,
      deliveryTerms: quote.deliveryTerms,
      internalNote: quote.internalNote,
      sentAt: quote.sentAt,
      acceptedAt: quote.acceptedAt,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      itemCount: quote.items.length,
      createdBy: quote.createdBy,
      project: {
        id: quote.project.id,
        code: quote.project.code,
        name: quote.project.name,
        status: quote.project.status,
        estimatedValue: Number(quote.project.estimatedValue ?? 0),
        customer: {
          id: quote.project.customer.id,
          name: quote.project.customer.name,
          shortName: quote.project.customer.shortName,
          taxCode: quote.project.customer.taxCode,
          address: quote.project.customer.address,
          status: quote.project.customer.status,
          assignedTo: quote.project.customer.assignedTo,
          primaryContact: quote.project.customer.contacts[0]
            ? {
                id: quote.project.customer.contacts[0].id,
                name: quote.project.customer.contacts[0].name,
                title: quote.project.customer.contacts[0].title,
                phone: quote.project.customer.contacts[0].phone,
                email: quote.project.customer.contacts[0].email
              }
            : null
        },
        contract: quote.project.contract
          ? {
              id: quote.project.contract.id,
              contractNo: quote.project.contract.contractNo,
              value: Number(quote.project.contract.value),
              status: quote.project.contract.status
            }
          : null
      },
      items: quote.items.map((item) => ({
        id: item.id,
        order: item.order,
        name: item.name,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total)
      }))
    };
  }

  async create(dto: CreateQuoteDto, user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: {
          ...this.buildAccessibleProjectWhere(user),
          id: dto.projectId
        },
        select: {
          id: true,
          status: true
        }
      });

      if (!project) {
        throw new NotFoundException("Không tìm thấy dự án để tạo báo giá");
      }

      const nextVersion = await tx.quote.aggregate({
        _max: {
          version: true
        },
        where: {
          projectId: dto.projectId
        }
      });

      const quoteNo = await this.generateNextQuoteNo(tx);
      const version = (nextVersion._max.version ?? 0) + 1;
      const totals = this.buildQuoteTotals(dto.items, dto.taxRate);

      const quote = await tx.quote.create({
        data: {
          quoteNo,
          version,
          status: dto.status,
          validUntil: dto.validUntil,
          subtotal: totals.subtotal,
          taxRate: dto.taxRate,
          taxAmount: totals.taxAmount,
          total: totals.total,
          terms: dto.terms,
          deliveryTerms: dto.deliveryTerms,
          internalNote: dto.internalNote,
          ...this.resolveQuoteStatusPayload(
            {
              status: "DRAFT",
              sentAt: null,
              acceptedAt: null
            },
            dto.status
          ),
          projectId: dto.projectId,
          createdById: user.sub,
          items: {
            create: this.buildQuoteItemsCreateInput(dto.items)
          }
        },
        select: {
          id: true,
          quoteNo: true
        }
      });

      await this.syncProjectStatusForQuote(tx, project.id, project.status, dto.status);

      return quote;
    });
  }

  async update(id: string, dto: UpdateQuoteDto, user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const quote = await this.findAccessibleQuoteForMutation(tx, id, user);

      if (quote.projectId !== dto.projectId) {
        throw new BadRequestException("Không thể chuyển báo giá sang dự án khác");
      }

      if (!EDITABLE_QUOTE_STATUSES.includes(quote.status as (typeof EDITABLE_QUOTE_STATUSES)[number])) {
        throw new BadRequestException("Chỉ có thể sửa báo giá ở trạng thái nháp hoặc bị từ chối");
      }

      const totals = this.buildQuoteTotals(dto.items, dto.taxRate);
      const updatedQuote = await tx.quote.update({
        where: {
          id
        },
        data: {
          status: dto.status,
          validUntil: dto.validUntil,
          subtotal: totals.subtotal,
          taxRate: dto.taxRate,
          taxAmount: totals.taxAmount,
          total: totals.total,
          terms: dto.terms,
          deliveryTerms: dto.deliveryTerms,
          internalNote: dto.internalNote,
          ...this.resolveQuoteStatusPayload(quote, dto.status),
          items: {
            deleteMany: {},
            create: this.buildQuoteItemsCreateInput(dto.items)
          }
        },
        select: {
          id: true,
          quoteNo: true
        }
      });

      await this.syncProjectStatusForQuote(tx, quote.projectId, quote.project.status, dto.status);

      return updatedQuote;
    });
  }

  async duplicate(id: string, user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const quote = await this.findAccessibleQuoteForMutation(tx, id, user);

      if (quote.project.contract) {
        throw new BadRequestException("Dự án đã có hợp đồng, không thể tạo version báo giá mới");
      }

      const nextVersion = await tx.quote.aggregate({
        _max: {
          version: true
        },
        where: {
          projectId: quote.projectId
        }
      });

      const quoteNo = await this.generateNextQuoteNo(tx);
      const itemInputs = quote.items.map((item) => ({
        name: item.name,
        description: item.description ?? undefined,
        unit: item.unit ?? undefined,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice)
      }));
      const totals = this.buildQuoteTotals(itemInputs, Number(quote.taxRate));
      const duplicatedQuote = await tx.quote.create({
        data: {
          quoteNo,
          version: (nextVersion._max.version ?? 0) + 1,
          status: "DRAFT",
          validUntil: quote.validUntil,
          subtotal: totals.subtotal,
          taxRate: quote.taxRate,
          taxAmount: totals.taxAmount,
          total: totals.total,
          terms: quote.terms,
          deliveryTerms: quote.deliveryTerms,
          internalNote: quote.internalNote,
          sentAt: null,
          acceptedAt: null,
          projectId: quote.projectId,
          createdById: user.sub,
          items: {
            create: this.buildQuoteItemsCreateInput(itemInputs)
          }
        },
        select: {
          id: true,
          quoteNo: true,
          version: true
        }
      });

      await this.syncProjectStatusForQuote(tx, quote.projectId, quote.project.status, "DRAFT");

      return duplicatedQuote;
    });
  }

  async updateStatus(id: string, dto: UpdateQuoteStatusDto, user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const quote = await this.findAccessibleQuoteForMutation(tx, id, user);

      if (quote.status === "ACCEPTED" && dto.status !== "ACCEPTED") {
        throw new BadRequestException("Báo giá đã được chấp nhận, không thể chuyển về trạng thái trước đó");
      }

      if (quote.project.contract && dto.status !== "ACCEPTED") {
        throw new BadRequestException("Dự án đã có hợp đồng, không thể đổi trạng thái báo giá này");
      }

      if (dto.status === quote.status) {
        return {
          id: quote.id,
          status: quote.status,
          sentAt: quote.sentAt,
          acceptedAt: quote.acceptedAt
        };
      }

      const updatedQuote = await tx.quote.update({
        where: {
          id
        },
        data: {
          status: dto.status,
          ...this.resolveQuoteStatusPayload(quote, dto.status)
        },
        select: {
          id: true,
          status: true,
          sentAt: true,
          acceptedAt: true
        }
      });

      await this.syncProjectStatusForQuote(tx, quote.projectId, quote.project.status, dto.status);

      return updatedQuote;
    });
  }

  private buildWhere(filters: Partial<QuoteFilterDto>, user: JwtUser): Prisma.QuoteWhereInput {
    const projectWhere: Prisma.ProjectWhereInput = this.buildAccessibleProjectWhere(user);

    if (filters.projectId) {
      projectWhere.id = filters.projectId;
    }

    if (filters.customerId) {
      projectWhere.customerId = filters.customerId;
    }

    const where: Prisma.QuoteWhereInput = {
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

  private buildAccessibleProjectWhere(user: JwtUser): Prisma.ProjectWhereInput {
    const customerWhere: Prisma.CustomerWhereInput = {
      deletedAt: null
    };

    if (isStaff(user)) {
      customerWhere.assignedToId = user.sub;
    }

    return {
      deletedAt: null,
      customer: customerWhere
    };
  }

  private async findAccessibleQuote(id: string, user: JwtUser) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        ...this.buildWhere({}, user),
        id
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            estimatedValue: true,
            contract: {
              select: {
                id: true,
                contractNo: true,
                value: true,
                status: true
              }
            },
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
            }
          }
        },
        items: {
          orderBy: {
            order: "asc"
          }
        }
      }
    });

    if (!quote) {
      throw new NotFoundException("Không tìm thấy báo giá");
    }

    return quote;
  }

  private async findAccessibleQuoteForMutation(
    tx: Prisma.TransactionClient,
    id: string,
    user: JwtUser
  ) {
    const quote = await tx.quote.findFirst({
      where: {
        ...this.buildWhere({}, user),
        id
      },
      include: {
        items: {
          orderBy: {
            order: "asc"
          }
        },
        project: {
          select: {
            id: true,
            status: true,
            contract: {
              select: {
                id: true
              }
            }
          }
        }
      }
    });

    if (!quote) {
      throw new NotFoundException("Không tìm thấy báo giá");
    }

    return quote;
  }

  private async generateNextQuoteNo(tx: Prisma.TransactionClient) {
    const year = new Date().getFullYear();
    const prefix = `BG-${year}-`;
    const latestQuote = await tx.quote.findFirst({
      where: {
        quoteNo: {
          startsWith: prefix
        }
      },
      orderBy: {
        quoteNo: "desc"
      },
      select: {
        quoteNo: true
      }
    });

    const currentSequence = latestQuote?.quoteNo.split("-").at(-1);
    const nextSequence = currentSequence ? Number.parseInt(currentSequence, 10) + 1 : 1;

    return `${prefix}${String(nextSequence).padStart(3, "0")}`;
  }

  private isExpiringSoon(
    validUntil: Date | null,
    status: string,
    now: Date,
    expiringSoonBoundary: Date
  ) {
    if (!validUntil || status === "ACCEPTED" || status === "REJECTED" || status === "EXPIRED") {
      return false;
    }

    return validUntil >= now && validUntil <= expiringSoonBoundary;
  }

  private buildQuoteItemsCreateInput(
    items: Array<{
      name: string;
      description?: string;
      unit?: string;
      quantity: number;
      unitPrice: number;
    }>
  ) {
    return items.map((item, index) => ({
      order: index + 1,
      name: item.name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: Math.round(item.quantity * item.unitPrice)
    }));
  }

  private buildQuoteTotals(
    items: Array<{
      quantity: number;
      unitPrice: number;
    }>,
    taxRate: number
  ) {
    const subtotal = items.reduce(
      (sum, item) => sum + Math.round(item.quantity * item.unitPrice),
      0
    );
    const taxAmount = Math.round((subtotal * taxRate) / 100);

    return {
      subtotal,
      taxAmount,
      total: subtotal + taxAmount
    };
  }

  private resolveQuoteStatusPayload(
    quote: {
      status: string;
      sentAt: Date | null;
      acceptedAt: Date | null;
    },
    nextStatus: string
  ) {
    const now = new Date();

    if (nextStatus === "DRAFT") {
      return {
        sentAt: null,
        acceptedAt: null
      };
    }

    if (nextStatus === "SENT") {
      return {
        sentAt: quote.sentAt ?? now,
        acceptedAt: null
      };
    }

    if (nextStatus === "ACCEPTED") {
      return {
        sentAt: quote.sentAt ?? now,
        acceptedAt: quote.acceptedAt ?? now
      };
    }

    return {
      sentAt: quote.sentAt,
      acceptedAt: null
    };
  }

  private async syncProjectStatusForQuote(
    tx: Prisma.TransactionClient,
    projectId: string,
    currentStatus: string,
    quoteStatus: string
  ) {
    if (
      quoteStatus === "ACCEPTED" &&
      PRE_SALE_PROJECT_STATUSES.includes(currentStatus as (typeof PRE_SALE_PROJECT_STATUSES)[number])
    ) {
      await tx.project.update({
        where: {
          id: projectId
        },
        data: {
          status: "WON"
        }
      });
      return;
    }

    if (currentStatus === "SURVEY") {
      await tx.project.update({
        where: {
          id: projectId
        },
        data: {
          status: "QUOTING"
        }
      });
    }
  }
}
