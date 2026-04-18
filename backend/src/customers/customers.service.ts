import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RoleValue } from "../common/constants/role.constants";
import { PrismaService } from "../common/prisma.service";
import { JwtUser } from "../auth/auth.types";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { CustomerFilterDto } from "./dto/customer-filter.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

const ACTIVE_PROJECT_STATUSES = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "DELIVERING"] as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      id: customer.id,
      name: customer.name,
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

    const customer = await this.prisma.customer.create({
      data: dto,
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

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, user: JwtUser) {
    await this.findAccessibleCustomer(id, user);

    if (dto.assignedToId) {
      await this.ensureAssignedUserExists(dto.assignedToId);
    }

    if (dto.taxCode) {
      await this.ensureTaxCodeUnique(dto.taxCode, id);
    }

    const customer = await this.prisma.customer.update({
      where: {
        id
      },
      data: dto,
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

    return customer;
  }

  async remove(id: string, user: JwtUser) {
    await this.findAccessibleCustomer(id, user);

    await this.prisma.customer.update({
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

  async assertCustomerAccess(id: string, user: JwtUser) {
    await this.findAccessibleCustomer(id, user);
  }

  private buildWhere(filters: Partial<CustomerFilterDto>, user: JwtUser): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null
    };

    if (user.role === "STAFF") {
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

    if (filters.assignedToId && user.role !== "STAFF") {
      where.assignedToId = filters.assignedToId;
    }

    if (typeof filters.isVip === "boolean") {
      where.isVip = filters.isVip;
    }

    return where;
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

    if (user.role === "STAFF" && customer.assignedTo.id !== user.sub) {
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
