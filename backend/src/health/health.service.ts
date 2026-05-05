import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { Socket } from "node:net";
import { isAbsolute, resolve } from "node:path";
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
    uploads: DependencyHealth;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async getStatus(): Promise<ApplicationHealthStatus> {
    const [database, redis, uploads] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkUploads()
    ]);
    const status: HealthCheckStatus =
      database.status === "up" && redis.status === "up" && uploads.status === "up" ? "up" : "down";

    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: this.configService.get<string>("NODE_ENV") ?? "development",
      services: {
        database,
        redis,
        uploads
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

  private async checkUploads(): Promise<DependencyHealth> {
    const startedAt = Date.now();
    const uploadRoot = this.getUploadRoot();
    const probePath = resolve(uploadRoot, `.healthcheck-${randomUUID()}`);

    try {
      await mkdir(uploadRoot, { recursive: true });
      await writeFile(probePath, "ok");
      await rm(probePath, { force: true });

      return {
        status: "up",
        latencyMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        status: "down",
        latencyMs: Date.now() - startedAt,
        details: error instanceof Error ? error.message : "Không thể ghi vào thư mục uploads."
      };
    }
  }

  private getUploadRoot() {
    const configuredUploadDir = this.configService.get<string>("UPLOAD_DIR") ?? "./uploads";
    return isAbsolute(configuredUploadDir)
      ? configuredUploadDir
      : resolve(process.cwd(), configuredUploadDir);
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
