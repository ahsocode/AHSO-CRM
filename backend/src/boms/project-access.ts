import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { hasPermission, JwtUser } from "../auth/auth.types";
import type { PrismaService } from "../common/prisma.service";
import type { Prisma } from "@prisma/client";
import { buildWhere } from "../projects/project-where";

/** Returns the project when the user may see it (STAFF scoping via project-where). */
export async function findAccessibleProject(prisma: PrismaService, id: string, user: JwtUser) {
  const project = await prisma.project.findFirst({
    where: { ...buildWhere({}, user), id },
    select: { id: true, code: true, name: true, status: true }
  });
  if (!project) {
    throw new NotFoundException("Không tìm thấy dự án");
  }
  return project;
}

export function assertPermission(user: JwtUser, permission: string) {
  if (!hasPermission(user, permission)) {
    throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
  }
}

/** All edits to allocations and their direct costs share the confirmation lock. */
export async function lockProjectFinance(tx: Prisma.TransactionClient, projectId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('confirm_material_alloc_' || ${projectId}))`;
}
