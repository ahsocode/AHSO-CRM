export const ROLE_VALUES = ["ADMIN", "MANAGER", "STAFF"] as const;

export type RoleValue = (typeof ROLE_VALUES)[number];

