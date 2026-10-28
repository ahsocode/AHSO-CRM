import { PrismaService } from "../common/prisma.service";
import { CalendarService } from "./calendar.service";
import { CalendarFilterDto } from "./dto/calendar-filter.dto";

describe("CalendarService unscheduled pending activities", () => {
  const admin = { sub: "admin-1", email: "a@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };
  const staff = { sub: "staff-1", email: "s@ahso.vn", name: "Staff", role: "STAFF" as const, permissions: [] };
  const filters = {
    page: 1,
    limit: 200,
    dateFrom: new Date("2026-10-26T00:00:00"),
    dateTo: new Date("2026-11-01T00:00:00")
  } as CalendarFilterDto;

  const pending = {
    id: "act-1",
    title: "Proposal servo feasibility",
    content: null,
    type: "NOTE",
    scheduledAt: null,
    doneAt: null,
    isCompleted: false,
    createdAt: new Date("2026-10-20T00:00:00Z"),
    updatedAt: new Date("2026-10-21T00:00:00Z"),
    user: { id: "u1", name: "Henry", role: { name: "ADMIN" } },
    customer: { id: "c1", name: "GSS", status: "ACTIVE" },
    project: null
  };

  let findMany: jest.Mock;
  let count: jest.Mock;
  let service: CalendarService;

  beforeEach(() => {
    // Ranged query returns nothing; the unscheduled query returns the pending item.
    findMany = jest.fn().mockImplementation(({ orderBy }) => Promise.resolve(orderBy ? [pending] : []));
    count = jest.fn().mockResolvedValue(7);
    service = new CalendarService({ activity: { findMany, count } } as unknown as PrismaService);
  });

  it("returns unscheduled pending items and counts them in openCount", async () => {
    const result = await service.findEvents(filters, admin);

    expect(result.items).toHaveLength(0);
    expect(result.meta.unscheduled.total).toBe(7);
    expect(result.meta.unscheduled.items[0]).toMatchObject({ id: "act-1", scheduledAt: null, customer: { name: "GSS" } });
    expect(result.meta.summary.unscheduledCount).toBe(7);
    expect(result.meta.summary.openCount).toBe(7);
    expect(result.meta.summary.total).toBe(0);

    const call = findMany.mock.calls.find(([arg]) => arg.orderBy)![0];
    expect(call.take).toBe(20);
    expect(call.orderBy).toEqual({ createdAt: "desc" });
    expect(JSON.stringify(call.where)).toContain('"scheduledAt":null');
    expect(JSON.stringify(call.where)).not.toContain("gte");
  });

  it("keeps STAFF scoping on the unscheduled query", async () => {
    await service.findEvents(filters, staff);
    const call = findMany.mock.calls.find(([arg]) => arg.orderBy)![0];
    expect(JSON.stringify(call.where)).toContain("staff-1");
  });

  it("skips the unscheduled query when only completed items are requested", async () => {
    const result = await service.findEvents({ ...filters, isCompleted: true }, admin);
    expect(result.meta.unscheduled).toEqual({ total: 0, items: [] });
    expect(count).not.toHaveBeenCalled();
  });
});
