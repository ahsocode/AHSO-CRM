import { buildWhere } from "./quote-where";

describe("buildWhere expiringWithinDays", () => {
  const user = {
    sub: "user-1",
    email: "admin@ahso.vn",
    name: "Admin",
    role: "ADMIN" as const,
    permissions: []
  };
  const now = new Date("2026-10-28T00:00:00.000Z");

  it("limits to open quotes valid within the window", () => {
    const where = buildWhere({ expiringWithinDays: 7 }, user, now);

    expect(where.status).toEqual({ in: ["DRAFT", "SENT"] });
    expect(where.validUntil).toEqual({ gte: now, lte: new Date("2026-11-04T00:00:00.000Z") });
  });

  it("keeps an explicit open status", () => {
    expect(buildWhere({ expiringWithinDays: 7, status: "SENT" }, user, now).status).toBe("SENT");
  });

  it("matches nothing when status can never be expiring", () => {
    expect(buildWhere({ expiringWithinDays: 7, status: "ACCEPTED" }, user, now).status).toEqual({ in: [] });
  });

  it("adds no expiry constraint by default", () => {
    const where = buildWhere({}, user, now);

    expect(where.validUntil).toBeUndefined();
    expect(where.status).toBeUndefined();
  });
});
