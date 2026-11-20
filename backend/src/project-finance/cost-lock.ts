import { BadRequestException } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const PROJECT_DELIVERED_COST_MESSAGE =
  "Dự án đã bàn giao (DELIVERED), giá vốn đã được ghi nhận nên không thể thêm/sửa/xóa chi phí. " +
  "Hãy mở lại ghi nhận giá vốn (REOPEN, cần quyền duyệt kho) hoặc lập khoản điều chỉnh ở kỳ hiện tại.";

/**
 * Rejects cost mutations on a project whose cost has been recognised (DELIVERED).
 * Shared by boms/project-costs.service and project-finance services; stock-issues checks the same status.
 */
export async function assertProjectCostOpen(db: Db, projectId: string | null | undefined) {
  if (!projectId) return;
  const project = await db.project.findFirst({
    where: { id: projectId },
    select: { id: true, costRecognitionStatus: true }
  });
  if (project?.costRecognitionStatus === "DELIVERED") {
    throw new BadRequestException(PROJECT_DELIVERED_COST_MESSAGE);
  }
}
