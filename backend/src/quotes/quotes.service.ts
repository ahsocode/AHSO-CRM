import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { decimalToNumber, sumDecimal } from "../common/utils/decimal";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { EmailService } from "../email/email.service";
import { BulkQuoteDto } from "./dto/bulk-quote.dto";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { QuoteFilterDto } from "./dto/quote-filter.dto";
import { UpdateQuoteDto } from "./dto/update-quote.dto";
import { UpdateQuoteStatusDto } from "./dto/update-quote-status.dto";
import { QuotesPdfService } from "./quotes-pdf.service";

const EXPIRING_SOON_WINDOW_DAYS = 7;
const EDITABLE_QUOTE_STATUSES = ["DRAFT", "REJECTED"] as const;
const PRE_SALE_PROJECT_STATUSES = ["SURVEY", "QUOTING", "NEGOTIATING"] as const;
const QUOTE_TABLE_COLUMN_KEYS = ["index", "name", "description", "quantity", "unitPrice", "total"] as const;

type QuoteTableColumnKey = (typeof QUOTE_TABLE_COLUMN_KEYS)[number];
type QuoteTableColumnWidths = Record<QuoteTableColumnKey, number>;

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
    private readonly emailService: EmailService,
    private readonly domainEvents: DomainEventsService
  ) {}

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
      tableColumnWidths: this.normalizeQuoteTableColumnWidths(quote.tableColumnWidths),
      terms: quote.terms,
      deliveryTerms: quote.deliveryTerms,
      internalNote: quote.internalNote,
      sentAt: quote.sentAt,
      acceptedAt: quote.acceptedAt,
      acceptedItemIds: quote.acceptedItemIds,
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
          ...this.buildTableColumnWidthsPayload(dto.tableColumnWidths),
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

      await this.syncProjectStatusForQuote(tx, project.id, project.status, dto.status, totals.total);

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
          ...this.buildTableColumnWidthsPayload(dto.tableColumnWidths),
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

      await this.syncProjectStatusForQuote(tx, quote.projectId, quote.project.status, dto.status, totals.total);

      return updatedQuote;
    });
  }

  async updateTableLayout(id: string, tableColumnWidths: QuoteTableColumnWidths, user: JwtUser) {
    const quote = await this.prisma.quote.findFirst({
      where: { ...this.buildWhere({}, user), id },
      select: { id: true },
    });
    if (!quote) throw new NotFoundException("Không tìm thấy báo giá");
    return this.prisma.quote.update({
      where: { id },
      data: this.buildTableColumnWidthsPayload(tableColumnWidths),
      select: { id: true, tableColumnWidths: true },
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
          ...this.buildTableColumnWidthsPayload(quote.tableColumnWidths),
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

      await this.syncProjectStatusForQuote(tx, quote.projectId, quote.project.status, "DRAFT", totals.total);

      return duplicatedQuote;
    });
  }

  async send(id: string, user: JwtUser) {
    const quote = await this.findAccessibleQuote(id, user);
    const recipientEmail = quote.project.customer.contacts[0]?.email;
    const recipientName = quote.project.customer.contacts[0]?.name ?? quote.project.customer.name;

    if (!recipientEmail) {
      throw new BadRequestException("Khách hàng chưa có email liên hệ chính để gửi báo giá");
    }

    const pdfService = this.moduleRef.get(QuotesPdfService, { strict: false });
    const pdf = await pdfService.generatePdf(id, user);

    await this.emailService.sendEmail(
      recipientEmail,
      `AHSO CRM | Gửi báo giá ${quote.quoteNo}`,
      "quote-sent",
      {
        recipientName,
        quoteNo: quote.quoteNo,
        projectName: quote.project.name,
        quoteTotal: formatCurrency(Number(quote.total)),
        validUntil: quote.validUntil ? formatDate(quote.validUntil) : "Theo xác nhận trong email",
        senderName: quote.createdBy.name
      },
      [
        {
          filename: pdf.filename,
          content: pdf.buffer,
          contentType: "application/pdf"
        }
      ]
    );

    const nextStatus = quote.status === "DRAFT" ? "SENT" : quote.status;
    const sentQuote = await this.prisma.quote.update({
      where: {
        id
      },
      data: {
        status: nextStatus,
        sentAt: quote.sentAt ?? new Date()
      },
      select: {
        id: true,
        quoteNo: true,
        status: true,
        sentAt: true
      }
    });

    void Promise.resolve(this.domainEvents
      .emit("quote.sent", {
        quoteId: quote.id,
        quoteNo: quote.quoteNo,
        projectId: quote.project.id,
        customerId: quote.project.customer.id,
        ownerUserId: quote.createdBy.id,
        status: sentQuote.status,
        total: Number(quote.total),
        sentAt: sentQuote.sentAt
      }))
      .catch((err: unknown) =>
        this.logger.error("Domain event handler failed", { event: "quote.sent", err })
      );

    return {
      ...sentQuote,
      sentTo: recipientEmail
    };
  }

  async updateStatus(id: string, dto: UpdateQuoteStatusDto, user: JwtUser) {
    const result = (await this.prisma.$transaction(async (tx) => {
      const quote = await this.findAccessibleQuoteForMutation(tx, id, user);

      if (quote.status === "ACCEPTED" && dto.status !== "ACCEPTED") {
        throw new BadRequestException("Báo giá đã được chấp nhận, không thể chuyển về trạng thái trước đó");
      }

      if (quote.project.contract && dto.status !== "ACCEPTED") {
        throw new BadRequestException("Dự án đã có hợp đồng, không thể đổi trạng thái báo giá này");
      }

      if (dto.status === quote.status) {
        return {
          updatedQuote: { id: quote.id, status: quote.status, sentAt: quote.sentAt, acceptedAt: quote.acceptedAt },
          quote
        };
      }

      if (quote.status === "REJECTED" && dto.status !== "DRAFT") {
        throw new BadRequestException("Báo giá đã bị từ chối, chỉ có thể chuyển về nháp để chỉnh sửa");
      }

      if (dto.status === "ACCEPTED" && dto.acceptedItemIds?.length) {
        const quoteItemIds = new Set(quote.items.map((item) => item.id));
        const invalid = dto.acceptedItemIds.filter((itemId) => !quoteItemIds.has(itemId));
        if (invalid.length > 0) {
          throw new BadRequestException("Một số hạng mục được chốt không thuộc báo giá này");
        }
      }

      const resolvedAcceptedItemIds =
        dto.status === "ACCEPTED"
          ? (dto.acceptedItemIds?.length ? dto.acceptedItemIds : quote.items.map((item) => item.id))
          : [];

      const updatedQuote = await tx.quote.update({
        where: {
          id
        },
        data: {
          status: dto.status,
          acceptedItemIds: resolvedAcceptedItemIds,
          ...this.resolveQuoteStatusPayload(quote, dto.status)
        },
        select: {
          id: true,
          status: true,
          sentAt: true,
          acceptedAt: true
        }
      });

      const projectQuoteTotal = dto.status === "ACCEPTED"
        ? this.calculateAcceptedQuoteTotal(quote.items, quote.taxRate, resolvedAcceptedItemIds, quote.total)
        : Number(quote.total);

      await this.syncProjectStatusForQuote(tx, quote.projectId, quote.project.status, dto.status, projectQuoteTotal);

      return {
        updatedQuote,
        quote
      };
    })) as {
      updatedQuote: {
        id: string;
        status: string;
        sentAt: Date | null;
        acceptedAt: Date | null;
      };
      quote: {
        id: string;
        status: string;
        projectId: string;
        createdById: string;
      };
    };

    if (dto.status === "ACCEPTED" && result.quote.status !== "ACCEPTED") {
      void Promise.resolve(this.domainEvents
        .emit("quote.accepted", {
          quoteId: result.quote.id,
          projectId: result.quote.projectId,
          ownerUserId: result.quote.createdById,
          status: result.updatedQuote.status,
          acceptedAt: result.updatedQuote.acceptedAt
        }))
        .catch((err: unknown) =>
          this.logger.error("Domain event handler failed", { event: "quote.accepted", err })
        );
    }

    if (dto.status === "REJECTED" && result.quote.status !== "REJECTED") {
      void Promise.resolve(this.domainEvents
        .emit("quote.rejected", {
          quoteId: result.quote.id,
          projectId: result.quote.projectId,
          ownerUserId: result.quote.createdById,
          status: result.updatedQuote.status
        }))
        .catch((err: unknown) =>
          this.logger.error("Domain event handler failed", { event: "quote.rejected", err })
        );
    }

    return result.updatedQuote;
  }

  async bulk(dto: BulkQuoteDto, user: JwtUser) {
    const quotes = await this.prisma.quote.findMany({
      where: {
        ...this.buildWhere({}, user),
        id: {
          in: dto.ids
        }
      },
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
            name: true,
            customer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (dto.action === "export") {
      return {
        action: dto.action,
        items: quotes.map((quote) => ({
          id: quote.id,
          quoteNo: quote.quoteNo,
          status: quote.status,
          total: Number(quote.total),
          createdBy: quote.createdBy.name,
          projectName: quote.project.name,
          customerName: quote.project.customer.name,
          createdAt: quote.createdAt
        }))
      };
    }

    if (dto.action === "status" && dto.status) {
      await Promise.allSettled(quotes.map((quote) => this.updateStatus(quote.id, { status: dto.status! }, user)));
    }

    if (dto.action === "send") {
      await Promise.allSettled(quotes.map((quote) => this.send(quote.id, user)));
    }

    if (dto.action === "delete") {
      await this.prisma.quote.updateMany({
        where: { id: { in: quotes.map((q) => q.id) } },
        data: { deletedAt: new Date() }
      });
    }

    return {
      action: dto.action,
      processedCount: quotes.length
    };
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
      deletedAt: null,
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
      customerWhere.assignedTo = {
        isActive: true
      };
    }

    return {
      deletedAt: null,
      customer: customerWhere
    };
  }

  async remove(id: string, user: JwtUser) {
    const quote = await this.findAccessibleQuote(id, user);

    await this.prisma.quote.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return { success: true, id: quote.id };
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
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('quote_number'))`;
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

  private normalizeQuoteTableColumnWidths(input: unknown): QuoteTableColumnWidths | undefined {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return undefined;
    }

    const raw = input as Record<string, unknown>;
    const next = QUOTE_TABLE_COLUMN_KEYS.reduce<Partial<QuoteTableColumnWidths>>((result, key) => {
      const value = Number(raw[key]);
      if (Number.isFinite(value) && value > 0) {
        result[key] = Math.round(value * 100) / 100;
      }
      return result;
    }, {});

    return QUOTE_TABLE_COLUMN_KEYS.every((key) => typeof next[key] === "number")
      ? (next as QuoteTableColumnWidths)
      : undefined;
  }

  private buildTableColumnWidthsPayload(input: unknown): { tableColumnWidths: QuoteTableColumnWidths } | Record<string, never> {
    const tableColumnWidths = this.normalizeQuoteTableColumnWidths(input);
    return tableColumnWidths ? { tableColumnWidths } : {};
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
    quoteStatus: string,
    quoteTotal: number
  ) {
    const nextData: Prisma.ProjectUpdateInput = {};

    if (
      quoteStatus === "ACCEPTED" &&
      PRE_SALE_PROJECT_STATUSES.includes(currentStatus as (typeof PRE_SALE_PROJECT_STATUSES)[number])
    ) {
      nextData.status = "WON";
    }

    if (quoteStatus === "ACCEPTED" && Number.isFinite(quoteTotal)) {
      nextData.estimatedValue = quoteTotal;
    }

    if (currentStatus === "SURVEY" && quoteStatus !== "ACCEPTED") {
      nextData.status = "QUOTING";
    }

    if (Object.keys(nextData).length === 0) {
      return;
    }

    await tx.project.update({
      where: {
        id: projectId
      },
      data: nextData
    });
  }

  private calculateAcceptedQuoteTotal(
    quoteItems: Array<{
      id: string;
      total: Prisma.Decimal;
    }>,
    taxRate: Prisma.Decimal,
    acceptedItemIds: string[],
    fallbackTotal: Prisma.Decimal
  ) {
    const acceptedIds = new Set(acceptedItemIds);
    const scopedItems = acceptedIds.size > 0
      ? quoteItems.filter((item) => acceptedIds.has(item.id))
      : quoteItems;

    if (scopedItems.length === 0) {
      return decimalToNumber(fallbackTotal);
    }

    const subtotal = sumDecimal(scopedItems.map((item) => item.total));
    const taxAmount = subtotal.mul(taxRate).div(100).round();

    return decimalToNumber(subtotal.plus(taxAmount));
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short"
  }).format(value);
}
