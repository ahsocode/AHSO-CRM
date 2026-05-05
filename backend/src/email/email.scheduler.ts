import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma.service";
import { EmailService } from "./email.service";

@Injectable()
export class EmailSchedulerService {
  private readonly logger = new Logger(EmailSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDailyReminders() {
    await Promise.all([this.sendMilestoneReminders(), this.sendPaymentReminders()]);
  }

  private async sendMilestoneReminders() {
    const now = new Date();
    const nextTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const milestones = await this.prisma.milestone.findMany({
      where: {
        dueDate: {
          gte: now,
          lte: nextTwoDays
        },
        status: {
          in: ["PENDING", "IN_PROGRESS"]
        },
        contractId: {
          not: null
        }
      },
      include: {
        project: {
          select: {
            code: true,
            name: true,
            customer: {
              select: {
                name: true,
                assignedTo: {
                  select: {
                    email: true,
                    name: true
                  }
                }
              }
            }
          }
        },
        contract: {
          select: {
            contractNo: true
          }
        }
      }
    });

    await Promise.allSettled(
      milestones.map(async (milestone) => {
        const recipient = milestone.project.customer.assignedTo.email;
        if (!recipient) {
          return;
        }

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
            contractNo: milestone.contract?.contractNo ?? "Chưa có"
          }
        );
      })
    );

    if (milestones.length > 0) {
      this.logger.log(`Đã xử lý ${milestones.length} reminder milestone.`);
    }
  }

  private async sendPaymentReminders() {
    const now = new Date();
    const nextThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const milestones = await this.prisma.milestone.findMany({
      where: {
        dueDate: {
          gte: now,
          lte: nextThreeDays
        },
        paymentAmount: {
          not: null
        },
        status: {
          notIn: ["DONE", "ACCEPTED"]
        },
        contractId: {
          not: null
        }
      },
      include: {
        project: {
          select: {
            code: true,
            name: true,
            customer: {
              select: {
                name: true,
                assignedTo: {
                  select: {
                    email: true,
                    name: true
                  }
                },
                contacts: {
                  where: {
                    isPrimary: true
                  },
                  select: {
                    email: true,
                    name: true
                  },
                  take: 1
                }
              }
            }
          }
        },
        contract: {
          select: {
            contractNo: true
          }
        }
      }
    });

    await Promise.allSettled(
      milestones.map(async (milestone) => {
        const recipients = [
          milestone.project.customer.assignedTo.email,
          milestone.project.customer.contacts[0]?.email
        ].filter((value): value is string => Boolean(value));

        if (recipients.length === 0) {
          return;
        }

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
            contractNo: milestone.contract?.contractNo ?? "Chưa có"
          }
        );
      })
    );

    if (milestones.length > 0) {
      this.logger.log(`Đã xử lý ${milestones.length} reminder thanh toán.`);
    }
  }
}
