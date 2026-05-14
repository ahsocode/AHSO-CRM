import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma, ProjectStatus } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { DraftEmailDto } from "./dto/draft-email.dto";

const MODEL = "claude-sonnet-4-20250514";
const SUMMARY_ACTIVITY_LIMIT = 12;
const PROJECT_FORECAST_WEIGHTS: Record<ProjectStatus, number> = {
  SURVEY: 0.15,
  QUOTING: 0.35,
  NEGOTIATING: 0.55,
  WON: 0.85,
  DELIVERING: 0.95,
  COMPLETED: 1,
  LOST: 0
};

@Injectable()
export class AiService {
  private client?: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async summarizeActivities(customerId: string, user: JwtUser) {
    const customer = await this.prisma.customer.findFirst({
      where: this.buildCustomerWhere(user, { id: customerId }),
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true
          }
        },
        activities: {
          where: {
            deletedAt: null
          },
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: SUMMARY_ACTIVITY_LIMIT
        },
        projects: {
          where: {
            deletedAt: null
          },
          include: {
            quotes: {
              orderBy: {
                createdAt: "desc"
              },
              take: 2,
              select: {
                quoteNo: true,
                status: true,
                total: true
              }
            },
            contract: {
              select: {
                contractNo: true,
                status: true,
                value: true
              }
            }
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 5
        }
      }
    });

    if (!customer) {
      throw new NotFoundException("Không tìm thấy khách hàng để tóm tắt");
    }

    if (customer.activities.length === 0) {
      return {
        customerId,
        summary: `Khách hàng ${customer.name} hiện chưa có lịch sử tương tác đủ để tạo tóm tắt AI. Nên bắt đầu bằng một cuộc gọi khảo sát nhu cầu hoặc email giới thiệu giải pháp phù hợp.`
      };
    }

    const summary = await this.generateText(
      "Bạn là trợ lý bán hàng B2B cho AHSO CRM. Luôn trả lời bằng tiếng Việt, ngắn gọn, chuyên nghiệp, tối đa 500 từ.",
      `
Khách hàng: ${customer.name}
Người phụ trách: ${customer.assignedTo.name}

Danh sách hoạt động gần đây:
${customer.activities
  .map(
    (activity, index) =>
      `${index + 1}. [${activity.type}] ${activity.title} | người thực hiện: ${activity.user.name} | lịch: ${formatDateTime(activity.scheduledAt)} | hoàn tất: ${activity.isCompleted ? "Có" : "Chưa"} | nội dung: ${activity.content ?? "Không có"}`
  )
  .join("\n")}

Tình trạng dự án liên quan:
${customer.projects
  .map(
    (project) =>
      `- ${project.code} / ${project.name}: trạng thái ${project.status}, giá trị ước tính ${formatCurrency(Number(project.estimatedValue ?? 0))}, báo giá gần nhất ${project.quotes[0]?.quoteNo ?? "chưa có"}, hợp đồng ${project.contract?.contractNo ?? "chưa có"}`
  )
  .join("\n")}

Hãy tóm tắt:
1. Bối cảnh khách hàng hiện tại
2. Những điểm đã trao đổi đáng chú ý
3. Rủi ro/chướng ngại nếu có
4. Cơ hội chốt sale ngắn hạn
`,
      this.buildSummaryFallback(customer.name, customer.activities.length)
    );

    return {
      customerId,
      summary
    };
  }

  async suggestFollowUp(customerId: string, user: JwtUser) {
    const customer = await this.prisma.customer.findFirst({
      where: this.buildCustomerWhere(user, { id: customerId }),
      include: {
        activities: {
          where: {
            deletedAt: null
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 6
        },
        projects: {
          where: {
            deletedAt: null
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 3,
          select: {
            code: true,
            name: true,
            status: true,
            estimatedValue: true,
            quotes: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                quoteNo: true,
                status: true,
                validUntil: true,
                total: true
              }
            }
          }
        }
      }
    });

    if (!customer) {
      throw new NotFoundException("Không tìm thấy khách hàng để đề xuất follow-up");
    }

    const suggestion = await this.generateText(
      "Bạn là chuyên gia account management B2B cho AHSO CRM. Luôn trả lời bằng tiếng Việt, súc tích, thực dụng.",
      `
Khách hàng: ${customer.name}
Trạng thái khách hàng: ${customer.status}

Hoạt động gần nhất:
${customer.activities
  .map(
    (activity, index) =>
      `${index + 1}. ${activity.type} - ${activity.title} - ${activity.isCompleted ? "đã xong" : "chưa xong"} - ${activity.content ?? "không có ghi chú"}`
  )
  .join("\n")}

Dự án đang mở:
${customer.projects
  .map(
    (project) =>
      `- ${project.code}: ${project.name} | ${project.status} | giá trị ${formatCurrency(Number(project.estimatedValue ?? 0))} | báo giá gần nhất ${project.quotes[0]?.quoteNo ?? "chưa có"} (${project.quotes[0]?.status ?? "N/A"})`
  )
  .join("\n")}

Hãy đề xuất bước tiếp theo phù hợp nhất trong 48 giờ tới. Bắt buộc trả lời theo cấu trúc:
- Hành động ưu tiên
- Kênh thực hiện (call/email/meeting)
- Lý do
- Nội dung chốt cần trao đổi
`,
      "Hành động ưu tiên: Gọi điện xác nhận nhu cầu cập nhật.\nKênh thực hiện: call\nLý do: Cần làm rõ trạng thái cơ hội trước khi lên bước tiếp theo.\nNội dung chốt cần trao đổi: tiến độ nội bộ, thời điểm ra quyết định và người phê duyệt."
    );

    return {
      customerId,
      suggestion
    };
  }

  async draftEmail(context: DraftEmailDto, user: JwtUser) {
    const quote = context.quoteId
      ? await this.prisma.quote.findFirst({
          where: this.buildQuoteWhere(user, { id: context.quoteId }),
          select: {
            id: true,
            quoteNo: true,
            status: true,
            total: true,
            validUntil: true,
            project: {
              select: {
                id: true,
                code: true,
                name: true,
                status: true,
                estimatedValue: true,
                customer: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                    address: true
                  }
                }
              }
            }
          }
        })
      : null;

    if (context.quoteId && !quote) {
      throw new NotFoundException("Không tìm thấy báo giá để soạn email AI");
    }

    const resolvedProjectId = context.projectId ?? quote?.project.id;
    const resolvedCustomerId = context.customerId ?? quote?.project.customer.id;
    const emailPurpose = context.purpose?.trim() || context.instruction?.trim() || "Cập nhật thông tin dự án";

    const [customer, project] = await Promise.all([
      resolvedCustomerId
        ? this.prisma.customer.findFirst({
            where: this.buildCustomerWhere(user, { id: resolvedCustomerId }),
            select: {
              id: true,
              name: true,
              shortName: true,
              address: true
            }
          })
        : Promise.resolve(null),
      resolvedProjectId
        ? this.prisma.project.findFirst({
            where: this.buildProjectWhere(user, { id: resolvedProjectId }),
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              estimatedValue: true
            }
          })
        : Promise.resolve(null)
    ]);

    if (resolvedCustomerId && !customer) {
      throw new NotFoundException("Không tìm thấy khách hàng để soạn email AI");
    }

    if (resolvedProjectId && !project) {
      throw new NotFoundException("Không tìm thấy dự án để soạn email AI");
    }

    const fallback = this.buildEmailFallback(context, customer?.name, project?.name, emailPurpose);
    const raw = await this.generateText(
      "Bạn là trợ lý soạn email bán hàng B2B cho AHSO CRM. Luôn viết bằng tiếng Việt, lịch sự, rõ ràng, thực dụng. Chỉ trả về JSON hợp lệ với 2 khóa: subject, body.",
      `
Ngữ cảnh:
- Khách hàng: ${customer?.name ?? "không xác định"}
- Dự án: ${project ? `${project.code} - ${project.name} (${project.status})` : "không xác định"}
- Báo giá: ${quote ? `${quote.quoteNo} (${quote.status}) - tổng ${formatCurrency(Number(quote.total))}` : "không xác định"}
- Người nhận: ${context.recipientName ?? "Quý khách"}
- Mục đích: ${emailPurpose}
- Tone: ${context.tone}
- Ghi chú thêm: ${context.additionalContext ?? "Không có"}

Yêu cầu:
- Subject tối đa 120 ký tự
- Body dạng email hoàn chỉnh, có lời chào, nội dung chính, CTA, chữ ký "AHSO CRM"
- Không dùng markdown
- Trả về JSON hợp lệ
`,
      JSON.stringify(fallback)
    );
    const parsed = safeParseJson<{ subject?: string; body?: string }>(raw);

    return {
      subject: parsed?.subject?.trim() || fallback.subject,
      body: parsed?.body?.trim() || fallback.body,
      context: {
        customer,
        project,
        quote
      }
    };
  }

  async forecastProject(projectId: string, user: JwtUser) {
    const project = await this.prisma.project.findFirst({
      where: this.buildProjectWhere(user, { id: projectId }),
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        estimatedValue: true,
        expectedEndDate: true,
        customer: {
          select: {
            name: true
          }
        },
        quotes: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            quoteNo: true,
            status: true,
            total: true
          }
        },
        contract: {
          select: {
            contractNo: true,
            status: true,
            value: true
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException("Không tìm thấy dự án để dự báo AI");
    }

    const weight = PROJECT_FORECAST_WEIGHTS[project.status];
    const probabilityPercent = Math.round(weight * 100);
    const estimatedValue = Number(project.estimatedValue ?? project.quotes[0]?.total ?? project.contract?.value ?? 0);
    const forecastedRevenue = Math.round(estimatedValue * weight);
    const fallbackReasoning = `Dự án ${project.code} đang ở giai đoạn ${project.status}, xác suất thắng quy đổi khoảng ${probabilityPercent}%. Doanh thu kỳ vọng được tính từ giá trị dự kiến nhân trọng số theo stage hiện tại.`;
    const reasoning = await this.generateText(
      "Bạn là trợ lý phân tích pipeline B2B cho AHSO CRM. Trả lời bằng tiếng Việt, ngắn gọn, thực dụng, tối đa 120 từ.",
      `
Dự án: ${project.code} - ${project.name}
Khách hàng: ${project.customer.name}
Stage hiện tại: ${project.status}
Giá trị dự kiến: ${formatCurrency(estimatedValue)}
Xác suất theo stage: ${probabilityPercent}%
Báo giá gần nhất: ${project.quotes[0]?.quoteNo ?? "chưa có"} (${project.quotes[0]?.status ?? "N/A"})
Hợp đồng: ${project.contract?.contractNo ?? "chưa có"} (${project.contract?.status ?? "N/A"})
Ngày kết thúc dự kiến: ${formatDateTime(project.expectedEndDate)}

Hãy giải thích ngắn gọn vì sao forecast này hợp lý và đề xuất 1 hành động tiếp theo.
`,
      fallbackReasoning
    );

    return {
      projectId: project.id,
      probabilityPercent,
      forecastedRevenue,
      reasoning
    };
  }

  async forecastRevenue(months = 3) {
    const safeMonths = Math.max(1, Math.min(months, 12));
    const now = new Date();
    const endWindow = new Date(now.getFullYear(), now.getMonth() + safeMonths, 0, 23, 59, 59, 999);
    const pipelineProjects = await this.prisma.project.findMany({
      where: {
        deletedAt: null,
        status: {
          in: ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "DELIVERING", "COMPLETED"]
        }
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        estimatedValue: true,
        expectedEndDate: true,
        customer: {
          select: {
            name: true
          }
        }
      }
    });

    const forecastByMonth = Array.from({ length: safeMonths }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + index, 1);
      return {
        month: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
        projectedValue: 0,
        weightedValue: 0,
        projectCount: 0
      };
    });

    for (const project of pipelineProjects) {
      const estimatedValue = Number(project.estimatedValue ?? 0);
      if (estimatedValue <= 0) {
        continue;
      }

      const targetIndex = resolveForecastBucket(now, safeMonths, project.expectedEndDate, endWindow);
      if (targetIndex === -1) {
        continue;
      }

      const weight = PROJECT_FORECAST_WEIGHTS[project.status];
      forecastByMonth[targetIndex].projectedValue += estimatedValue;
      forecastByMonth[targetIndex].weightedValue += Math.round(estimatedValue * weight);
      forecastByMonth[targetIndex].projectCount += 1;
    }

    const totalPipelineValue = forecastByMonth.reduce((sum, month) => sum + month.projectedValue, 0);
    const weightedForecast = forecastByMonth.reduce((sum, month) => sum + month.weightedValue, 0);
    const narrative = await this.generateText(
      "Bạn là trợ lý phân tích doanh thu B2B cho ban điều hành AHSO. Trả lời bằng tiếng Việt, ngắn gọn, ưu tiên nhận định vận hành thực tế.",
      `
Dự báo trong ${safeMonths} tháng tới.
Tổng pipeline: ${formatCurrency(totalPipelineValue)}
Forecast trọng số: ${formatCurrency(weightedForecast)}

Chi tiết theo tháng:
${forecastByMonth
  .map(
    (month) =>
      `- ${month.month}: gross ${formatCurrency(month.projectedValue)}, weighted ${formatCurrency(month.weightedValue)}, số dự án ${month.projectCount}`
  )
  .join("\n")}

Hãy viết:
1. Nhận định ngắn về mức tin cậy forecast
2. Tháng nào cần ưu tiên chốt sale
3. 2 khuyến nghị hành động cho sales manager
`,
      `Forecast trọng số ${formatCurrency(weightedForecast)} trong ${safeMonths} tháng tới đang phụ thuộc mạnh vào nhóm dự án ở giai đoạn đàm phán và đã thắng. Nên ưu tiên rà lại các dự án sắp chốt trong 30 ngày tới và khóa cam kết thanh toán/triển khai với từng account chính.`
    );

    return {
      months: safeMonths,
      totalPipelineValue,
      weightedForecast,
      forecastByMonth,
      narrative
    };
  }

  private buildCustomerWhere(
    user: JwtUser,
    extra?: Prisma.CustomerWhereInput
  ): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...extra
    };

    if (isStaff(user)) {
      where.assignedToId = user.sub;
      where.assignedTo = {
        isActive: true
      };
    }

    return where;
  }

  private buildProjectWhere(
    user: JwtUser,
    extra?: Prisma.ProjectWhereInput
  ): Prisma.ProjectWhereInput {
    return {
      deletedAt: null,
      customer: this.buildCustomerWhere(user),
      ...extra
    };
  }

  private buildQuoteWhere(user: JwtUser, extra?: Prisma.QuoteWhereInput): Prisma.QuoteWhereInput {
    return {
      deletedAt: null,
      project: this.buildProjectWhere(user),
      ...extra
    };
  }

  private buildSummaryFallback(customerName: string, activityCount: number) {
    return `Khách hàng ${customerName} đang có ${activityCount} hoạt động gần đây trong hệ thống. Nên rà lại các điểm đã trao đổi, xác định blocker chính và chốt một bước follow-up rõ ràng trong 48 giờ tới.`;
  }

  private buildEmailFallback(
    context: DraftEmailDto,
    customerName?: string | null,
    projectName?: string | null,
    purposeOverride?: string
  ) {
    const greetingName = context.recipientName?.trim() || customerName || "Quý khách";
    const purpose = purposeOverride ?? context.purpose ?? context.instruction ?? "Cập nhật thông tin dự án";
    const subject = `AHSO CRM | ${purpose.slice(0, 80)}`;
    const body = [
      `Kính gửi ${greetingName},`,
      "",
      `AHSO CRM xin liên hệ về nội dung: ${purpose}.`,
      projectName ? `Liên quan đến dự án ${projectName}, chúng tôi mong muốn cập nhật nhanh để hai bên chốt bước tiếp theo phù hợp.` : "Chúng tôi mong muốn cập nhật nhanh để hai bên chốt bước tiếp theo phù hợp.",
      context.additionalContext ? context.additionalContext : "Anh/chị vui lòng phản hồi thời gian phù hợp để chúng tôi hỗ trợ tiếp theo.",
      "",
      "Trân trọng,",
      "AHSO CRM"
    ].join("\n");

    return { subject, body };
  }

  private getClient() {
    if (this.client) {
      return this.client;
    }

    const apiKey = this.configService.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return null;
    }

    this.client = new Anthropic({
      apiKey
    });

    return this.client;
  }

  private async generateText(system: string, prompt: string, fallback: string) {
    const client = this.getClient();
    if (!client) {
      return fallback;
    }

    try {
      const response = await client.messages.create({
        model: MODEL,
        system,
        max_tokens: 900,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const text = response.content
        .filter((item): item is Anthropic.TextBlock => item.type === "text")
        .map((item) => item.text.trim())
        .filter(Boolean)
        .join("\n");

      return text || fallback;
    } catch {
      return fallback;
    }
  }
}

function resolveForecastBucket(now: Date, months: number, expectedEndDate: Date | null, endWindow: Date) {
  if (!expectedEndDate || expectedEndDate > endWindow) {
    return 0;
  }

  const delta =
    (expectedEndDate.getFullYear() - now.getFullYear()) * 12 + (expectedEndDate.getMonth() - now.getMonth());

  if (delta < 0 || delta >= months) {
    return 0;
  }

  return delta;
}

function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDateTime(value?: Date | null) {
  if (!value) {
    return "Chưa lên lịch";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(value);
}
