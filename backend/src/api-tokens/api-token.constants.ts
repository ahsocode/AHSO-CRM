/** Machine (service-account) API token contracts. See docs/INVENTORY_COSTING_SPEC.md §7. */
export const API_TOKEN_PREFIX = "ahso_sa_";

/**
 * Whitelist of scopes a token can carry. Deliberately contains NO confirm / cancel / approve /
 * lock / token-management scope: machines can only read, draft receipts and write aliases.
 */
export const API_TOKEN_SCOPES = [
  "inventory.read",
  "inventory.receipt_draft",
  "inventory.alias_write"
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

/** Role name carried by machine principals (never equals ADMIN/MANAGER/STAFF). */
export const MACHINE_ROLE_NAME = "MACHINE";

/** Extra permission every machine principal receives (spec §7.3 assumption: reports see prices). */
export const MACHINE_EXTRA_PERMISSIONS = ["inventory.view_cost"] as const;

/** userId prefix used in audit logs for machine actors. */
export const SERVICE_ACTOR_PREFIX = "service:";

/** Metadata key for @RequireScope. */
export const REQUIRE_SCOPE_KEY = "required_machine_scope";

/** Minimum interval between lastUsedAt writes per token. */
export const LAST_USED_THROTTLE_MS = 60_000;
