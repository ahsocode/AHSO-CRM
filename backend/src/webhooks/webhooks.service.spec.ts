import { PrismaService } from "../common/prisma.service";
import { WebhooksService } from "./webhooks.service";

describe("WebhooksService", () => {
  let service: WebhooksService;
  let prisma: {
    webhook: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
    };
    webhookLog: {
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      webhook: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn()
      },
      webhookLog: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn()
      },
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations))
    };

    service = new WebhooksService(prisma as unknown as PrismaService);
  });

  it("creates a webhook with generated secret", async () => {
    prisma.webhook.create.mockImplementation(({ data }) => ({
      id: "webhook-1",
      ...data
    }));

    const webhook = await service.create(
      {
        url: "https://example.com/hook",
        events: ["customer.created"],
        isActive: true
      },
      "user-1"
    );

    expect(webhook.secret).toHaveLength(64);
    expect(webhook.url).toBe("https://example.com/hook");
  });

  it("delivers webhook with retry and logs the result", async () => {
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "ok"
      });
    (global as any).fetch = fetchMock;
    const setTimeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === "function") {
        callback();
      }
      return 0 as unknown as NodeJS.Timeout;
    }) as any);

    prisma.webhook.findMany.mockResolvedValue([
      {
        id: "webhook-1",
        url: "https://example.com/hook",
        secret: "secret-value"
      }
    ]);
    prisma.webhookLog.create.mockResolvedValue({});
    prisma.webhook.update.mockResolvedValue({});

    await service.emit("customer.created", { customerId: "customer-1" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(prisma.webhookLog.create).toHaveBeenCalled();
    expect(prisma.webhook.update).toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});
