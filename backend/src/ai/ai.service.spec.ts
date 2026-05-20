import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { AiService } from "./ai.service";
import { AiProviderRegistry } from "./providers/ai-provider-registry.service";

describe("AiService", () => {
  let service: AiService;
  let prisma: {
    customer: {
      findFirst: jest.Mock;
    };
    project: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    aiUsageLog: {
      create: jest.Mock;
    };
  };
  let aiProviderRegistry: {
    generateTextResult: jest.Mock;
    getActiveProviderName: jest.Mock;
    getStatus: jest.Mock;
  };
  const managerUser: JwtUser = {
    sub: "manager-1",
    email: "manager@ahso.vn",
    name: "Manager",
    role: "MANAGER",
    permissions: []
  };

  beforeEach(() => {
    prisma = {
      customer: {
        findFirst: jest.fn()
      },
      project: {
        findMany: jest.fn(),
        findFirst: jest.fn()
      },
      aiUsageLog: {
        create: jest.fn().mockResolvedValue({})
      }
    };
    aiProviderRegistry = {
      generateTextResult: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          subject: "Chốt lịch họp dự án",
          body: "Kính gửi anh/chị,\nAHSO xin đề nghị chốt lịch họp..."
        }),
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        durationMs: 123
      }),
      getActiveProviderName: jest.fn().mockReturnValue("anthropic"),
      getStatus: jest.fn().mockResolvedValue([
        {
          provider: "anthropic",
          configured: true,
          model: "claude-sonnet-4-20250514",
          authMode: "api_key",
          status: "ACTIVE",
          lastError: null,
          expiresAt: null,
          hasRefreshToken: false,
          source: "env"
        }
      ])
    };

    service = new AiService(
      prisma as unknown as PrismaService,
      aiProviderRegistry as unknown as AiProviderRegistry
    );
  });

  it("returns deterministic summary when customer has no activities", async () => {
    prisma.customer.findFirst.mockResolvedValue({
      id: "customer-1",
      name: "Khách hàng A",
      assignedTo: { name: "Manager" },
      activities: [],
      projects: []
    });

    await expect(service.summarizeActivities("customer-1", managerUser)).resolves.toEqual({
      customerId: "customer-1",
      summary:
        "Khách hàng Khách hàng A hiện chưa có lịch sử tương tác đủ để tạo tóm tắt AI. Nên bắt đầu bằng một cuộc gọi khảo sát nhu cầu hoặc email giới thiệu giải pháp phù hợp."
    });
  });

  it("parses AI JSON output for draft email", async () => {
    prisma.customer.findFirst.mockResolvedValue({
      id: "customer-1",
      name: "Khách hàng A"
    });
    prisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      code: "AHSO-307",
      name: "Dự án tự động hóa",
      status: "QUOTING",
      estimatedValue: 200_000_000
    });

    await expect(
      service.draftEmail(
        {
          customerId: "customer-1",
          projectId: "project-1",
          purpose: "Chốt lịch họp kỹ thuật",
          tone: "formal"
        },
        managerUser
      )
    ).resolves.toMatchObject({
      subject: "Chốt lịch họp dự án",
      body: expect.stringContaining("AHSO xin đề nghị")
    });
  });

  it("exposes provider status without leaking credentials", async () => {
    await expect(service.getProviderStatus()).resolves.toEqual({
      activeProvider: "anthropic",
      providers: [
        {
          provider: "anthropic",
          configured: true,
          model: "claude-sonnet-4-20250514",
          authMode: "api_key",
          status: "ACTIVE",
          lastError: null,
          expiresAt: null,
          hasRefreshToken: false,
          source: "env"
        }
      ]
    });
  });
});
