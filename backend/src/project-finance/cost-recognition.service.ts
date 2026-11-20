import { BadRequestException, Injectable } from "@nestjs/common";
import { JwtUser, isAdmin } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { findAccessibleProject, lockProjectFinance } from "../boms/project-access";
import { PrismaService } from "../common/prisma.service";
import { assertCanApprove, assertPeriodOpen } from "../inventory/inventory-controls";
import type { RecognizeCostDto } from "./dto/project-finance.dto";

@Injectable()
export class CostRecognitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async recognize(projectId: string, dto: RecognizeCostDto, user: JwtUser) {
    await findAccessibleProject(this.prisma, projectId, user);
    const result = dto.action === "DELIVER" ? await this.deliver(projectId, dto, user) : await this.reopen(projectId, dto, user);
    return result;
  }

  private async deliver(projectId: string, dto: RecognizeCostDto, user: JwtUser) {
    const reason = dto.reason?.trim() ?? "";
    const recognizedAt = dto.recognizedAt ?? new Date();
    await assertPeriodOpen(this.prisma, recognizedAt, "ghi nhận giá vốn");

    const outcome = await this.prisma.$transaction(async (tx) => {
      // Same advisory lock as cost/allocation edits, so no cost can slip in while we flip the status.
      await lockProjectFinance(tx, projectId);
      const project = await tx.project.findFirst({
        where: { id: projectId },
        select: { id: true, costRecognitionStatus: true, costRecognizedAt: true }
      });
      if (!project) throw new BadRequestException("Không tìm thấy dự án");
      if (project.costRecognitionStatus === "DELIVERED") {
        return { changed: false as const, project };
      }

      const invoiceCount = await tx.salesInvoice.count({ where: { projectId, deletedAt: null, status: "ISSUED" } });
      let overridden = false;
      if (invoiceCount === 0) {
        if (!(dto.overrideNoInvoice && isAdmin(user))) {
          throw new BadRequestException(
            "Dự án chưa có hóa đơn bán ra nào còn hiệu lực. Hãy liên kết hóa đơn bán ra trước khi ghi nhận giá vốn " +
              "(chỉ ADMIN được ghi nhận không có hóa đơn, kèm lý do)"
          );
        }
        if (reason.length < 5) throw new BadRequestException("Ghi nhận giá vốn không có hóa đơn cần lý do tối thiểu 5 ký tự");
        overridden = true;
      }

      const updated = await tx.project.update({
        where: { id: projectId },
        data: { costRecognitionStatus: "DELIVERED", costRecognizedAt: recognizedAt },
        select: { id: true, costRecognitionStatus: true, costRecognizedAt: true }
      });
      return { changed: true as const, project: updated, before: project, overridden, invoiceCount };
    });

    if (outcome.changed) {
      await this.audit.record({
        userId: user.sub,
        action: "project.cost-recognition.deliver",
        resource: "projects",
        resourceId: projectId,
        changes: {
          before: outcome.before,
          after: outcome.project,
          reason: reason || null,
          overrideNoInvoice: outcome.overridden,
          invoiceCount: outcome.invoiceCount
        }
      });
    }
    return {
      projectId,
      costRecognitionStatus: outcome.project.costRecognitionStatus,
      costRecognizedAt: outcome.project.costRecognizedAt,
      changed: outcome.changed
    };
  }

  private async reopen(projectId: string, dto: RecognizeCostDto, user: JwtUser) {
    assertCanApprove(user);
    const reason = dto.reason?.trim() ?? "";
    if (reason.length < 5) throw new BadRequestException("Mở lại ghi nhận giá vốn cần lý do tối thiểu 5 ký tự");

    const outcome = await this.prisma.$transaction(async (tx) => {
      await lockProjectFinance(tx, projectId);
      const project = await tx.project.findFirst({
        where: { id: projectId },
        select: { id: true, costRecognitionStatus: true, costRecognizedAt: true }
      });
      if (!project) throw new BadRequestException("Không tìm thấy dự án");
      if (project.costRecognitionStatus !== "DELIVERED") {
        throw new BadRequestException("Dự án chưa ở trạng thái DELIVERED nên không cần mở lại");
      }
      // Reopening rewrites a recognised period, so that period must still be open.
      await assertPeriodOpen(tx, project.costRecognizedAt ?? new Date(), "ghi nhận giá vốn");
      const updated = await tx.project.update({
        where: { id: projectId },
        data: { costRecognitionStatus: "IN_PROGRESS", costRecognizedAt: null },
        select: { id: true, costRecognitionStatus: true, costRecognizedAt: true }
      });
      return { before: project, after: updated };
    });

    await this.audit.record({
      userId: user.sub,
      action: "project.cost-recognition.reopen",
      resource: "projects",
      resourceId: projectId,
      changes: { before: outcome.before, after: outcome.after, reason }
    });
    return {
      projectId,
      costRecognitionStatus: outcome.after.costRecognitionStatus,
      costRecognizedAt: outcome.after.costRecognizedAt,
      changed: true
    };
  }
}
