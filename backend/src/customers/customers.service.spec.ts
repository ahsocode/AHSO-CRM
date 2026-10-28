import { customerFilterSchema } from "./dto/customer-filter.dto";
import { buildCustomerOrderBy, sumByCustomer } from "./customer-list.util";
import { CustomersService } from "./customers.service";

describe("customer list params", () => {
  it("accepts allow-listed sort fields and rejects others", () => {
    expect(customerFilterSchema.parse({ sortBy: "name", sortDir: "asc" })).toMatchObject({ sortBy: "name", sortDir: "asc" });
    expect(customerFilterSchema.safeParse({ sortBy: "passwordHash" }).success).toBe(false);
    expect(customerFilterSchema.safeParse({ sortDir: "up" }).success).toBe(false);
    expect(customerFilterSchema.parse({}).sortBy).toBeUndefined();
  });

  it("keeps VIP-first default order and applies explicit sort with a tiebreaker", () => {
    expect(buildCustomerOrderBy(undefined, undefined)).toEqual([{ isVip: "desc" }, { updatedAt: "desc" }]);
    expect(buildCustomerOrderBy("name", undefined)).toEqual([{ name: "asc" }, { id: "asc" }]);
    expect(buildCustomerOrderBy("updatedAt", "asc")).toEqual([{ updatedAt: "asc" }, { id: "asc" }]);
  });

  it("sums amounts per customer", () => {
    const totals = sumByCustomer([
      { amount: "1000", project: { customerId: "a" } },
      { amount: 500, project: { customerId: "a" } },
      { amount: "70", project: { customerId: "b" } }
    ]);
    expect(totals.get("a")).toBe(1500);
    expect(totals.get("b")).toBe(70);
    expect(totals.get("c")).toBeUndefined();
  });
});

describe("CustomersService.findAll quoteValue/revenue", () => {
  const admin = { sub: "u1", email: "a@ahso.vn", name: "A", role: "ADMIN" as const, permissions: [] };
  const staff = { ...admin, sub: "u2", role: "STAFF" as const };

  function setup(customerIds: string[]) {
    const customerRows = customerIds.map((id) => ({
      id, name: id, code: id, language: null, shortName: null, taxCode: null, industry: null, address: null,
      status: "ACTIVE", isVip: false, assignedTo: { id: "u1", name: "A", role: "ADMIN" }, contacts: [],
      _count: { projects: 1 }, createdAt: new Date(), updatedAt: new Date()
    }));
    const prisma = {
      customer: { findMany: jest.fn().mockReturnValue("customers"), count: jest.fn().mockReturnValue("count") },
      payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }), findMany: jest.fn().mockResolvedValue([{ amount: "2000", project: { customerId: "c1" } }]) },
      quote: { findMany: jest.fn().mockResolvedValue([
        { total: "300", project: { customerId: "c1" } },
        { total: "200", project: { customerId: "c1" } }
      ]) },
      $transaction: jest.fn().mockResolvedValue([customerRows, customerRows.length, customerRows, 0])
    };
    const service = new CustomersService(prisma as never, {} as never, {} as never);
    return { prisma, service };
  }

  it("fills quoteValue and revenue per page customer with one grouped query each", async () => {
    const { prisma, service } = setup(["c1", "c2"]);
    const result = await service.findAll({ page: 1, limit: 10 } as never, admin);
    expect(result.items.find((i) => i.id === "c1")).toMatchObject({ quoteValue: 500, revenue: 2000 });
    expect(result.items.find((i) => i.id === "c2")).toMatchObject({ quoteValue: 0, revenue: 0 });
    expect(prisma.quote.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.payment.findMany).toHaveBeenCalledTimes(1);
    const quoteWhere = prisma.quote.findMany.mock.calls[0][0].where;
    expect(quoteWhere.status).toEqual({ in: ["SENT", "ACCEPTED"] });
    expect(quoteWhere.deletedAt).toBeNull();
  });

  it("keeps STAFF scoping on the list query", async () => {
    const { prisma, service } = setup(["c1"]);
    await service.findAll({ page: 1, limit: 10 } as never, staff);
    expect(prisma.customer.findMany.mock.calls[0][0].where).toMatchObject({ assignedToId: "u2" });
  });

  it("skips metric queries on an empty page", async () => {
    const { prisma, service } = setup([]);
    await service.findAll({ page: 1, limit: 10 } as never, admin);
    expect(prisma.quote.findMany).not.toHaveBeenCalled();
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });
});
