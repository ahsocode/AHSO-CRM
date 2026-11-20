import { Injectable, Logger, NotFoundException, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { AuditService } from "../audit/audit.service";
import type { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import {
  API_TOKEN_PREFIX,
  LAST_USED_THROTTLE_MS,
  MACHINE_EXTRA_PERMISSIONS,
  MACHINE_ROLE_NAME,
  SERVICE_ACTOR_PREFIX
} from "./api-token.constants";
import type { MachinePrincipal } from "./api-token.types";
import type { CreateApiTokenDto } from "./dto/create-api-token.dto";
import { MachineAuthRegistry, type MachineAuthenticator } from "./machine-auth";

/** prefix + base64url(32 bytes) = 43 chars */
const TOKEN_PATTERN = new RegExp(`^${API_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`);
const INVALID_TOKEN_MESSAGE = "Token API không hợp lệ, đã hết hạn hoặc đã bị thu hồi";

export function hashApiToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

@Injectable()
export class ApiTokensService implements MachineAuthenticator, OnModuleInit {
  private readonly logger = new Logger(ApiTokensService.name);
  private readonly lastUsedWrites = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  onModuleInit() {
    MachineAuthRegistry.register(this);
  }

  /** Creates a token. The plaintext is returned exactly once and never stored or logged. */
  async create(dto: CreateApiTokenDto, actor: JwtUser, ip?: string | null) {
    const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
    const tokenPrefix = token.slice(0, API_TOKEN_PREFIX.length + 4);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.apiToken.create({
        data: {
          name: dto.name,
          tokenHash: hashApiToken(token),
          tokenPrefix,
          scopes: Array.from(new Set(dto.scopes)),
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          createdById: actor.sub
        }
      });
      await this.audit.recordEvent(
        {
          userId: actor.sub,
          action: "api_token.create",
          resource: "api-token",
          resourceId: created.id,
          changes: { after: { name: created.name, scopes: created.scopes, tokenPrefix, expiresAt: created.expiresAt } },
          ip
        },
        tx
      );
      return created;
    });

    return {
      id: row.id,
      name: row.name,
      scopes: row.scopes,
      tokenPrefix: row.tokenPrefix,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      token
    };
  }

  /** Never selects tokenHash. */
  list() {
    return this.prisma.apiToken.findMany({
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        scopes: true,
        isActive: true,
        createdById: true,
        lastUsedAt: true,
        lastUsedIp: true,
        expiresAt: true,
        revokedAt: true,
        revokedById: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async revoke(id: string, actor: JwtUser, ip?: string | null) {
    const existing = await this.prisma.apiToken.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Không tìm thấy token API");
    }
    if (!existing.isActive) {
      return { id, isActive: false, revokedAt: existing.revokedAt };
    }

    const revokedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.apiToken.update({
        where: { id },
        data: { isActive: false, revokedAt, revokedById: actor.sub }
      });
      await this.audit.recordEvent(
        {
          userId: actor.sub,
          action: "api_token.revoke",
          resource: "api-token",
          resourceId: id,
          changes: {
            before: { isActive: true },
            after: { isActive: false, revokedAt },
            meta: { name: existing.name, tokenPrefix: existing.tokenPrefix }
          },
          ip
        },
        tx
      );
    });
    this.lastUsedWrites.delete(id);
    return { id, isActive: false, revokedAt };
  }

  /** Authenticates a raw bearer token. All failures raise the same generic 401. */
  async authenticate(rawToken: string, ip: string | null): Promise<MachinePrincipal> {
    if (!TOKEN_PATTERN.test(rawToken)) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }

    const computed = Buffer.from(hashApiToken(rawToken), "hex");
    const row = await this.prisma.apiToken.findUnique({ where: { tokenHash: computed.toString("hex") } });
    const stored = row ? Buffer.from(row.tokenHash, "hex") : null;

    // Constant-time comparison of the digests (defence in depth on top of the indexed lookup).
    if (!row || !stored || stored.length !== computed.length || !timingSafeEqual(stored, computed)) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }
    if (!row.isActive || row.revokedAt || (row.expiresAt && row.expiresAt.getTime() <= Date.now())) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }

    await this.touchLastUsed(row.id, ip);

    const permissions = Array.from(new Set([...row.scopes, ...MACHINE_EXTRA_PERMISSIONS]));
    return {
      sub: `${SERVICE_ACTOR_PREFIX}${row.id}`,
      email: `${SERVICE_ACTOR_PREFIX}${row.id}@machine.local`,
      name: row.name,
      role: { id: "", name: MACHINE_ROLE_NAME, permissions },
      permissions,
      isMachine: true,
      tokenId: row.id,
      scopes: [...row.scopes],
      ownerUserId: row.createdById
    };
  }

  private async touchLastUsed(tokenId: string, ip: string | null) {
    const now = Date.now();
    const last = this.lastUsedWrites.get(tokenId);
    if (last !== undefined && now - last < LAST_USED_THROTTLE_MS) {
      return;
    }
    this.lastUsedWrites.set(tokenId, now);
    try {
      await this.prisma.apiToken.update({
        where: { id: tokenId },
        data: { lastUsedAt: new Date(now), lastUsedIp: ip }
      });
    } catch (error) {
      // Usage tracking must never block authentication.
      this.logger.warn(`Không thể cập nhật lastUsedAt cho token ${tokenId}: ${error instanceof Error ? error.message : "lỗi"}`);
    }
  }
}
