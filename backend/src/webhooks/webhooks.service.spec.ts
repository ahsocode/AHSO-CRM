import { BadRequestException } from "@nestjs/common";
import * as dns from "dns";
import { PrismaService } from "../common/prisma.service";
import { MAX_LOGGED_RESPONSE_CHARS, WebhooksService } from "./webhooks.service";

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
  describe("outgoing delivery hardening", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    let fetchMock: jest.Mock;
    let setTimeoutSpy: jest.SpyInstance;

    const useWebhook = (url: string) => {
      prisma.webhook.findMany.mockResolvedValue([{ id: "webhook-1", url, secret: "secret-value" }]);
      prisma.webhookLog.create.mockResolvedValue({});
      prisma.webhook.update.mockResolvedValue({});
    };

    const loggedData = () => prisma.webhookLog.create.mock.calls[0][0].data as {
      response: string | null;
      statusCode: number | null;
    };

    beforeEach(() => {
      fetchMock = jest.fn();
      (global as any).fetch = fetchMock;
      setTimeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation(((callback: TimerHandler) => {
        if (typeof callback === "function") {
          callback();
        }
        return 0 as unknown as NodeJS.Timeout;
      }) as any);
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      setTimeoutSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it("calls fetch with redirect manual and an abort signal", async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "ok" });
      useWebhook("https://example.com/hook");

      await service.emit("customer.created", { customerId: "customer-1" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.redirect).toBe("manual");
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("treats a 3xx response as failure and does not follow it", async () => {
      const text = jest.fn(async () => "internal secret body");
      fetchMock.mockResolvedValue({ ok: false, status: 302, text });
      useWebhook("https://example.com/hook");

      await service.emit("customer.created", { customerId: "customer-1" });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      for (const call of fetchMock.mock.calls) {
        expect(call[0]).toBe("https://example.com/hook");
      }
      expect(text).not.toHaveBeenCalled();
      expect(loggedData().statusCode).toBe(302);
      expect(loggedData().response).toContain("chuyển hướng");
      expect(prisma.webhook.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { failCount: { increment: 1 } } })
      );
    });

    it("treats a 3xx response with ok=true as failure too", async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 301, text: async () => "" });
      useWebhook("https://example.com/hook");

      await service.emit("customer.created", { customerId: "customer-1" });

      expect(prisma.webhook.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { failCount: { increment: 1 } } })
      );
    });

    it("truncates the logged response to the maximum length", async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "x".repeat(10_000) });
      useWebhook("https://example.com/hook");

      await service.emit("customer.created", { customerId: "customer-1" });

      expect(MAX_LOGGED_RESPONSE_CHARS).toBe(2_000);
      expect(loggedData().response).toHaveLength(2_000);
    });

    it("blocks literal internal URL in production without fetch or retry", async () => {
      process.env.NODE_ENV = "production";
      const lookupSpy = jest.spyOn(dns.promises, "lookup");
      useWebhook("http://169.254.169.254/latest/meta-data/");

      await service.emit("customer.created", { customerId: "customer-1" });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(lookupSpy).not.toHaveBeenCalled();
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(prisma.webhookLog.create).toHaveBeenCalledTimes(1);
      expect(loggedData().response).toMatch(/^Webhook bị chặn/);
      expect(loggedData().statusCode).toBeNull();
      expect(prisma.webhook.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { failCount: { increment: 1 } } })
      );
    });

    it("blocks a hostname resolving to a private address in production without fetch or retry", async () => {
      process.env.NODE_ENV = "production";
      const lookupSpy = jest
        .spyOn(dns.promises, "lookup")
        .mockResolvedValue([{ address: "10.0.0.7", family: 4 }] as never);
      useWebhook("https://rebind.example/hook");

      await service.emit("customer.created", { customerId: "customer-1" });

      expect(lookupSpy).toHaveBeenCalledTimes(1);
      expect(lookupSpy).toHaveBeenCalledWith("rebind.example", { all: true });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(loggedData().response).toContain("10.0.0.7");
    });

    it("delivers in production when DNS resolves to public addresses", async () => {
      process.env.NODE_ENV = "production";
      jest.spyOn(dns.promises, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
      fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "ok" });
      useWebhook("https://example.com/hook");

      await service.emit("customer.created", { customerId: "customer-1" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(prisma.webhook.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ failCount: 0 }) })
      );
    });

    it("allows localhost webhooks outside production", async () => {
      process.env.NODE_ENV = "test";
      fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "ok" });
      useWebhook("http://localhost:4000/hook");

      await service.emit("customer.created", { customerId: "customer-1" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("URL validation on create/update", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("rejects an internal URL on create in production", async () => {
      process.env.NODE_ENV = "production";

      await expect(
        service.create({ url: "http://127.0.0.1:5432/", events: ["customer.created"] }, "user-1")
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.webhook.create).not.toHaveBeenCalled();
    });

    it("rejects a non-http protocol on update in any environment", async () => {
      process.env.NODE_ENV = "test";
      prisma.webhook.findUnique.mockResolvedValue({ id: "webhook-1" });

      await expect(service.update("webhook-1", { url: "file:///etc/passwd" })).rejects.toThrow(
        "Webhook URL chỉ được dùng giao thức http hoặc https"
      );
      expect(prisma.webhook.update).not.toHaveBeenCalled();
    });
  });
});
