import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { EmailService } from "./email.service";

@Injectable()
export class EmailSchedulerService {
  private readonly logger = new Logger(EmailSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService
  ) {}

  // Run every hour on the hour; the handler checks whether the current hour
  // matches the configured sendHour so admins can change the time without a restart.
  @Cron("0 * * * *")
  async sendDailyReminders() {
    const settings = await this.settingsService.getNotificationSettings();

    if (!settings.enabled) {
      return;
    }

    const currentHour = new Date().getHours();
    if (currentHour !== settings.sendHour) {
      return;
    }

    await Promise.all([
      this.sendMilestoneReminders(settings.milestoneDaysAhead),
      this.sendPaymentReminders(settings.paymentDaysAhead),
    ]);
  }

  private async sendMilestoneReminders(daysAhead: number) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const milestones = await this.prisma.milestone.findMany({
      where: {
        dueDate: { gte: now, lte: cutoff },
        status: { in: ["PENDING", "IN_PROGRESS"] },
        contractId: { not: null },
      },
      include: {
        project: {
          select: {
            code: true,
            name: true,
            customer: {
              select: {
                name: true,
                assignedTo: { select: { email: true, name: true } },
              },
            },
          },
        },
        contract: { select: { contractNo: true } },
      },
    });

    await Promise.allSettled(
      milestones.map(async (milestone) => {
        const recipient = milestone.project.customer.assignedTo.email;
        if (!recipient) return;

        await this.emailService.sendEmail(
          recipient,
          `Nhắc việc milestone sắp đến hạn - ${milestone.project.code}`,
          "milestone-reminder",
          {
            recipientName: milestone.project.customer.assignedTo.name,
            milestoneName: milestone.name,
            dueDate: milestone.dueDate?.toLocaleDateString("vi-VN") ?? "Chưa xác định",
            projectCode: milestone.project.code,
            projectName: milestone.project.name,
            customerName: milestone.project.customer.name,
            contractNo: milestone.contract?.contractNo ?? "Chưa có",
          }
        );
      })
    );

    if (milestones.length > 0) {
      this.logger.log(`Đã xử lý ${milestones.length} reminder milestone.`);
    }
  }

  private async sendPaymentReminders(daysAhead: number) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const milestones = await this.prisma.milestone.findMany({
      where: {
        dueDate: { gte: now, lte: cutoff },
        paymentAmount: { not: null },
        status: { notIn: ["DONE", "ACCEPTED"] },
        contractId: { not: null },
      },
      include: {
        project: {
          select: {
            code: true,
            name: true,
            customer: {
              select: {
                name: true,
                assignedTo: { select: { email: true, name: true } },
                contacts: {
                  where: { isPrimary: true },
                  select: { email: true, name: true },
                  take: 1,
                },
              },
            },
          },
        },
        contract: { select: { contractNo: true } },
      },
    });

    await Promise.allSettled(
      milestones.map(async (milestone) => {
        const recipients = [
          milestone.project.customer.assignedTo.email,
          milestone.project.customer.contacts[0]?.email,
        ].filter((value): value is string => Boolean(value));

        if (recipients.length === 0) return;

        await this.emailService.sendEmail(
          recipients,
          `Nhắc thanh toán sắp đến hạn - ${milestone.project.code}`,
          "payment-due",
          {
            recipientName:
              milestone.project.customer.contacts[0]?.name ??
              milestone.project.customer.assignedTo.name,
            milestoneName: milestone.name,
            dueDate: milestone.dueDate?.toLocaleDateString("vi-VN") ?? "Chưa xác định",
            amount: Number(milestone.paymentAmount ?? 0).toLocaleString("vi-VN"),
            projectCode: milestone.project.code,
            projectName: milestone.project.name,
            customerName: milestone.project.customer.name,
            contractNo: milestone.contract?.contractNo ?? "Chưa có",
          }
        );
      })
    );

    if (milestones.length > 0) {
      this.logger.log(`Đã xử lý ${milestones.length} reminder thanh toán.`);
    }
  }
}
