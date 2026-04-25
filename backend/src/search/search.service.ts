import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { JwtUser, hasPermission, isStaff } from "../auth/auth.types";
import { SearchQueryDto } from "./dto/search-query.dto";

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(query: SearchQueryDto, user: JwtUser) {
    const q = query.q;
    const limit = query.limit ?? 8;
    const canViewCustomers = hasPermission(user, "customers.view");
    const canViewProjects = hasPermission(user, "projects.view");
    const canViewQuotes = hasPermission(user, "quotes.view");
    const canViewContracts = hasPermission(user, "contracts.view");
    const canViewActivities = hasPermission(user, "activities.view");

    const [customers, projects, quotes, contracts, activities] = await Promise.all([
      canViewCustomers ? this.prisma.customer.findMany({
        where: {
          deletedAt: null,
          ...(isStaff(user) ? { assignedToId: user.sub } : {}),
          OR: [{ name: { contains: q, mode: "insensitive" } }, { shortName: { contains: q, mode: "insensitive" } }]
        },
        take: limit,
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          id: true,
          name: true,
          shortName: true
        }
      }) : Promise.resolve([]),
      canViewProjects ? this.prisma.project.findMany({
        where: {
          deletedAt: null,
          ...(isStaff(user) ? { customer: { assignedToId: user.sub } } : {}),
          OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }]
        },
        take: limit,
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          id: true,
          name: true,
          code: true
        }
      }) : Promise.resolve([]),
      canViewQuotes ? this.prisma.quote.findMany({
        where: {
          ...(isStaff(user) ? { project: { customer: { assignedToId: user.sub } } } : {}),
          OR: [{ quoteNo: { contains: q, mode: "insensitive" } }, { project: { name: { contains: q, mode: "insensitive" } } }]
        },
        take: limit,
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          id: true,
          quoteNo: true,
          project: {
            select: {
              name: true
            }
          }
        }
      }) : Promise.resolve([]),
      canViewContracts ? this.prisma.contract.findMany({
        where: {
          ...(isStaff(user) ? { project: { customer: { assignedToId: user.sub } } } : {}),
          OR: [{ contractNo: { contains: q, mode: "insensitive" } }, { project: { name: { contains: q, mode: "insensitive" } } }]
        },
        take: limit,
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          id: true,
          contractNo: true,
          project: {
            select: {
              name: true
            }
          }
        }
      }) : Promise.resolve([]),
      canViewActivities ? this.prisma.activity.findMany({
        where: {
          deletedAt: null,
          ...(isStaff(user) ? { customer: { assignedToId: user.sub } } : {}),
          OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }]
        },
        take: limit,
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          id: true,
          title: true
        }
      }) : Promise.resolve([])
    ]);

    return [
      ...customers.map((item) => ({
        id: item.id,
        type: "customer",
        title: item.name,
        subtitle: item.shortName,
        href: `/customers/${item.id}`
      })),
      ...projects.map((item) => ({
        id: item.id,
        type: "project",
        title: item.name,
        subtitle: item.code,
        href: `/projects/${item.id}`
      })),
      ...quotes.map((item) => ({
        id: item.id,
        type: "quote",
        title: item.quoteNo,
        subtitle: item.project.name,
        href: `/quotes/${item.id}`
      })),
      ...contracts.map((item) => ({
        id: item.id,
        type: "contract",
        title: item.contractNo,
        subtitle: item.project.name,
        href: `/contracts/${item.id}`
      })),
      ...activities.map((item) => ({
        id: item.id,
        type: "activity",
        title: item.title,
        subtitle: "Hoạt động",
        href: `/activities/${item.id}`
      }))
    ].slice(0, limit * 3);
  }
}
