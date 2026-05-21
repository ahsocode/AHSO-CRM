import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { createActivitySchema } from "../activities/dto/create-activity.dto";
import { AiProviderRegistry } from "../ai/providers/ai-provider-registry.service";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { AgentActionRegistry } from "./actions/action-registry";
import { AgentsService } from "./agents.service";

interface PrismaMock {
  agent: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  agentRun: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  customer: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  project: {
    findMany: jest.Mock;
  };
  agentAction: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
}

interface RegistryMock {
  generateTextResult: jest.Mock;
}

describe("AgentsService", () => {
  const adminUser: JwtUser = {
    sub: "admin-1",
    email: "admin@ahso.vn",
    name: "Admin",
    role: "ADMIN",
    permissions: []
  };

  const staffWithoutPermissions: JwtUser = {
    sub: "staff-1",
    email: "staff@ahso.vn",
    name: "Staff",
    role: "STAFF",
    permissions: []
  };

  let prisma: PrismaMock;
  let registry: RegistryMock;
  let actionRegistry: { getDefinition: jest.Mock };
  let domainEvents: { emit: jest.Mock };
  let service: AgentsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    registry = {
      generateTextResult: jest.fn()
    };
    actionRegistry = {
      getDefinition: jest.fn().mockReturnValue(createActionDefinition())
    };
    domainEvents = {
      emit: jest.fn()
    };
    service = new AgentsService(
      prisma as never as PrismaService,
      registry as never as AiProviderRegistry,
      actionRegistry as never as AgentActionRegistry,
      domainEvents as never as DomainEventsService
    );
  });

  it("list returns only active agents ordered by newest first", async () => {
    const agents = [{ id: "agent-1", name: "Sales Assistant", isActive: true }];
    prisma.agent.findMany.mockResolvedValue(agents);

    await expect(service.list()).resolves.toEqual(agents);

    expect(prisma.agent.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    });
  });

  it("create stores agent fields and creator id", async () => {
    prisma.agent.create.mockResolvedValue({
      id: "agent-1",
      name: "Sales Assistant"
    });

    await expect(service.create({
      name: "Sales Assistant",
      description: "Hỗ trợ sales",
      systemPrompt: "Bạn là trợ lý sales của AHSO.",
      provider: "openai",
      model: "gpt-4.1-mini",
      enabledTools: ["search_customers"],
      isActive: true
    }, adminUser)).resolves.toEqual({
      id: "agent-1",
      name: "Sales Assistant"
    });

    expect(prisma.agent.create).toHaveBeenCalledWith({
      data: {
        name: "Sales Assistant",
        description: "Hỗ trợ sales",
        systemPrompt: "Bạn là trợ lý sales của AHSO.",
        provider: "openai",
        model: "gpt-4.1-mini",
        enabledTools: ["search_customers"],
        isActive: true,
        createdById: "admin-1"
      }
    });
  });

  it("run throws 503 when no AI provider is configured", async () => {
    prisma.agent.findUnique.mockResolvedValue(createAgent({ enabledTools: [] }));
    prisma.agentRun.create.mockResolvedValue({ id: "run-1" });
    prisma.agentRun.update.mockResolvedValue({ id: "run-1" });
    registry.generateTextResult.mockResolvedValue(null);

    await expect(service.run("agent-1", { input: "Tóm tắt khách hàng" }, adminUser))
      .rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.agentRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: {
        status: "ERROR",
        error: "AI provider chưa được cấu hình. Vui lòng kiểm tra trong Admin.",
        durationMs: expect.any(Number)
      }
    });
  });

  it("run throws 403 when staff lacks permission for a requested tool", async () => {
    prisma.agent.findUnique.mockResolvedValue(createAgent({
      enabledTools: ["search_customers"]
    }));
    prisma.agentRun.create.mockResolvedValue({ id: "run-1" });
    prisma.agentRun.update.mockResolvedValue({ id: "run-1" });

    await expect(service.run("agent-1", { input: "Tìm khách hàng AHSO" }, staffWithoutPermissions))
      .rejects.toBeInstanceOf(ForbiddenException);

    expect(registry.generateTextResult).not.toHaveBeenCalled();
    expect(prisma.agentRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: {
        status: "ERROR",
        error: "Bạn không có quyền dùng tool này",
        durationMs: expect.any(Number)
      }
    });
  });

  it("onModuleInit marks old RUNNING runs as ERROR", async () => {
    prisma.agentRun.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(prisma.agentRun.updateMany).toHaveBeenCalledWith({
      where: {
        status: "RUNNING",
        createdAt: {
          lt: expect.any(Date)
        }
      },
      data: {
        status: "ERROR",
        error: "Timed out — reset on server restart"
      }
    });
  });

  it("scanContext creates a pending CREATE_ACTIVITY action when customer has no recent activity", async () => {
    prisma.customer.findFirst.mockResolvedValue({
      id: "customer-1",
      name: "DNP Water",
      activities: [],
      projects: []
    });
    prisma.agentAction.findMany.mockResolvedValue([]);
    prisma.agent.findFirst.mockResolvedValue(createAgent());
    prisma.agentRun.create.mockResolvedValue({ id: "run-1" });
    prisma.agentAction.create.mockImplementation(({ data }) => ({
      id: "action-1",
      ...data,
      finalPayload: null,
      validationErrors: null,
      targetEntityType: null,
      targetEntityId: null,
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
      executedAt: null,
      executionError: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    prisma.agentRun.update.mockResolvedValue({ id: "run-1" });

    const result = await service.scanContext({ entityType: "customer", entityId: "customer-1" }, adminUser);

    expect(result.created).toBe(1);
    expect(prisma.agentAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentRunId: "run-1",
        actionType: "CREATE_ACTIVITY",
        contextEntityType: "customer",
        contextEntityId: "customer-1",
        status: "PENDING_REVIEW",
        riskLevel: "LOW",
        requestedById: "admin-1"
      })
    });
  });

  it("executeAction validates permission, executes registry action and marks action as EXECUTED", async () => {
    prisma.agentAction.findUnique.mockResolvedValue(createAgentAction());
    prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
    prisma.agentAction.update.mockResolvedValue({
      ...createAgentAction(),
      status: "EXECUTED",
      reviewedById: "admin-1",
      reviewedAt: new Date(),
      executedAt: new Date(),
      targetEntityType: "activity",
      targetEntityId: "activity-1",
      executionError: null
    });

    await expect(service.executeAction("action-1", adminUser)).resolves.toEqual(
      expect.objectContaining({
        id: "action-1",
        status: "EXECUTED",
        targetEntityId: "activity-1"
      })
    );

    expect(actionRegistry.getDefinition().executor).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Follow-up" }),
      adminUser
    );
    expect(domainEvents.emit).toHaveBeenCalledWith("agent_action.executed", expect.objectContaining({
      actionId: "action-1",
      targetEntityId: "activity-1"
    }));
  });

  it("rejectAction marks pending action as REJECTED", async () => {
    prisma.agentAction.findUnique.mockResolvedValue(createAgentAction());
    prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
    prisma.agentAction.update.mockResolvedValue({
      ...createAgentAction(),
      status: "REJECTED",
      reviewedById: "admin-1",
      reviewedAt: new Date(),
      reviewNote: "Không cần follow-up"
    });

    await expect(service.rejectAction("action-1", { reviewNote: "Không cần follow-up" }, adminUser))
      .resolves.toEqual(expect.objectContaining({
        id: "action-1",
        status: "REJECTED",
        reviewNote: "Không cần follow-up"
      }));

    expect(prisma.agentAction.update).toHaveBeenCalledWith({
      where: { id: "action-1" },
      data: {
        status: "REJECTED",
        reviewedById: "admin-1",
        reviewedAt: expect.any(Date),
        reviewNote: "Không cần follow-up"
      }
    });
  });
});

