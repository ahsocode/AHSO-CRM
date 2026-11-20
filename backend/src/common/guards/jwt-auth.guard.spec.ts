import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { API_TOKEN_PREFIX } from "../../api-tokens/api-token.constants";
import type { MachinePrincipal } from "../../api-tokens/api-token.types";
import { MachineAuthRegistry } from "../../api-tokens/machine-auth";
import { RequireScope } from "../../api-tokens/require-scope.decorator";
import { ROLE_VALUES } from "../constants/role.constants";
import { Public } from "../decorators/public.decorator";
import { Roles } from "../decorators/roles.decorator";
import { RolesGuard } from "./roles.guard";
import { JwtAuthGuard } from "./jwt-auth.guard";

class Fake {
  @RequireScope("inventory.receipt_draft")
  draft() {}

  @RequireScope("inventory.read")
  read() {}

  // Mimics confirm/cancel/lock/approve/token-admin endpoints: no scope annotation.
  @Roles(ROLE_VALUES[0])
  confirm() {}
  cancel() {}
  setLock() {}
  approve() {}
  createToken() {}

  @Public()
  open() {}
}

@RequireScope("inventory.read")
class ScopedClass {
  list() {}
}

const RAW = `${API_TOKEN_PREFIX}${"a".repeat(43)}`;

const principal = (scopes: string[]): MachinePrincipal => ({
  sub: "service:t1",
  email: "service:t1@machine.local",
  name: "bot",
  role: { id: "", name: "MACHINE", permissions: [...scopes, "inventory.view_cost"] },
  permissions: [...scopes, "inventory.view_cost"],
  isMachine: true,
  tokenId: "t1",
  scopes,
  ownerUserId: "admin-1"
});

function ctx(handler: () => void, cls: new () => unknown, authorization?: string) {
  const request: { headers: Record<string, string>; ip: string; user?: unknown } = {
    headers: authorization ? { authorization } : {},
    ip: "10.0.0.1"
  };
  const context = {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("JwtAuthGuard (machine tokens)", () => {
  const guard = new JwtAuthGuard(new Reflector());
  const authenticate = jest.fn();
  const jwtParent = Object.getPrototypeOf(JwtAuthGuard.prototype) as { canActivate: (c: ExecutionContext) => unknown };
  let jwtSpy: jest.SpyInstance;

  beforeEach(() => {
    authenticate.mockReset();
    MachineAuthRegistry.register({ authenticate });
    jwtSpy = jest.spyOn(jwtParent, "canActivate").mockReturnValue(true);
  });

  afterEach(() => {
    jwtSpy.mockRestore();
    MachineAuthRegistry.clear();
  });

  it("sanity: parent is the passport jwt guard", () => {
    expect(typeof AuthGuard("jwt").prototype.canActivate).toBe("function");
  });

  it("human JWT requests still go through the passport jwt flow, untouched", async () => {
    const { context } = ctx(Fake.prototype.confirm, Fake, "Bearer eyJhbGciOi.payload.sig");
    await expect(guard.canActivate(context)).toBe(true);
    expect(jwtSpy).toHaveBeenCalledTimes(1);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("allows a machine token on a handler annotated with a scope it holds and sets request.user", async () => {
    authenticate.mockResolvedValue(principal(["inventory.receipt_draft"]));
    const { context, request } = ctx(Fake.prototype.draft, Fake, `Bearer ${RAW}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith(RAW, "10.0.0.1");
    expect((request.user as MachinePrincipal).isMachine).toBe(true);
    expect(jwtSpy).not.toHaveBeenCalled();
  });

  it("denies a machine token lacking the handler's scope", async () => {
    authenticate.mockResolvedValue(principal(["inventory.read"]));
    const { context } = ctx(Fake.prototype.draft, Fake, `Bearer ${RAW}`);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(["confirm", "cancel", "setLock", "approve", "createToken"] as const)(
    "default-denies a machine token (even with every scope) on un-annotated handler %s",
    async (name) => {
      authenticate.mockResolvedValue(principal(["inventory.read", "inventory.receipt_draft", "inventory.alias_write"]));
      const { context, request } = ctx(Fake.prototype[name], Fake, `Bearer ${RAW}`);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(request.user).toBeUndefined();
    }
  );

  it("honours class-level scope for controllers that opt in", async () => {
    authenticate.mockResolvedValue(principal(["inventory.read"]));
    const { context } = ctx(ScopedClass.prototype.list, ScopedClass, `Bearer ${RAW}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects invalid/revoked machine tokens with 401 and never falls back to JWT", async () => {
    authenticate.mockRejectedValue(new UnauthorizedException("x"));
    const { context } = ctx(Fake.prototype.read, Fake, `Bearer ${RAW}`);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtSpy).not.toHaveBeenCalled();
  });

  it("returns 401 when the machine authenticator is not registered", async () => {
    MachineAuthRegistry.clear();
    const { context } = ctx(Fake.prototype.read, Fake, `Bearer ${RAW}`);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("public handlers skip authentication entirely", () => {
    const { context } = ctx(Fake.prototype.open, Fake, `Bearer ${RAW}`);
    expect(guard.canActivate(context)).toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("RolesGuard also rejects the MACHINE role on ADMIN-only handlers (defence in depth)", () => {
    const roles = new RolesGuard(new Reflector());
    const { context, request } = ctx(Fake.prototype.confirm, Fake);
    request.user = principal(["inventory.read"]);
    expect(roles.canActivate(context)).toBe(false);
  });
});
