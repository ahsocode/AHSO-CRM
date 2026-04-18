import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";

const ACTIVE_PROJECT_STATUSES = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "DELIVERING"] as const;
const PENDING_QUOTE_STATUSES = ["DRAFT", "SENT"] as const;
const PIPELINE_STAGE_CONFIG = [
  { status: "SURVEY", label: "Khảo sát", color: "stage-survey" },
  { status: "QUOTING", label: "Báo giá", color: "stage-quoting" },
  { status: "NEGOTIATING", label: "Đàm phán", color: "stage-negotiating" },
  { status: "DELIVERING", label: "Triển khai", color: "stage-delivering" },
  { status: "COMPLETED", label: "Hoàn thành", color: "stage-completed" }
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const payments = await this.prisma.payment.findMany({
      where: {
        paidAt: {
          gte: previousMonthStart,
          lt: nextMonthStart
        }
      },
      include: {
        contract: true
      }
    });

    const activeProjects = await this.prisma.project.count({
      where: {
        deletedAt: null,
        status: {
          in: [...ACTIVE_PROJECT_STATUSES]
        }
      }
    });

    const pendingQuotes = await this.prisma.quote.findMany({
      where: {
        status: {
          in: [...PENDING_QUOTE_STATUSES]
        }
      }
    });

    const contracts = await this.prisma.contract.findMany({
      include: {
        payments: true
      }
    });

    const currentMonthRevenue = this.sumCurrency(
      payments.filter((payment) => payment.paidAt >= currentMonthStart).map((payment) => payment.amount)
    );
    const previousMonthRevenue = this.sumCurrency(
      payments
        .filter((payment) => payment.paidAt >= previousMonthStart && payment.paidAt < currentMonthStart)
        .map((payment) => payment.amount)
    );

    const revenueChange = previousMonthRevenue === 0
      ? 100
      : Number((((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100).toFixed(1));

    const outstandingContracts = contracts.map((contract) => {
      const paidAmount = this.sumCurrency(contract.payments.map((payment) => payment.amount));
      const remainingAmount = Number(contract.value) - paidAmount;

      return {
        remainingAmount
      };
    });

    const outstandingDebt = outstandingContracts.reduce((total, contract) => total + Math.max(0, contract.remainingAmount), 0);
    const overdueCustomers = outstandingContracts.filter((contract) => contract.remainingAmount > 0).length;
    const pendingQuoteValue = pendingQuotes.reduce((total, quote) => total + Number(quote.total), 0);

    return {
      monthlyRevenue: {
        value: currentMonthRevenue,
        changePercent: revenueChange
      },
      activeProjects: {
        value: activeProjects
      },
      pendingQuotes: {
        value: pendingQuotes.length,
        totalValue: pendingQuoteValue
      },
      outstandingDebt: {
        value: outstandingDebt,
        overdueCustomers
      }
    };
  }

  async getRevenueChart() {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);

    const payments = await this.prisma.payment.findMany({
      where: {
        paidAt: {
          gte: start
        }
      },
      orderBy: {
        paidAt: "asc"
      }
    });

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(end.getFullYear(), end.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const revenue = payments
        .filter((payment) => payment.paidAt.getFullYear() === date.getFullYear() && payment.paidAt.getMonth() === date.getMonth())
        .reduce((total, payment) => total + Number(payment.amount), 0);

      return {
        month: date.toLocaleDateString("vi-VN", { month: "short" }).replace(".", ""),
        revenue,
        target: 200000000,
        key
      };
    });

    return months.map(({ key, ...item }) => item);
  }

  async getPipeline() {
    const projects = await this.prisma.project.findMany({
      where: {
        deletedAt: null
      },
      include: {
        customer: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return PIPELINE_STAGE_CONFIG.map((stage) => {
      const stageProjects = projects.filter((project) => project.status === stage.status);

      return {
        status: stage.status,
        label: stage.label,
        color: stage.color,
        count: stageProjects.length,
        totalValue: stageProjects.reduce((total, project) => total + Number(project.estimatedValue ?? 0), 0),
        items: stageProjects.slice(0, 3).map((project) => ({
          id: project.id,
          code: project.code,
          name: project.name,
          customerName: project.customer.name,
          estimatedValue: Number(project.estimatedValue ?? 0),
          priority: project.priority
        }))
      };
    });
  }

  async getTasksToday() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const tasks = await this.prisma.activity.findMany({
      where: {
        scheduledAt: {
          gte: start,
          lte: end
        },
        isCompleted: false
      },
      include: {
        user: true,
        customer: true
      },
      orderBy: {
        scheduledAt: "asc"
      }
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: task.type,
      scheduledAt: task.scheduledAt,
      customerName: task.customer?.name ?? "Chưa gắn khách hàng",
      assigneeName: task.user.name
    }));
  }

  async getRecentActivity() {
    const activities = await this.prisma.activity.findMany({
      include: {
        user: true,
        customer: true,
        project: true
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 8
    });

    return activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      content: activity.content,
      type: activity.type,
      createdAt: activity.updatedAt,
      customerName: activity.customer?.name ?? null,
      projectName: activity.project?.name ?? null,
      userName: activity.user.name,
      isCompleted: activity.isCompleted
    }));
  }

  private sumCurrency(values: Prisma.Decimal[]) {
    return values.reduce((total, value) => total + Number(value), 0);
  }
}
