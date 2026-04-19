import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/common/prisma.service";

export interface PermissionGroup {
  resource: string;
  permissions: Array<{
    id: string;
    action: string;
  }>;
}

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all permissions grouped by resource
   */
  async getAllPermissions(): Promise<PermissionGroup[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });

    const grouped: Record<string, PermissionGroup> = {};

    for (const perm of permissions) {
      if (!grouped[perm.resource]) {
        grouped[perm.resource] = {
          resource: perm.resource,
          permissions: [],
        };
      }

      grouped[perm.resource].permissions.push({
        id: perm.id,
        action: perm.action,
      });
    }

    return Object.values(grouped);
  }

  /**
   * Get available actions for a resource
   */
  async getActionsForResource(resource: string) {
    return this.prisma.permission.findMany({
      where: { resource },
      select: { id: true, action: true },
      orderBy: { action: "asc" },
    });
  }

  /**
   * Get all resources
   */
  async getResources() {
    const permissions = await this.prisma.permission.findMany({
      select: { resource: true },
      distinct: ["resource"],
      orderBy: { resource: "asc" },
    });

    return permissions.map((p) => p.resource);
  }
}
