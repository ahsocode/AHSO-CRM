import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser, hasPermission, isAdmin, isStaff } from "../auth/auth.types";
import { AiProviderRegistry } from "../ai/providers/ai-provider-registry.service";
import { PrismaService } from "../common/prisma.service";
import { AgentTool, CreateAgentDto, RunAgentDto, UpdateAgentDto } from "./dto/agent.dto";

const AGENT_RUN_TIMEOUT_MS = 60_000;

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
    private readonly aiProviderRegistry: AiProviderRegistry
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
        temperature: 0.3
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

  private async ensureAgent(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundException("Không tìm thấy agent");
    }

    return agent;
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
