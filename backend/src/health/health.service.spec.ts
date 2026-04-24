import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma.service";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  let service: HealthService;
  let prisma: {
    $queryRaw: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn()
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === "NODE_ENV") {
          return "test";
        }

        if (key === "REDIS_URL") {
          return "redis://127.0.0.1:6379";
        }

        return undefined;
      })
    };

    service = new HealthService(prisma as unknown as PrismaService, configService as unknown as ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns up when database and redis checks succeed", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    jest.spyOn(service as any, "pingRedis").mockResolvedValue(undefined);

    const status = await service.getStatus();

    expect(status.status).toBe("up");
    expect(status.environment).toBe("test");
    expect(status.services.database.status).toBe("up");
    expect(status.services.redis.status).toBe("up");
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns down with dependency details when checks fail", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("db unavailable"));
    jest.spyOn(service as any, "pingRedis").mockRejectedValue(new Error("redis unavailable"));

    const status = await service.getStatus();

    expect(status.status).toBe("down");
    expect(status.services.database).toMatchObject({
      status: "down",
      details: "db unavailable"
    });
    expect(status.services.redis).toMatchObject({
      status: "down",
      details: "redis unavailable"
    });
  });
});
