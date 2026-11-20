import { ForbiddenException } from "@nestjs/common";
import { API_TOKEN_PREFIX } from "./api-token.constants";
import type { MachinePrincipal } from "./api-token.types";

export interface MachineAuthenticator {
  authenticate(rawToken: string, ip: string | null): Promise<MachinePrincipal>;
}

/**
 * Static bridge so the shared JwtAuthGuard (instantiated in ~44 modules with only Reflector)
 * can authenticate machine tokens without extra DI wiring. ApiTokensService registers itself.
 */
export class MachineAuthRegistry {
  private static authenticator: MachineAuthenticator | null = null;

  static register(authenticator: MachineAuthenticator) {
    MachineAuthRegistry.authenticator = authenticator;
  }

  static get() {
    return MachineAuthRegistry.authenticator;
  }

  static clear() {
    MachineAuthRegistry.authenticator = null;
  }
}

/** Returns the raw token when the Authorization header is a machine bearer, else null. */
export function extractMachineToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(value);
  if (!match || !match[1].startsWith(API_TOKEN_PREFIX)) return null;
  return match[1];
}

/** Default deny: a machine principal may only reach handlers annotated with the scopes it holds. */
export function assertMachineScope(principal: MachinePrincipal, required: string[] | undefined) {
  if (!required || required.length === 0) {
    throw new ForbiddenException("Tài khoản máy không được phép gọi API này");
  }
  const missing = required.filter((scope) => !principal.scopes.includes(scope));
  if (missing.length > 0) {
    throw new ForbiddenException("Token API không có phạm vi (scope) cần thiết cho thao tác này");
  }
}
