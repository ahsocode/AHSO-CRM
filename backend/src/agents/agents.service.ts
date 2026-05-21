import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AgentAction } from "@prisma/client";
import { JwtUser, hasPermission, isAdmin, isStaff } from "../auth/auth.types";
import { AiProviderRegistry } from "../ai/providers/ai-provider-registry.service";
import { PrismaService } from "../common/prisma.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { AgentActionRegistry } from "./actions/action-registry";
import {
  AgentContextEntityDto,
  ListAgentActionsDto,
  RejectAgentActionDto,
  UpdateAgentActionPayloadDto
} from "./dto/agent-action.dto";
import { AgentTool, CreateAgentDto, RunAgentDto, UpdateAgentDto } from "./dto/agent.dto";

const AGENT_RUN_TIMEOUT_MS = 60_000;
const CUSTOMER_INACTIVITY_DAYS = 14;
const SENT_QUOTE_STALE_DAYS = 7;

export interface ToolResult {
  toolName: AgentTool;
  inputJson: Prisma.InputJsonValue;
  outputJson: Prisma.InputJsonValue;
  status: "SUCCESS" | "SKIPPED";
  durationMs: number;
}

@Injectable()
export class AgentsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderRegistry: AiProviderRegistry,
    private readonly agentActionRegistry: AgentActionRegistry,
    private readonly domainEvents: DomainEventsService
  ) {}

  async onModuleInit() {
    await this.prisma.agentRun.updateMany({
      where: {
        status: "RUNNING",
        createdAt: {
          lt: new Date(Date.now() - 30 * 60 * 1000)
        }
      },
      data: {
        status: "ERROR",
        error: "Timed out — reset on server restart"
      }
    });
  }

  list() {
    return this.prisma.agent.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    });
  }

  create(dto: CreateAgentDto, user: JwtUser) {
    return this.prisma.agent.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        systemPrompt: dto.systemPrompt,
        provider: dto.provider ?? null,
        model: dto.model ?? null,
        enabledTools: dto.enabledTools,
        isActive: dto.isActive,
        createdById: user.sub
      }
    });
  }

  async update(id: string, dto: UpdateAgentDto) {
    await this.ensureAgent(id);

    return this.prisma.agent.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
        ...(dto.systemPrompt !== undefined ? { systemPrompt: dto.systemPrompt } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider ?? null } : {}),
        ...(dto.model !== undefined ? { model: dto.model ?? null } : {}),
        ...(dto.enabledTools !== undefined ? { enabledTools: dto.enabledTools } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      }
    });
  }

  async remove(id: string) {
    await this.ensureAgent(id);
    await this.prisma.agent.update({
      where: { id },
      data: { isActive: false }
    });

    return { success: true };
  }

  async run(id: string, dto: RunAgentDto, user: JwtUser) {
    const agent = await this.ensureAgent(id);
    if (!agent.isActive) {
      throw new NotFoundException("Agent không còn hoạt động");
    }

    const startedAt = Date.now();
    const run = await this.prisma.agentRun.create({
      data: {
        agentId: agent.id,
        userId: user.sub,
        status: "RUNNING",
        input: dto.input,
        messages: {
          create: [
            { role: "system", content: agent.systemPrompt },
            { role: "user", content: dto.input }
          ]
        }
      }
    });

    try {
      const toolResults = await this.runTools(agent.enabledTools as AgentTool[], dto, user);
      const contextText = toolResults
        .map((result) => `Tool ${result.toolName}: ${JSON.stringify(result.outputJson)}`)
        .join("\n");
      const result = await this.withTimeout(this.aiProviderRegistry.generateTextResult({
        system: agent.systemPrompt,
        prompt: [
          `Yêu cầu người dùng: ${dto.input}`,
          dto.context ? `Context bổ sung: ${JSON.stringify(dto.context)}` : "",
          contextText ? `Dữ liệu CRM được phép dùng:\n${contextText}` : "",
          "Trả lời bằng tiếng Việt, rõ ràng, có hành động đề xuất nếu phù hợp."
        ].filter(Boolean).join("\n\n"),
        maxTokens: 1200,
        temperature: 0.3,
        model: agent.model
      }, agent.provider as "anthropic" | "openai" | "gemini" | null), AGENT_RUN_TIMEOUT_MS);
      if (!result) {
        throw new ServiceUnavailableException("AI provider chưa được cấu hình. Vui lòng kiểm tra trong Admin.");
      }

      const output = result.text;
      const durationMs = Date.now() - startedAt;

      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: result ? "SUCCESS" : "ERROR",
          output,
          durationMs,
          messages: {
            create: { role: "assistant", content: output }
          },
          toolCalls: {
            create: toolResults.map((tool) => ({
              toolName: tool.toolName,
              inputJson: tool.inputJson,
              outputJson: tool.outputJson,
              status: tool.status,
              durationMs: tool.durationMs
            }))
          }
        }
      });

      return {
        runId: run.id,
        status: result ? "SUCCESS" : "ERROR",
        output,
        toolCalls: toolResults
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent chạy thất bại";
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "ERROR",
          error: message,
          durationMs: Date.now() - startedAt
        }
      });
      throw error;
    }
  }

  async getRun(id: string, user: JwtUser) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id },
      include: {
        agent: true,
        messages: { orderBy: { createdAt: "asc" } },
        toolCalls: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!run) {
      throw new NotFoundException("Không tìm thấy agent run");
    }
    if (!isAdmin(user) && run.userId !== user.sub) {
      throw new ForbiddenException("Bạn không có quyền xem agent run này");
    }

    return run;
  }

  async scanContext(dto: AgentContextEntityDto, user: JwtUser) {
    if (!hasPermission(user, "customers.view")) {
      throw new ForbiddenException("Bạn không có quyền xem khách hàng");
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.entityId,
        deletedAt: null,
        ...(isStaff(user) ? { assignedToId: user.sub } : {})
      },
      select: {
        id: true,
        name: true,
        activities: {
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            title: true,
            updatedAt: true
          }
        },
        projects: {
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            name: true,
            status: true,
            quotes: {
              where: {
                deletedAt: null,
                status: "SENT"
              },
              orderBy: [
                { sentAt: "desc" },
                { updatedAt: "desc" }
              ],
              take: 1,
              select: {
                quoteNo: true,
                sentAt: true,
                updatedAt: true
              }
            }
          }
        }
      }
    });

    if (!customer) {
      throw new NotFoundException("Không tìm thấy khách hàng hoặc bạn không có quyền truy cập");
    }

    const existingPendingActions = await this.prisma.agentAction.findMany({
      where: {
        contextEntityType: "customer",
        contextEntityId: customer.id,
        actionType: "CREATE_ACTIVITY",
        status: "PENDING_REVIEW"
      },
      orderBy: { createdAt: "desc" }
    });

    if (existingPendingActions.length > 0) {
      return {
        created: 0,
        message: "Đã có gợi ý AI đang chờ duyệt cho khách hàng này.",
        actions: existingPendingActions.map((action) => this.mapAgentAction(action))
      };
    }

    const signal = this.detectCustomerSignal(customer);
    if (!signal) {
      return {
        created: 0,
        message: "Chưa phát hiện tín hiệu cần tạo hành động mới.",
        actions: []
      };
    }

    const agent = await this.prisma.agent.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    });
    if (!agent) {
      throw new NotFoundException("Chưa có agent đang hoạt động để tạo gợi ý");
    }

    const startedAt = Date.now();
    const run = await this.prisma.agentRun.create({
      data: {
        agentId: agent.id,
        userId: user.sub,
        status: "RUNNING",
        input: `context-scan:${dto.entityType}:${dto.entityId}`,
        contextEntityType: dto.entityType,
        contextEntityId: dto.entityId,
        messages: {
          create: [
            { role: "system", content: "CRM Copilot deterministic context scan" },
            { role: "user", content: `Quét tín hiệu cho khách hàng ${customer.name}` }
          ]
        }
      }
    });

    try {
      const payload = this.buildCreateActivityPayload(customer.id, signal);
      const definition = this.agentActionRegistry.getDefinition("CREATE_ACTIVITY");
      if (!definition) {
        throw new BadRequestException("Action CREATE_ACTIVITY chưa được hỗ trợ");
      }

      const parsed = definition.schema.safeParse(payload);
      if (!parsed.success) {
        await this.prisma.agentRun.update({
          where: { id: run.id },
          data: {
            status: "ERROR",
            error: "Payload gợi ý AI không hợp lệ",
            durationMs: Date.now() - startedAt
          }
        });
        throw new BadRequestException("Payload gợi ý AI không hợp lệ");
      }

      const action = await this.prisma.agentAction.create({
        data: {
          agentRunId: run.id,
          actionType: definition.type,
          contextEntityType: dto.entityType,
          contextEntityId: dto.entityId,
          proposedPayload: this.toInputJson(payload),
          status: "PENDING_REVIEW",
          riskLevel: definition.riskLevel,
          requestedById: user.sub
        }
      });

      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          output: signal.reason,
          durationMs: Date.now() - startedAt,
          messages: {
            create: { role: "assistant", content: signal.reason }
          }
        }
      });

      return {
        created: 1,
        message: "Đã tạo gợi ý AI chờ duyệt.",
        actions: [this.mapAgentAction(action)]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể quét ngữ cảnh";
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "ERROR",
          error: message,
          durationMs: Date.now() - startedAt
        }
      });
      throw error;
    }
  }

  async listActions(query: ListAgentActionsDto, user: JwtUser) {
    if (query.contextEntityType === "customer" && query.contextEntityId) {
      await this.ensureCustomerAccess(query.contextEntityId, user);
    }

    const actions = await this.prisma.agentAction.findMany({
      where: {
        ...(query.contextEntityType ? { contextEntityType: query.contextEntityType } : {}),
        ...(query.contextEntityId ? { contextEntityId: query.contextEntityId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(!isAdmin(user) && !query.contextEntityId ? { requestedById: user.sub } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return actions.map((action) => this.mapAgentAction(action));
  }

  async updateActionPayload(id: string, dto: UpdateAgentActionPayloadDto, user: JwtUser) {
    const action = await this.ensureActionAccess(id, user);
    if (action.status !== "PENDING_REVIEW" && action.status !== "APPROVED") {
      throw new BadRequestException("Chỉ có thể sửa action đang chờ duyệt");
    }

    const definition = this.agentActionRegistry.getDefinition(action.actionType);
    if (!definition) {
      throw new BadRequestException("Action này chưa được hỗ trợ");
    }

    const parsed = definition.schema.safeParse(dto.finalPayload);
    if (!parsed.success) {
      const validationErrors = parsed.error.flatten();
      await this.prisma.agentAction.update({
        where: { id },
        data: { validationErrors: this.toInputJson(validationErrors) }
      });
      throw new BadRequestException("Payload action không hợp lệ");
    }

    const updated = await this.prisma.agentAction.update({
      where: { id },
      data: {
        finalPayload: this.toInputJson(dto.finalPayload),
        validationErrors: Prisma.JsonNull
      }
    });

    return this.mapAgentAction(updated);
  }

  async executeAction(id: string, user: JwtUser) {
    const action = await this.ensureActionAccess(id, user);
    if (action.status !== "PENDING_REVIEW" && action.status !== "APPROVED") {
      throw new BadRequestException("Action này không còn ở trạng thái chờ duyệt");
    }

    const definition = this.agentActionRegistry.getDefinition(action.actionType);
    if (!definition) {
      throw new BadRequestException("Action này chưa được hỗ trợ");
    }
    if (!hasPermission(user, definition.requiredPermission)) {
      throw new ForbiddenException("Bạn không có quyền thực thi action này");
    }

    const payload = action.finalPayload ?? action.proposedPayload;
    const parsed = definition.schema.safeParse(payload);
    if (!parsed.success) {
      const validationErrors = parsed.error.flatten();
      await this.prisma.agentAction.update({
        where: { id },
        data: { validationErrors: this.toInputJson(validationErrors) }
      });
      throw new BadRequestException("Payload action không hợp lệ");
    }

    try {
      const entityRef = await definition.executor(parsed.data, user);
      const updated = await this.prisma.agentAction.update({
        where: { id },
        data: {
          status: "EXECUTED",
          reviewedById: user.sub,
          reviewedAt: new Date(),
          executedAt: new Date(),
          executionError: null,
          targetEntityType: entityRef.type,
          targetEntityId: entityRef.id,
          validationErrors: Prisma.JsonNull
        }
      });

      await this.domainEvents.emit("agent_action.executed", {
        actionId: updated.id,
        actionType: updated.actionType,
        targetEntityType: entityRef.type,
        targetEntityId: entityRef.id,
        userId: user.sub
      });

      return this.mapAgentAction(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể thực thi action";
      const updated = await this.prisma.agentAction.update({
        where: { id },
        data: {
          status: "FAILED",
          reviewedById: user.sub,
          reviewedAt: new Date(),
          executionError: message
        }
      });
      return this.mapAgentAction(updated);
    }
  }

  async rejectAction(id: string, dto: RejectAgentActionDto, user: JwtUser) {
    const action = await this.ensureActionAccess(id, user);
    if (action.status !== "PENDING_REVIEW" && action.status !== "APPROVED") {
      throw new BadRequestException("Action này không còn ở trạng thái chờ duyệt");
    }

    const updated = await this.prisma.agentAction.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: user.sub,
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote ?? null
      }
    });

    return this.mapAgentAction(updated);
  }

  private async ensureAgent(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundException("Không tìm thấy agent");
    }

    return agent;
  }

  private async ensureCustomerAccess(customerId: string, user: JwtUser) {
    if (!hasPermission(user, "customers.view")) {
      throw new ForbiddenException("Bạn không có quyền xem khách hàng");
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        deletedAt: null,
        ...(isStaff(user) ? { assignedToId: user.sub } : {})
      },
      select: { id: true }
    });

    if (!customer) {
      throw new NotFoundException("Không tìm thấy khách hàng hoặc bạn không có quyền truy cập");
    }
  }

  private async ensureActionAccess(id: string, user: JwtUser) {
    const action = await this.prisma.agentAction.findUnique({ where: { id } });
    if (!action) {
      throw new NotFoundException("Không tìm thấy action AI");
    }
    if (!isAdmin(user) && action.requestedById !== user.sub) {
      throw new ForbiddenException("Bạn không có quyền thao tác action này");
    }
    if (action.contextEntityType === "customer" && action.contextEntityId) {
      await this.ensureCustomerAccess(action.contextEntityId, user);
    }

    return action;
  }

  private mapAgentAction(action: AgentAction) {
    const definition = this.agentActionRegistry.getDefinition(action.actionType);
    const payload = action.finalPayload ?? action.proposedPayload;
    const parsed = definition?.schema.safeParse(payload);

    return {
      id: action.id,
      agentRunId: action.agentRunId,
      actionType: action.actionType,
      contextEntityType: action.contextEntityType,
      contextEntityId: action.contextEntityId,
      targetEntityType: action.targetEntityType,
      targetEntityId: action.targetEntityId,
      proposedPayload: action.proposedPayload,
      finalPayload: action.finalPayload,
      validationErrors: action.validationErrors,
      status: action.status,
      riskLevel: action.riskLevel,
      requestedById: action.requestedById,
      reviewedById: action.reviewedById,
      reviewedAt: action.reviewedAt,
      reviewNote: action.reviewNote,
      executedAt: action.executedAt,
      executionError: action.executionError,
      dryRunSummary: definition && parsed?.success ? definition.dryRunSummary(parsed.data) : null,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt
    };
  }

  private detectCustomerSignal(customer: {
    name: string;
    activities: Array<{ title: string; updatedAt: Date }>;
    projects: Array<{
      name: string;
      quotes: Array<{ quoteNo: string; sentAt: Date | null; updatedAt: Date }>;
    }>;
  }) {
    const now = Date.now();
    const latestActivity = customer.activities[0];
    if (!latestActivity) {
      return {
        title: `Follow-up khách hàng ${customer.name}`,
        reason: "Khách hàng chưa có hoạt động nào trong CRM.",
        content: `Khách hàng ${customer.name} chưa có hoạt động được ghi nhận. Nên liên hệ để cập nhật nhu cầu, người phụ trách và bước tiếp theo.`
      };
    }

    const inactiveDays = Math.floor((now - latestActivity.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
    if (inactiveDays >= CUSTOMER_INACTIVITY_DAYS) {
      return {
        title: `Follow-up sau ${inactiveDays} ngày chưa tương tác`,
        reason: `Khách hàng chưa có hoạt động mới trong ${inactiveDays} ngày.`,
        content: `Hoạt động cuối là "${latestActivity.title}" cách đây ${inactiveDays} ngày. Nên gọi hoặc gửi email follow-up để xác nhận tình trạng cơ hội.`
      };
    }

    for (const project of customer.projects) {
      const sentQuote = project.quotes[0];
      if (!sentQuote) {
        continue;
      }
      const sentAt = sentQuote.sentAt ?? sentQuote.updatedAt;
      const sentDays = Math.floor((now - sentAt.getTime()) / (24 * 60 * 60 * 1000));
      if (sentDays >= SENT_QUOTE_STALE_DAYS) {
        return {
          title: `Nhắc phản hồi báo giá ${sentQuote.quoteNo}`,
          reason: `Báo giá ${sentQuote.quoteNo} của dự án ${project.name} đã gửi ${sentDays} ngày.`,
          content: `Báo giá ${sentQuote.quoteNo} đã ở trạng thái đã gửi ${sentDays} ngày. Nên follow-up để xác nhận phản hồi và trở ngại ra quyết định.`
        };
      }
    }

    return null;
  }

  private buildCreateActivityPayload(customerId: string, signal: { title: string; content: string }) {
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 1);
    scheduledAt.setHours(9, 0, 0, 0);

    return {
      type: "FOLLOWUP",
      title: signal.title,
      content: signal.content,
      customerId,
      scheduledAt: scheduledAt.toISOString()
    };
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private async runTools(tools: AgentTool[], dto: RunAgentDto, user: JwtUser) {
    const results: ToolResult[] = [];
    for (const tool of tools) {
      const startedAt = Date.now();
      if (!this.canUseTool(tool, user)) {
        throw new ForbiddenException("Bạn không có quyền dùng tool này");
      }

      results.push({
        toolName: tool,
        inputJson: { query: dto.input },
        outputJson: await this.executeTool(tool, dto, user),
        status: "SUCCESS",
        durationMs: Date.now() - startedAt
      });
    }

    return results;
  }

  private canUseTool(tool: AgentTool, user: JwtUser) {
    if (tool === "search_customers" || tool === "get_customer_summary_context") {
      return hasPermission(user, "customers.view");
    }
    if (tool === "search_projects") {
      return hasPermission(user, "projects.view");
    }
    return hasPermission(user, "customers.view");
  }

  private async executeTool(tool: AgentTool, dto: RunAgentDto, user: JwtUser): Promise<Prisma.InputJsonValue> {
    switch (tool) {
      case "search_customers":
        return this.searchCustomers(dto.input, user);
      case "get_customer_summary_context":
        return this.getCustomerContext(dto.context?.customerId, user);
      case "search_projects":
        return this.searchProjects(dto.input, user);
      case "draft_sales_email":
        return { instruction: dto.input, hint: "Soạn email bán hàng dựa trên context CRM và yêu cầu người dùng." };
      default:
        return { message: "Tool chưa được hỗ trợ" };
    }
  }

  private searchCustomers(query: string, user: JwtUser) {
    return this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(isStaff(user) ? { assignedToId: user.sub } : {}),
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { shortName: { contains: query, mode: "insensitive" } },
          { code: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        industry: true
      },
      take: 5
    });
  }

  private async getCustomerContext(customerId: string | undefined, user: JwtUser) {
    if (!customerId) {
      return { message: "Không có customerId trong context" };
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        deletedAt: null,
        ...(isStaff(user) ? { assignedToId: user.sub } : {})
      },
      select: {
        id: true,
        name: true,
        status: true,
        activities: {
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            type: true,
            title: true,
            content: true,
            isCompleted: true,
            updatedAt: true
          }
        },
        projects: {
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            code: true,
            name: true,
            status: true,
            estimatedValue: true
          }
        }
      }
    });

    return customer ?? { message: "Không tìm thấy khách hàng hoặc không có quyền truy cập" };
  }

  private searchProjects(query: string, user: JwtUser) {
    return this.prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(isStaff(user) ? { customer: { assignedToId: user.sub } } : {}),
        OR: [
          { code: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
          { customer: { name: { contains: query, mode: "insensitive" } } }
        ]
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        estimatedValue: true,
        customer: { select: { name: true } }
      },
      take: 5
    });
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ServiceUnavailableException("AI provider phản hồi quá lâu, vui lòng thử lại."));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timeout);
          resolve(value);
        })
        .catch((error: unknown) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
}
