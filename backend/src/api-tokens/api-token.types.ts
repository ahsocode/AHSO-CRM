import type { JwtUser } from "../auth/auth.types";

/** JwtUser-like principal built from an API token. */
export interface MachinePrincipal extends JwtUser {
  isMachine: true;
  tokenId: string;
  scopes: string[];
  /** User who created the token; usable where a real user FK is required (e.g. createdById). */
  ownerUserId: string;
}

export function isMachinePrincipal(user: unknown): user is MachinePrincipal {
  return Boolean(user) && typeof user === "object" && (user as { isMachine?: unknown }).isMachine === true;
}
