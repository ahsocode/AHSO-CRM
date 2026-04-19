import Anthropic from "@anthropic-ai/sdk";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma.service";
import { AiService } from "./ai.service";

jest.mock("@anthropic-ai/sdk");

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
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      customer: {
        findFirst: jest.fn()
      },
      project: {
        findMany: jest.fn(),
        findFirst: jest.fn()
      }
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === "ANTHROPIC_API_KEY") {
          return "test-key";
        }

        return undefined;
      })
    };

    (Anthropic as unknown as jest.Mock).mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                subject: "Chốt lịch họp dự án",
                body: "Kính gửi anh/chị,\nAHSO xin đề nghị chốt lịch họp..."
              })
            }
          ]
        })
      }
    }));

    service = new AiService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService
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

    await expect(service.summarizeActivities("customer-1")).resolves.toEqual({
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
      service.draftEmail({
        customerId: "customer-1",
        projectId: "project-1",
        purpose: "Chốt lịch họp kỹ thuật",
        tone: "formal"
      })
    ).resolves.toMatchObject({
      subject: "Chốt lịch họp dự án",
      body: expect.stringContaining("AHSO xin đề nghị")
    });
  });
});
