import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditLogFilterDto } from "./dto/audit-log-filter.dto";

interface AuditRecordInput {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  changes?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

const AUDIT_RESOURCE_MODEL_MAP: Record<string, { delegate: string; idField?: string }> = {
  customers: { delegate: "customer" },
  customer: { delegate: "customer" },
  contacts: { delegate: "contact" },
  contact: { delegate: "contact" },
  projects: { delegate: "project" },
  project: { delegate: "project" },
  quotes: { delegate: "quote" },
  quote: { delegate: "quote" },
  contracts: { delegate: "contract" },
  contract: { delegate: "contract" },
  activities: { delegate: "activity" },
  activity: { delegate: "activity" },
  roles: { delegate: "userRole" },
  role: { delegate: "userRole" },
  users: { delegate: "user" },
  user: { delegate: "user" },
  permissions: { delegate: "permission" },
  permission: { delegate: "permission" },
  settings: { delegate: "setting", idField: "key" },
  setting: { delegate: "setting", idField: "key" },
  webhooks: { delegate: "webhook" },
  webhook: { delegate: "webhook" }
};

const SENSITIVE_KEYS = new Set([
  "password",
  "refreshToken",
  "accessToken",
  "token",
  "authorization",
  "cookie",
  "secret",
  "smtpPass",
  "twilioToken",
  "anthropicApiKey"
]);

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: AuditLogFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.resource ? { resource: filters.resource } : {}),
      ...(filters.resourceId ? { resourceId: filters.resourceId } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc"
        }
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async record(input: AuditRecordInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        changes: this.sanitize(input.changes) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null
      }
    });
  }

  async recordLogin(input: Pick<AuditRecordInput, "userId" | "ip" | "userAgent">) {
    return this.record({
      userId: input.userId,
      action: "login",
      resource: "auth",
      ip: input.ip,
      userAgent: input.userAgent
    });
  }

  async captureResourceSnapshot(resource: string, resourceId?: string | null) {
    if (!resourceId) {
      return null;
    }

    const modelConfig = AUDIT_RESOURCE_MODEL_MAP[resource];

    if (!modelConfig) {
      return null;
    }

    const prismaDelegate = (this.prisma as unknown as Record<
      string,
      { findUnique?: (args: { where: Record<string, string> }) => Promise<unknown> }
    >)[modelConfig.delegate];

    if (!prismaDelegate?.findUnique) {
      return null;
    }

    const snapshot = await prismaDelegate.findUnique({
      where: {
        [modelConfig.idField ?? "id"]: resourceId
      }
    });

    return this.sanitize(snapshot);
  }

  sanitize(value: unknown): unknown {
    if (value === undefined || typeof value === "function" || typeof value === "symbol") {
      return undefined;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value
        .map((entry) => this.sanitize(entry))
        .filter((entry) => entry !== undefined);
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    const serializable = value as {
      toJSON?: () => unknown;
      constructor?: {
        name?: string;
      };
    };

    if (typeof serializable.toJSON === "function" && serializable.constructor?.name !== "Object") {
      return this.sanitize(serializable.toJSON());
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const nextValue = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : this.sanitize(entry);

      if (nextValue !== undefined) {
        sanitized[key] = nextValue;
      }
    }

    return sanitized;
  }
}
