import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { DashboardFilterDto } from "./dto/dashboard-filter.dto";

const ACTIVE_PROJECT_STATUSES = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "DELIVERING"] as const;
const PENDING_QUOTE_STATUSES = ["DRAFT", "SENT"] as const;
const RECEIVABLE_CONTRACT_STATUSES = ["ACTIVE", "SUSPENDED", "COMPLETED"] as const;
const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
const APP_TIME_ZONE_OFFSET = "+07:00";
const DAY_MS = 24 * 60 * 60 * 1000;
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

  async getKpis(filters: DashboardFilterDto = {}) {
    const range = this.resolveDateRange(filters);
    const monthBuckets = this.resolveMonthBuckets(range.dateFrom, range.dateTo);
    const periodDuration = range.endExclusive.getTime() - range.start.getTime();
    const previousPeriodStart = new Date(range.start.getTime() - periodDuration);

    const [completedProjects, activeProjects, pendingQuotes, contracts] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          deletedAt: null,
          status: "COMPLETED",
          completedAt: { gte: previousPeriodStart, lt: range.endExclusive }
        },
        select: { completedAt: true, estimatedValue: true }
      }),
      this.prisma.project.count({
        where: {
          deletedAt: null,
          status: { in: [...ACTIVE_PROJECT_STATUSES] },
          createdAt: { gte: range.start, lt: range.endExclusive }
        }
      }),
      this.prisma.quote.findMany({
        where: {
          deletedAt: null,
          status: { in: [...PENDING_QUOTE_STATUSES] },
          createdAt: { gte: range.start, lt: range.endExclusive }
        },
        select: { total: true }
      }),
      this.prisma.contract.findMany({
        where: {
          deletedAt: null,
          status: { in: [...RECEIVABLE_CONTRACT_STATUSES] },
          createdAt: { gte: range.start, lt: range.endExclusive }
        },
        include: { payments: true }
      })
    ]);

    const periodRevenue = completedProjects
      .filter((p) => p.completedAt !== null && p.completedAt >= range.start)
      .reduce((sum, p) => sum + Number(p.estimatedValue ?? 0), 0);

    const previousPeriodRevenue = completedProjects
      .filter((p) => p.completedAt !== null && p.completedAt >= previousPeriodStart && p.completedAt < range.start)
      .reduce((sum, p) => sum + Number(p.estimatedValue ?? 0), 0);

    const revenueChange = previousPeriodRevenue === 0
      ? (periodRevenue > 0 ? 100 : 0)
      : Number((((periodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100).toFixed(1));

    const outstandingContracts = contracts.map((contract) => {
      const paidAmount = this.sumCurrency(contract.payments.map((p) => p.amount));
      return { remainingAmount: Number(contract.value) - paidAmount };
    });

    const outstandingDebt = outstandingContracts.reduce((total, c) => total + Math.max(0, c.remainingAmount), 0);
    const overdueCustomers = outstandingContracts.filter((c) => c.remainingAmount > 0).length;
    const pendingQuoteValue = pendingQuotes.reduce((total, q) => total + Number(q.total), 0);

    const revenueTrend = monthBuckets.map((month) => {
      const bucketStart = month.start > range.start ? month.start : range.start;
      const bucketEnd = month.endExclusive < range.endExclusive ? month.endExclusive : range.endExclusive;
      return completedProjects
        .filter((p) => p.completedAt !== null && p.completedAt >= bucketStart && p.completedAt < bucketEnd)
        .reduce((sum, p) => sum + Number(p.estimatedValue ?? 0), 0);
    });

    return {
      monthlyRevenue: {
        value: periodRevenue,
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

  async getRevenueChart(filters: DashboardFilterDto = {}) {
    const range = this.resolveDateRange(filters);
    const monthBuckets = this.resolveMonthBuckets(range.dateFrom, range.dateTo);

    const completedProjects = await this.prisma.project.findMany({
      where: {
        deletedAt: null,
        status: "COMPLETED",
        completedAt: { gte: range.start, lt: range.endExclusive }
      },
      select: { completedAt: true, estimatedValue: true }
    });

    return monthBuckets.map((month) => {
      const bucketStart = month.start > range.start ? month.start : range.start;
      const bucketEnd = month.endExclusive < range.endExclusive ? month.endExclusive : range.endExclusive;
      const revenue = completedProjects
        .filter((p) => p.completedAt !== null && p.completedAt >= bucketStart && p.completedAt < bucketEnd)
        .reduce((total, p) => total + Number(p.estimatedValue ?? 0), 0);

      return {
        month: month.label,
        revenue,
        target: 200000000
      };
    });
  }

  async getPipeline(filters: DashboardFilterDto = {}) {
    const range = this.resolveDateRange(filters);

    const projects = await this.prisma.project.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: range.start, lt: range.endExclusive }
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

  async getRecentActivity(filters: DashboardFilterDto = {}) {
    const range = this.resolveDateRange(filters);

    const activities = await this.prisma.activity.findMany({
      where: {
        deletedAt: null,
        updatedAt: { gte: range.start, lt: range.endExclusive }
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

  private resolveDateRange(filters: DashboardFilterDto) {
    const currentYear = this.getCurrentBusinessYear();
    const dateFrom = filters.dateFrom ?? `${currentYear}-01-01`;
    const dateTo = filters.dateTo ?? `${currentYear}-12-31`;

    return {
      dateFrom,
      dateTo,
      start: this.parseDateOnlyStart(dateFrom),
      endExclusive: new Date(this.parseDateOnlyStart(dateTo).getTime() + DAY_MS)
    };
  }

  private resolveMonthBuckets(dateFrom: string, dateTo: string) {
    const [fromYear, fromMonth] = this.parseYearMonth(dateFrom);
    const [toYear, toMonth] = this.parseYearMonth(dateTo);
    const spansMultipleYears = fromYear !== toYear;
    const buckets: Array<{
      start: Date;
      endExclusive: Date;
      label: string;
    }> = [];

    let year = fromYear;
    let month = fromMonth;

    while (year < toYear || (year === toYear && month <= toMonth)) {
      const start = this.parseDateOnlyStart(`${year}-${String(month).padStart(2, "0")}-01`);
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextMonthYear = month === 12 ? year + 1 : year;
      const endExclusive = this.parseDateOnlyStart(
        `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01`
      );

      buckets.push({
        start,
        endExclusive,
        label: this.formatMonthLabel(start, spansMultipleYears || buckets.length >= 12)
      });

      month = nextMonth;
      year = nextMonthYear;
    }

    return buckets.map((bucket) => ({
      ...bucket,
      label: spansMultipleYears || buckets.length > 12
        ? this.formatMonthLabel(bucket.start, true)
        : bucket.label
    }));
  }

  private parseYearMonth(value: string): [number, number] {
    const [yearPart, monthPart] = value.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);

    return [year, month];
  }

  private parseDateOnlyStart(value: string) {
    return new Date(`${value}T00:00:00.000${APP_TIME_ZONE_OFFSET}`);
  }

  private getCurrentBusinessYear() {
    const year = new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      year: "numeric"
    }).format(new Date());

    return Number(year);
  }

  private formatMonthLabel(date: Date, includeYear: boolean) {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: APP_TIME_ZONE,
      month: "short"
    };

    if (includeYear) {
      options.year = "2-digit";
    }

    return new Intl.DateTimeFormat("vi-VN", options).format(date).replace(".", "");
  }

  private sumCurrency(values: Prisma.Decimal[]) {
    return values.reduce((total, value) => total + Number(value), 0);
  }
}
