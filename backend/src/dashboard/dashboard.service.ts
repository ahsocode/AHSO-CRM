import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";

const ACTIVE_PROJECT_STATUSES = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "DELIVERING"] as const;
const PENDING_QUOTE_STATUSES = ["DRAFT", "SENT"] as const;
const PIPELINE_STAGE_CONFIG = [
  { status: "SURVEY", label: "Khảo sát", color: "stage-survey" },
  { status: "QUOTING", label: "Báo giá", color: "stage-quoting" },
  { status: "NEGOTIATING", label: "Đàm phán", color: "stage-negotiating" },
  { status: "WON", label: "Đã ký HĐ", color: "stage-won" },
  { status: "DELIVERING", label: "Triển khai", color: "stage-delivering" },
  { status: "COMPLETED", label: "Hoàn thành", color: "stage-completed" },
  { status: "LOST", label: "Không thành", color: "stage-lost" }
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // 6 tháng cho sparkline trên KPI card (Design Spec v2 mục 1.2)
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [completedProjects, activeProjects, pendingQuotes, contracts] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          deletedAt: null,
          status: "COMPLETED",
          completedAt: { gte: trendStart, lt: nextMonthStart }
        },
        select: { completedAt: true, estimatedValue: true }
      }),
      this.prisma.project.count({
        where: {
          deletedAt: null,
          status: { in: [...ACTIVE_PROJECT_STATUSES] }
        }
      }),
      this.prisma.quote.findMany({
        where: {
          deletedAt: null,
          status: { in: [...PENDING_QUOTE_STATUSES] }
        },
        select: { total: true }
      }),
      this.prisma.contract.findMany({
        where: { deletedAt: null, status: { in: ["ACTIVE", "SUSPENDED", "COMPLETED"] } },
        include: { payments: true }
      })
    ]);

    const currentMonthRevenue = completedProjects
      .filter((p) => p.completedAt !== null && p.completedAt >= currentMonthStart)
      .reduce((sum, p) => sum + Number(p.estimatedValue ?? 0), 0);

    const previousMonthRevenue = completedProjects
      .filter((p) => p.completedAt !== null && p.completedAt >= previousMonthStart && p.completedAt < currentMonthStart)
      .reduce((sum, p) => sum + Number(p.estimatedValue ?? 0), 0);

    const revenueChange = previousMonthRevenue === 0
      ? 100
      : Number((((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100).toFixed(1));

    const outstandingContracts = contracts.map((contract) => {
      const paidAmount = this.sumCurrency(contract.payments.map((p) => p.amount));
      return { remainingAmount: Number(contract.value) - paidAmount };
    });

    const outstandingDebt = outstandingContracts.reduce((total, c) => total + Math.max(0, c.remainingAmount), 0);
    const overdueCustomers = outstandingContracts.filter((c) => c.remainingAmount > 0).length;
    const pendingQuoteValue = pendingQuotes.reduce((total, q) => total + Number(q.total), 0);

    const revenueTrend = Array.from({ length: 6 }, (_, index) => {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - (4 - index), 1);
      return completedProjects
        .filter((p) => p.completedAt !== null && p.completedAt >= monthStart && p.completedAt < monthEnd)
        .reduce((sum, p) => sum + Number(p.estimatedValue ?? 0), 0);
    });

    return {
      monthlyRevenue: {
        value: currentMonthRevenue,
        changePercent: revenueChange,
        trend: revenueTrend
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

    const completedProjects = await this.prisma.project.findMany({
      where: {
        deletedAt: null,
        status: "COMPLETED",
        completedAt: { gte: start }
      },
      select: { completedAt: true, estimatedValue: true }
    });

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(end.getFullYear(), end.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const revenue = completedProjects
        .filter((p) => p.completedAt !== null && p.completedAt.getFullYear() === date.getFullYear() && p.completedAt.getMonth() === date.getMonth())
        .reduce((total, p) => total + Number(p.estimatedValue ?? 0), 0);

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
        isCompleted: false,
        deletedAt: null
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
      where: {
        deletedAt: null
      },
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