function createPrismaMock(): PrismaMock {
  return {
    agent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    agentRun: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    customer: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    project: {
      findMany: jest.fn()
    },
    agentAction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  };
}

function createAgent(overrides: Partial<{
  id: string;
  name: string;
  systemPrompt: string;
  provider: string | null;
  model: string | null;
  enabledTools: string[];
  isActive: boolean;
}> = {}) {
  return {
    id: "agent-1",
    name: "Sales Assistant",
    description: null,
    systemPrompt: "Bạn là trợ lý sales của AHSO.",
    provider: null,
    model: null,
    enabledTools: [],
    isActive: true,
    createdById: "admin-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function createActionDefinition() {
  return {
    type: "CREATE_ACTIVITY",
    schema: createActivitySchema,
    requiredPermission: "activities.create",
    riskLevel: "LOW",
    targetEntityType: "activity",
    executor: jest.fn().mockResolvedValue({ type: "activity", id: "activity-1", label: "Follow-up" }),
    dryRunSummary: jest.fn().mockReturnValue("Tạo hoạt động Follow-up")
  };
}

function createAgentAction() {
  return {
    id: "action-1",
    agentRunId: "run-1",
    actionType: "CREATE_ACTIVITY",
    contextEntityType: "customer",
    contextEntityId: "customer-1",
    targetEntityType: null,
    targetEntityId: null,
    proposedPayload: {
      type: "FOLLOWUP",
      title: "Follow-up",
      content: "Liên hệ lại khách hàng",
      customerId: "customer-1",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    },
    finalPayload: null,
    validationErrors: null,
    status: "PENDING_REVIEW",
    riskLevel: "LOW",
    requestedById: "admin-1",
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    executedAt: null,
    executionError: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
