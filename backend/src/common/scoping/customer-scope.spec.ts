import type { JwtUser } from "../../auth/auth.types";
import { scopeCustomerWhereToUser } from "./customer-scope";

const staff = { sub: "u1", role: "STAFF", permissions: [] } as unknown as JwtUser;
const manager = { sub: "u2", role: "MANAGER", permissions: [] } as unknown as JwtUser;
const admin = { sub: "u3", role: "ADMIN", permissions: [] } as unknown as JwtUser;

describe("scopeCustomerWhereToUser", () => {
  it("restricts a STAFF user to their own customers with an active owner", () => {
    const where = scopeCustomerWhereToUser({ deletedAt: null }, staff);
    expect(where).toEqual({
      deletedAt: null,
      assignedToId: "u1",
      assignedTo: { isActive: true }
    });
  });

  it("is a no-op for MANAGER", () => {
    expect(scopeCustomerWhereToUser({ deletedAt: null }, manager)).toEqual({ deletedAt: null });
  });

  it("is a no-op for ADMIN", () => {
    expect(scopeCustomerWhereToUser({ deletedAt: null }, admin)).toEqual({ deletedAt: null });
  });

  it("mutates and returns the same object (safe to call on a nested customer filter)", () => {
    const where = { deletedAt: null } as Record<string, unknown>;
    const result = scopeCustomerWhereToUser(where, staff);
    expect(result).toBe(where);
    expect(where.assignedToId).toBe("u1");
  });
});
