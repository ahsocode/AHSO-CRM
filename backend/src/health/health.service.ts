import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Socket } from "node:net";
import { PrismaService } from "../common/prisma.service";

type HealthCheckStatus = "up" | "down";

export interface DependencyHealth {
  status: HealthCheckStatus;
  latencyMs: number;
  details?: string;
}

export interface ApplicationHealthStatus {
  status: HealthCheckStatus;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  services: {
    database: DependencyHealth;
    redis: DependencyHealth;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async getStatus(): Promise<ApplicationHealthStatus> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const status: HealthCheckStatus = database.status === "up" && redis.status === "up" ? "up" : "down";

    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: this.configService.get<string>("NODE_ENV") ?? "development",
      services: {
        database,
        redis
      }
    };
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: "up",
        latencyMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        status: "down",
        latencyMs: Date.now() - startedAt,
        details: error instanceof Error ? error.message : "Không thể kết nối PostgreSQL."
      };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const startedAt = Date.now();
    const redisUrl = this.configService.get<string>("REDIS_URL") ?? "redis://127.0.0.1:6379";

    try {
      const { hostname, port } = new URL(redisUrl);
      await this.pingRedis(hostname, Number(port) || 6379);

      return {
        status: "up",
        latencyMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        status: "down",
        latencyMs: Date.now() - startedAt,
        details: error instanceof Error ? error.message : "Không thể kết nối Redis."
      };
    }
  }

  private pingRedis(host: string, port: number) {
    return new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      let settled = false;

      const finalize = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.destroy();
        callback();
      };

      socket.setTimeout(2000);

      socket.once("connect", () => {
        socket.write("*1\r\n$4\r\nPING\r\n");
      });

      socket.once("data", (buffer) => {
        const response = buffer.toString("utf8");

        if (response.startsWith("+PONG")) {
          finalize(resolve);
          return;
        }

        finalize(() => reject(new Error(`Redis phản hồi không hợp lệ: ${response.trim()}`)));
      });

      socket.once("timeout", () => {
        finalize(() => reject(new Error("Redis health check quá thời gian phản hồi.")));
      });

      socket.once("error", (error) => {
        finalize(() => reject(error));
      });

      socket.connect(port, host);
    });
  }
}
