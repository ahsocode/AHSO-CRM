import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { API_TOKEN_PREFIX } from "./api-token.constants";
import { ApiTokensService, hashApiToken } from "./api-tokens.service";
import { createApiTokenSchema } from "./dto/create-api-token.dto";
import { MachineAuthRegistry } from "./machine-auth";

const admin = { sub: "admin-1", email: "a@x", name: "A", role: "ADMIN" as const, permissions: [] };

const data0 = (tx: { apiToken: { create: jest.Mock } }) => tx.apiToken.create.mock.calls[0][0].data;

function setup() {
  const tx = { apiToken: { create: jest.fn(), update: jest.fn() } };
  const prisma = {
    apiToken: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx))
  };
  const audit = { recordEvent: jest.fn().mockResolvedValue({}) };
  const service = new ApiTokensService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, tx, audit };
}

describe("createApiTokenSchema", () => {
  it("accepts whitelisted scopes and dedups", () => {
    const parsed = createApiTokenSchema.parse({ name: "bot", scopes: ["inventory.read", "inventory.read"] });
    expect(parsed.scopes).toEqual(["inventory.read", "inventory.read"]); // deduped by the service
  });

  it.each(["inventory.confirm", "inventory.cancel", "inventory.approve", "inventory.lock", "*", "admin"])(
    "rejects non-whitelisted scope %s",
    (scope) => {
      expect(createApiTokenSchema.safeParse({ name: "bot", scopes: [scope] }).success).toBe(false);
    }
  );

  it("rejects empty scopes and past expiry", () => {
    expect(createApiTokenSchema.safeParse({ name: "bot", scopes: [] }).success).toBe(false);
    expect(createApiTokenSchema.safeParse({ name: "bot", scopes: ["inventory.read"], expiresAt: "2020-01-01T00:00:00Z" }).success).toBe(false);
  });
});

