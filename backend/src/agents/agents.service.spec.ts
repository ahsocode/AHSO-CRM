import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { AiProviderRegistry } from "../ai/providers/ai-provider-registry.service";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { AgentsService } from "./agents.service";

interface PrismaMock {
  agent: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
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
  let service: AgentsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    registry = {
      generateTextResult: jest.fn()
    };
    service = new AgentsService(
      prisma as never as PrismaService,
      registry as never as AiProviderRegistry
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
});

function createPrismaMock(): PrismaMock {
  return {
    agent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
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
