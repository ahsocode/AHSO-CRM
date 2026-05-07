import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RoleValue } from "../common/constants/role.constants";
import { PrismaService } from "../common/prisma.service";
import { buildCustomerCodePrefix } from "../common/utils/vietnamese";
import { JwtUser, isStaff } from "../auth/auth.types";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { BulkCustomerDto } from "./dto/bulk-customer.dto";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { CustomerFilterDto } from "./dto/customer-filter.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

const ACTIVE_PROJECT_STATUSES = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "DELIVERING"] as const;

const MAX_CODE_GENERATION_ATTEMPTS = 20;

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customFieldsService: CustomFieldsService,
    private readonly domainEvents: DomainEventsService
  ) {}

  async findAll(filters: CustomerFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters, user);
    const quarterStart = this.getQuarterStart();
    const lastThirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [customers, total, matchingCustomers] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isVip: "desc" }, { updatedAt: "desc" }],
        include: {
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
            take: 1,
            orderBy: {
              createdAt: "asc"
            }
          },
          _count: {
            select: {
              projects: {
                where: {
                  deletedAt: null
                }
              }
            }
          }
        }
      }),
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        select: {
          id: true,
          status: true,
          createdAt: true
        }
      })
    ]);

    const customerIds = matchingCustomers.map((customer) => customer.id);
    const contractIds = await this.getContractIdsByCustomerIds(customerIds);

    const quarterlyRevenue = contractIds.length > 0
      ? await this.prisma.payment.aggregate({
          _sum: {
            amount: true
          },
          where: {
            contractId: {
              in: contractIds
            },
            paidAt: {
              gte: quarterStart
            }
          }
        })
      : { _sum: { amount: null } };

    const activeCustomerCount = matchingCustomers.filter((customer) => customer.status === "ACTIVE").length;
    const newCustomerCount = matchingCustomers.filter((customer) => customer.createdAt >= lastThirtyDays).length;

    const items = customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      code: customer.code,
      language: customer.language,
      shortName: customer.shortName,
      taxCode: customer.taxCode,
      industry: customer.industry,
      address: customer.address,
      status: customer.status,
      isVip: customer.isVip,
      assignedTo: customer.assignedTo,
      primaryContact: customer.contacts[0]
        ? {
            id: customer.contacts[0].id,
            name: customer.contacts[0].name,
            title: customer.contacts[0].title,
            phone: customer.contacts[0].phone,
            email: customer.contacts[0].email
          }
        : null,
      projectCount: customer._count.projects,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        summary: {
          quarterlyRevenue: Number(quarterlyRevenue._sum.amount ?? 0),
          newCustomersLast30Days: newCustomerCount,
          retentionRate: total > 0 ? Number(((activeCustomerCount / total) * 100).toFixed(1)) : 0
        }
      }
    };
  }

  async findOne(id: string, user: JwtUser) {
    const customer = await this.findAccessibleCustomer(id, user);
    const stats = await this.getStats(id, user);

    const [contacts, projects, activities] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where: {
          customerId: id
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
      }),
      this.prisma.project.findMany({
        where: {
          customerId: id,
          deletedAt: null
        },
        include: {
          contract: {
            select: {
              id: true,
              contractNo: true,
              value: true,
              status: true
            }
          },
          _count: {
            select: {
              quotes: true,
              milestones: true
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 6
      }),
      this.prisma.activity.findMany({
        where: {
          customerId: id
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
      })
    ]);

    const customFieldValues = await this.customFieldsService.getValues("customer", id);

    return {
      id: customer.id,
      name: customer.name,
      code: customer.code,
      language: customer.language,
      shortName: customer.shortName,
      taxCode: customer.taxCode,
      industry: customer.industry,
      address: customer.address,
      website: customer.website,
      phone: customer.phone,
      email: customer.email,
      source: customer.source,
      notes: customer.notes,
      status: customer.status,
      isVip: customer.isVip,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      assignedTo: {
        id: customer.assignedTo.id,
        name: customer.assignedTo.name,
        role: customer.assignedTo.role
      },
      customFieldValues,
      stats,
      contacts: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        title: contact.title,
        email: contact.email,
        phone: contact.phone,
        isPrimary: contact.isPrimary,
        notes: contact.notes
      })),
      projects: projects.map((project) => ({
        id: project.id,
        code: project.code,
        name: project.name,
        status: project.status,
        priority: project.priority,
        estimatedValue: Number(project.estimatedValue ?? 0),
        expectedEndDate: project.expectedEndDate,
        progressPercent: this.mapProjectProgress(project.status),
        quoteCount: project._count.quotes,
        milestoneCount: project._count.milestones,
        contract: project.contract
          ? {
              id: project.contract.id,
              contractNo: project.contract.contractNo,
              value: Number(project.contract.value),
              status: project.contract.status
            }
          : null
      })),
      activities: activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        content: activity.content,
        type: activity.type,
        scheduledAt: activity.scheduledAt,
        doneAt: activity.doneAt,
        isCompleted: activity.isCompleted,
        attachmentUrl: activity.attachmentUrl,
        updatedAt: activity.updatedAt,
        user: activity.user
      }))
    };
  }

  async getStats(id: string, user: JwtUser) {
    const customer = await this.findAccessibleCustomer(id, user);

    const projects = await this.prisma.project.findMany({
      where: {
        customerId: id,
        deletedAt: null
      },
      include: {
        contract: {
          select: {
            value: true
          }
        }
      }
    });

    const totalContractValue = projects.reduce(
      (total, project) => total + Number(project.contract?.value ?? 0),
      0
    );
    const activeProjects = projects.filter((project) =>
      ACTIVE_PROJECT_STATUSES.includes(project.status as (typeof ACTIVE_PROJECT_STATUSES)[number])
    ).length;
    const recentQuoteCount = await this.prisma.quote.count({
      where: {
        project: {
          customerId: id
        }
      }
    });

    const firstProjectDate = projects
      .map((project) => project.startDate ?? project.createdAt)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return {
      totalContractValue,
      activeProjects,
      projectCount: projects.length,
      recentQuoteCount,
      customerSince: firstProjectDate ?? customer.createdAt
    };
  }

  async create(dto: CreateCustomerDto) {
    await this.ensureAssignedUserExists(dto.assignedToId);
    await this.ensureTaxCodeUnique(dto.taxCode);
    const { customFieldValues, ...customerData } = dto;

    // Auto-generate a customer code if the caller did not supply one.
    // Fall back to a random suffix if sequential generation can't find a
    // free slot — unique constraint still protects us at the DB layer.
    if (!customerData.code) {
      customerData.code = await this.generateCustomerCode(customerData.name);
    } else {
      await this.ensureCustomerCodeUnique(customerData.code);
    }

    const customer = await this.prisma.customer.create({
      data: customerData,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });

    await this.customFieldsService.saveValues("customer", customer.id, customFieldValues);

    void this.domainEvents.emit("customer.created", {
      customerId: customer.id,
      name: customer.name,
      status: customer.status,
      assignedToId: customer.assignedTo.id
    });
    void this.domainEvents.emit("customer.assigned", {
      customerId: customer.id,
      customerName: customer.name,
      assignedToId: customer.assignedTo.id
    });

    return customer;
  }

  async upsertFromImport(dto: CreateCustomerDto): Promise<{ id: string; isNew: boolean }> {
    // Priority 1: match by taxCode (most reliable unique identifier)
    if (dto.taxCode) {
      const existing = await this.prisma.customer.findFirst({
        where: { taxCode: dto.taxCode, deletedAt: null },
        select: { id: true }
      });
      if (existing) {
        await this.applyImportUpdate(existing.id, dto, { skipTaxCode: true });
        return { id: existing.id, isNew: false };
      }
    }

    // Priority 2: match by name (case-insensitive exact match)
    const existingByName = await this.prisma.customer.findFirst({
      where: { name: { equals: dto.name, mode: "insensitive" }, deletedAt: null },
      select: { id: true }
    });
    if (existingByName) {
      await this.applyImportUpdate(existingByName.id, dto, { skipTaxCode: false });
      return { id: existingByName.id, isNew: false };
    }

    // No match — create a new record
    const created = await this.create(dto);
    return { id: created.id, isNew: true };
  }

  private async applyImportUpdate(
    id: string,
    dto: CreateCustomerDto,
    options: { skipTaxCode: boolean }
  ) {
    const { customFieldValues, code: _code, ...fields } = dto;

    // Build update payload — only include fields with actual values to avoid
    // clearing existing data with empty CSV cells.
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (key === "taxCode" && options.skipTaxCode) continue;
      if (value !== undefined && value !== null && value !== "") {
        updateData[key] = value;
      }
    }

    await this.prisma.customer.update({ where: { id }, data: updateData });
    await this.customFieldsService.saveValues("customer", id, customFieldValues);
  }

  async update(id: string, dto: UpdateCustomerDto, user: JwtUser) {
    const previousCustomer = await this.findAccessibleCustomer(id, user);

    if (dto.assignedToId) {
      await this.ensureAssignedUserExists(dto.assignedToId);
    }

    if (dto.taxCode) {
      await this.ensureTaxCodeUnique(dto.taxCode, id);
    }
    if (dto.code) {
      await this.ensureCustomerCodeUnique(dto.code, id);
    }
    const { customFieldValues, ...customerData } = dto;

    const customer = await this.prisma.customer.update({
      where: {
        id
      },
      data: customerData,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });

    await this.customFieldsService.saveValues("customer", customer.id, customFieldValues);

    void this.domainEvents.emit("customer.updated", {
      customerId: customer.id,
      name: customer.name,
      status: customer.status,
      assignedToId: customer.assignedTo.id
    });

    if (previousCustomer.assignedToId !== customer.assignedTo.id) {
      void this.domainEvents.emit("customer.assigned", {
        customerId: customer.id,
        customerName: customer.name,
        assignedToId: customer.assignedTo.id
      });
    }

    return customer;
  }

  async remove(id: string, user: JwtUser) {
    const customer = await this.findAccessibleCustomer(id, user);

    await this.prisma.customer.update({
      where: {
        id
      },
      data: {
        deletedAt: new Date()
      }
    });

    void this.domainEvents.emit("customer.deleted", {
      customerId: customer.id,
      name: customer.name,
      status: customer.status
    });

    return {
      success: true
    };
  }

  async restore(id: string, user: JwtUser) {
    const customer = await this.findDeletedAccessibleCustomer(id, user);

    if (!customer.deletedAt) {
      throw new BadRequestException("Khách hàng chưa bị xóa");
    }

    const restored = await this.prisma.customer.update({
      where: {
        id
      },
      data: {
        deletedAt: null
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });

    void this.domainEvents.emit("customer.updated", {
      customerId: restored.id,
      name: restored.name,
      status: restored.status
    });

    return restored;
  }

  async findDeleted(filters: CustomerFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildDeletedWhere(filters, user);

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          deletedAt: "desc"
        },
        include: {
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
            take: 1,
            orderBy: {
              createdAt: "asc"
            }
          }
        }
      }),
      this.prisma.customer.count({ where })
    ]);

    return {
      items: customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        code: customer.code,
        language: customer.language,
        shortName: customer.shortName,
        taxCode: customer.taxCode,
        industry: customer.industry,
        address: customer.address,
        status: customer.status,
        isVip: customer.isVip,
        assignedTo: customer.assignedTo,
        primaryContact: customer.contacts[0]
          ? {
              id: customer.contacts[0].id,
              name: customer.contacts[0].name,
              title: customer.contacts[0].title,
              phone: customer.contacts[0].phone,
              email: customer.contacts[0].email
            }
          : null,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        deletedAt: customer.deletedAt
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async bulk(dto: BulkCustomerDto, user: JwtUser) {
    const accessibleCustomers = await this.prisma.customer.findMany({
      where: {
        ...this.buildWhere({}, user),
        id: {
          in: dto.ids
        }
      },
      include: {
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
          take: 1
        },
        _count: {
          select: {
            projects: {
              where: {
                deletedAt: null
              }
            }
          }
        }
      }
    });

    if (dto.action === "export") {
      return {
        action: dto.action,
        items: accessibleCustomers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          shortName: customer.shortName,
          status: customer.status,
          industry: customer.industry,
          assignedTo: customer.assignedTo.name,
          projectCount: customer._count.projects,
          primaryContact: customer.contacts[0]?.name ?? null,
          updatedAt: customer.updatedAt
        }))
      };
    }

    if (dto.action === "assign" && dto.assignedToId) {
      await this.ensureAssignedUserExists(dto.assignedToId);
      await this.prisma.customer.updateMany({
        where: {
          id: {
            in: accessibleCustomers.map((item) => item.id)
          }
        },
        data: {
          assignedToId: dto.assignedToId
        }
      });

      await Promise.allSettled(
        accessibleCustomers.map((customer) =>
          this.domainEvents.emit("customer.assigned", {
            customerId: customer.id,
            customerName: customer.name,
            assignedToId: dto.assignedToId
          })
        )
      );
    }

    if (dto.action === "delete") {
      await this.prisma.customer.updateMany({
        where: {
          id: {
            in: accessibleCustomers.map((item) => item.id)
          }
        },
        data: {
          deletedAt: new Date()
        }
      });
    }

    return {
      action: dto.action,
      processedCount: accessibleCustomers.length
    };
  }

  async assertCustomerAccess(id: string, user: JwtUser) {
    await this.findAccessibleCustomer(id, user);
  }

  private buildWhere(filters: Partial<CustomerFilterDto>, user: JwtUser): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null
    };

    if (isStaff(user)) {
      where.assignedToId = user.sub;
    }

    if (filters.search) {
      where.OR = [
        {
          name: {
            contains: filters.search,
            mode: "insensitive"
          }
        },
        {
          shortName: {
            contains: filters.search,
            mode: "insensitive"
          }
        },
        {
          taxCode: {
            contains: filters.search,
            mode: "insensitive"
          }
        },
        {
          email: {
            contains: filters.search,
            mode: "insensitive"
          }
        },
        {
          phone: {
            contains: filters.search,
            mode: "insensitive"
          }
        }
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.industry) {
      where.industry = {
        contains: filters.industry,
        mode: "insensitive"
      };
    }

    if (filters.assignedToId && !isStaff(user)) {
      where.assignedToId = filters.assignedToId;
    }

    if (typeof filters.isVip === "boolean") {
      where.isVip = filters.isVip;
    }

    return where;
  }

  private buildDeletedWhere(filters: Partial<CustomerFilterDto>, user: JwtUser): Prisma.CustomerWhereInput {
    return {
      ...this.buildWhere(filters, user),
      deletedAt: {
        not: null
      }
    };
  }

  private async findDeletedAccessibleCustomer(id: string, user: JwtUser) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        ...this.buildDeletedWhere({}, user),
        id
      },
      select: {
        id: true,
        name: true,
        status: true,
        deletedAt: true
      }
    });

    if (!customer) {
      throw new NotFoundException("Không tìm thấy khách hàng đã xóa");
    }

    return customer;
  }

  private async findAccessibleCustomer(id: string, user: JwtUser) {
    const where = this.buildWhere({}, user);
    const customer = await this.prisma.customer.findFirst({
      where: {
        ...where,
        id
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });

    if (!customer) {
      throw new NotFoundException("Không tìm thấy khách hàng");
    }

    if (isStaff(user) && customer.assignedTo.id !== user.sub) {
      throw new ForbiddenException("Bạn không có quyền truy cập khách hàng này");
    }

    return customer;
  }

  private async ensureAssignedUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      throw new NotFoundException("Không tìm thấy người phụ trách hợp lệ");
    }
  }

  /**
   * Generate a unique customer code in the `AAA999` format. Tries sequential
   * suffixes (001, 002, …) starting from the current count of customers
   * sharing the prefix. Falls back to random 3-digit suffixes after
   * {@link MAX_CODE_GENERATION_ATTEMPTS} collisions.
   */
  private async generateCustomerCode(name: string): Promise<string> {
    const prefix = buildCustomerCodePrefix(name);

    // Find the highest existing numeric suffix for this prefix so new codes
    // slot in after it rather than always starting at 001.
    const existing = await this.prisma.customer.findMany({
      where: {
        code: { startsWith: prefix }
      },
      select: { code: true }
    });

    let nextNumber = 1;
    for (const row of existing) {
      if (!row.code) continue;
      const suffix = row.code.slice(3);
      const n = Number.parseInt(suffix, 10);
      if (Number.isFinite(n) && n >= nextNumber) nextNumber = n + 1;
    }

    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const candidate = `${prefix}${String(nextNumber + attempt).padStart(3, "0")}`;
      const conflict = await this.prisma.customer.findUnique({
        where: { code: candidate },
        select: { id: true }
      });
      if (!conflict) return candidate;
    }

    // Very unlikely — random fallback so we never block customer creation.
    const random = Math.floor(Math.random() * 900 + 100);
    const fallback = `${prefix}${random}`;
    this.logger.warn(
      `Sequential customer code generation exhausted for prefix ${prefix}; falling back to ${fallback}`
    );
    return fallback;
  }

  private async ensureCustomerCodeUnique(code: string, excludeId?: string) {
    const existing = await this.prisma.customer.findFirst({
      where: {
        code,
        ...(excludeId ? { id: { not: excludeId } } : {})
      },
      select: { id: true }
    });
    if (existing) {
      throw new ForbiddenException("Mã khách hàng đã tồn tại");
    }
  }

  private async ensureTaxCodeUnique(taxCode?: string, excludeId?: string) {
    if (!taxCode) {
      return;
    }

    const existingCustomer = await this.prisma.customer.findFirst({
      where: {
        taxCode,
        ...(excludeId
          ? {
              id: {
                not: excludeId
              }
            }
          : {})
      },
      select: {
        id: true
      }
    });

    if (existingCustomer) {
      throw new ForbiddenException("Mã số thuế đã tồn tại trong hệ thống");
    }
  }

  private async getContractIdsByCustomerIds(customerIds: string[]) {
    if (customerIds.length === 0) {
      return [];
    }

    const projects = await this.prisma.project.findMany({
      where: {
        customerId: {
          in: customerIds
        },
        deletedAt: null
      },
      select: {
        contract: {
          select: {
            id: true
          }
        }
      }
    });

    return projects
      .map((project) => project.contract?.id)
      .filter((id): id is string => Boolean(id));
  }

  private getQuarterStart() {
    const now = new Date();
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), quarterMonth, 1);
  }

  async findDuplicates() {
    const customers = await this.prisma.customer.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        taxCode: true,
        code: true,
        phone: true,
        email: true,
        address: true,
        industry: true,
        status: true,
        createdAt: true,
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { projects: true, contacts: true, activities: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    const groups = new Map<string, typeof customers>();
    for (const customer of customers) {
      const key = this.normalizeForDedup(customer.name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(customer);
    }

    return Array.from(groups.values())
      .filter((group) => group.length >= 2)
      .map((group) => ({ customers: group }));
  }

  async merge(primaryId: string, duplicateIds: string[]) {
    await this.prisma.$transaction(async (tx) => {
      const primary = await tx.customer.findFirstOrThrow({
        where: { id: primaryId, deletedAt: null },
        select: { id: true, taxCode: true, code: true }
      });

      for (const dupId of duplicateIds) {
        const duplicate = await tx.customer.findFirstOrThrow({
          where: { id: dupId, deletedAt: null },
          select: { id: true, taxCode: true, code: true }
        });

        // Null out unique fields on duplicate first to avoid constraint violations
        await tx.customer.update({
          where: { id: dupId },
          data: { taxCode: null, code: null }
        });

        // Adopt taxCode from duplicate if primary has none
        if (!primary.taxCode && duplicate.taxCode) {
          await tx.customer.update({ where: { id: primaryId }, data: { taxCode: duplicate.taxCode } });
          primary.taxCode = duplicate.taxCode;
        }

        // Reassign all relations
        await tx.contact.updateMany({ where: { customerId: dupId }, data: { customerId: primaryId } });
        await tx.project.updateMany({ where: { customerId: dupId }, data: { customerId: primaryId } });
        await tx.activity.updateMany({ where: { customerId: dupId }, data: { customerId: primaryId } });
        await tx.document.updateMany({ where: { customerId: dupId }, data: { customerId: primaryId } });
        await tx.businessDocument.updateMany({ where: { customerId: dupId }, data: { customerId: primaryId } });
        await tx.survey.updateMany({ where: { customerId: dupId }, data: { customerId: primaryId } });

        // Merge custom field values — skip fields already set on primary
        const primaryFieldIds = new Set(
          (await tx.customFieldValue.findMany({
            where: { resourceId: primaryId },
            select: { fieldId: true }
          })).map((v) => v.fieldId)
        );

        await tx.customFieldValue.updateMany({
          where: { resourceId: dupId, fieldId: { notIn: [...primaryFieldIds] } },
          data: { resourceId: primaryId }
        });
        await tx.customFieldValue.deleteMany({ where: { resourceId: dupId } });

        // Soft-delete the duplicate
        await tx.customer.update({ where: { id: dupId }, data: { deletedAt: new Date() } });
      }
    });

    return { success: true };
  }

  private normalizeForDedup(name: string): string {
    return name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
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