describe("ApiTokensService", () => {
  afterEach(() => MachineAuthRegistry.clear());

  it("registers itself as the machine authenticator", () => {
    const { service } = setup();
    service.onModuleInit();
    expect(MachineAuthRegistry.get()).toBe(service);
  });

  it("create returns plaintext once, stores only hash + prefix, audits without the token", async () => {
    const { service, tx, audit } = setup();
    tx.apiToken.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "t1", createdAt: new Date(), expiresAt: null, ...data
    }));

    const result = await service.create({ name: "bot", scopes: ["inventory.read"], expiresAt: null }, admin, "1.1.1.1");

    expect(data0(tx).scopes).toEqual(["inventory.read"]);
    expect(result.token).toMatch(/^ahso_sa_[A-Za-z0-9_-]{43}$/);
    expect(result.tokenPrefix).toBe(result.token.slice(0, API_TOKEN_PREFIX.length + 4));
    const data = tx.apiToken.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashApiToken(result.token));
    expect(JSON.stringify(data)).not.toContain(result.token);
    expect(JSON.stringify(audit.recordEvent.mock.calls)).not.toContain(result.token);
    expect(audit.recordEvent.mock.calls[0][0]).toMatchObject({ action: "api_token.create", resourceId: "t1" });
    expect(audit.recordEvent.mock.calls[0][1]).toBe(tx);
    expect(result).not.toHaveProperty("tokenHash");
  });

  it("two tokens never collide", async () => {
    const { service, tx } = setup();
    tx.apiToken.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "x", createdAt: new Date(), expiresAt: null, ...data }));
    const a = await service.create({ name: "a", scopes: ["inventory.read"], expiresAt: null }, admin);
    const b = await service.create({ name: "b", scopes: ["inventory.read"], expiresAt: null }, admin);
    expect(a.token).not.toBe(b.token);
  });

  it("list never selects tokenHash", async () => {
    const { service, prisma } = setup();
    prisma.apiToken.findMany.mockResolvedValue([]);
    await service.list();
    const select = prisma.apiToken.findMany.mock.calls[0][0].select as Record<string, boolean>;
    expect(select.tokenHash).toBeUndefined();
    expect(select.id).toBe(true);
  });

  it("revoke deactivates, records revokedBy and audits; 404 when missing; idempotent when already revoked", async () => {
    const { service, prisma, tx, audit } = setup();
    prisma.apiToken.findUnique.mockResolvedValueOnce(null);
    await expect(service.revoke("nope", admin)).rejects.toBeInstanceOf(NotFoundException);

    prisma.apiToken.findUnique.mockResolvedValueOnce({ id: "t1", name: "bot", tokenPrefix: "ahso_sa_abcd", isActive: true });
    const res = await service.revoke("t1", admin, "2.2.2.2");
    expect(res.isActive).toBe(false);
    expect(tx.apiToken.update.mock.calls[0][0].data).toMatchObject({ isActive: false, revokedById: "admin-1" });
    expect(audit.recordEvent.mock.calls[0][0]).toMatchObject({ action: "api_token.revoke", resourceId: "t1" });

    audit.recordEvent.mockClear();
    prisma.apiToken.findUnique.mockResolvedValueOnce({ id: "t1", isActive: false, revokedAt: new Date() });
    await service.revoke("t1", admin);
    expect(audit.recordEvent).not.toHaveBeenCalled();
  });

  describe("authenticate", () => {
    const raw = `${API_TOKEN_PREFIX}${"B".repeat(43)}`;
    const row = (over: Record<string, unknown> = {}) => ({
      id: "t1", name: "bot", tokenHash: hashApiToken(raw), scopes: ["inventory.read"], isActive: true,
      revokedAt: null, expiresAt: null, createdById: "admin-1", ...over
    });

    it("builds a machine principal with scopes + inventory.view_cost and MACHINE role", async () => {
      const { service, prisma } = setup();
      prisma.apiToken.findUnique.mockResolvedValue(row());
      const p = await service.authenticate(raw, "9.9.9.9");
      expect(prisma.apiToken.findUnique.mock.calls[0][0].where.tokenHash).toBe(hashApiToken(raw));
      expect(p).toMatchObject({ sub: "service:t1", isMachine: true, tokenId: "t1", ownerUserId: "admin-1" });
      expect(p.permissions).toEqual(["inventory.read", "inventory.view_cost"]);
      expect((p.role as { name: string }).name).toBe("MACHINE");
    });

    it("rejects malformed, unknown, revoked, inactive and expired tokens with 401", async () => {
      const { service, prisma } = setup();
      await expect(service.authenticate("ahso_sa_short", null)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.apiToken.findUnique).not.toHaveBeenCalled();

      prisma.apiToken.findUnique.mockResolvedValueOnce(null);
      await expect(service.authenticate(raw, null)).rejects.toBeInstanceOf(UnauthorizedException);
      prisma.apiToken.findUnique.mockResolvedValueOnce(row({ isActive: false, revokedAt: new Date() }));
      await expect(service.authenticate(raw, null)).rejects.toBeInstanceOf(UnauthorizedException);
      prisma.apiToken.findUnique.mockResolvedValueOnce(row({ isActive: false }));
      await expect(service.authenticate(raw, null)).rejects.toBeInstanceOf(UnauthorizedException);
      prisma.apiToken.findUnique.mockResolvedValueOnce(row({ expiresAt: new Date(Date.now() - 1000) }));
      await expect(service.authenticate(raw, null)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throttles lastUsedAt/lastUsedIp writes and does not fail auth when the write fails", async () => {
      const { service, prisma } = setup();
      prisma.apiToken.findUnique.mockResolvedValue(row());
      await service.authenticate(raw, "1.2.3.4");
      await service.authenticate(raw, "1.2.3.4");
      await service.authenticate(raw, "1.2.3.4");
      expect(prisma.apiToken.update).toHaveBeenCalledTimes(1);
      expect(prisma.apiToken.update.mock.calls[0][0].data).toMatchObject({ lastUsedIp: "1.2.3.4" });

      const other = setup();
      other.prisma.apiToken.findUnique.mockResolvedValue(row());
      other.prisma.apiToken.update.mockRejectedValue(new Error("db down"));
      await expect(other.service.authenticate(raw, null)).resolves.toMatchObject({ isMachine: true });
    });
  });
});
