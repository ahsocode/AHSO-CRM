import { PrismaService } from "../common/prisma.service";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { DocumentsService } from "../documents/documents.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { projectFilterSchema } from "./dto/project-filter.dto";
import { buildExplicitOrderBy, planGroupedPage } from "./project-order";
import { ProjectsService } from "./projects.service";

describe("planGroupedPage", () => {
  it("serves only active rows while the page is inside the active group", () => {
    expect(planGroupedPage(0, 8, 20)).toEqual({ active: { skip: 0, take: 8 }, terminal: { skip: 0, take: 0 } });
  });

  it("spans the boundary: remaining active rows then the first terminal rows", () => {
    expect(planGroupedPage(16, 8, 20)).toEqual({ active: { skip: 16, take: 4 }, terminal: { skip: 0, take: 4 } });
  });

  it("continues in the terminal group with an offset after the active group", () => {
    expect(planGroupedPage(24, 8, 20)).toEqual({ active: { skip: 20, take: 0 }, terminal: { skip: 4, take: 8 } });
  });

  it("covers every row exactly once across pages", () => {
    const activeCount = 11;
    const seen: number[] = [];
    for (let page = 0; page < 4; page += 1) {
      const plan = planGroupedPage(page * 5, 5, activeCount);
      for (let i = 0; i < plan.active.take; i += 1) seen.push(plan.active.skip + i);
      for (let i = 0; i < plan.terminal.take; i += 1) seen.push(activeCount + plan.terminal.skip + i);
    }
    expect(seen).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
});

describe("project sort query schema", () => {
  it("rejects sort fields outside the allow-list", () => {
    expect(projectFilterSchema.safeParse({ sortBy: "customerId" }).success).toBe(false);
    expect(projectFilterSchema.safeParse({ sortBy: "deletedAt" }).success).toBe(false);
    expect(projectFilterSchema.safeParse({ sortBy: "name", sortDir: "sideways" }).success).toBe(false);
  });

  it("accepts allow-listed fields and parses includeClosed", () => {
    const parsed = projectFilterSchema.parse({ sortBy: "estimatedValue", sortDir: "asc", includeClosed: "true" });
    expect(parsed).toMatchObject({ sortBy: "estimatedValue", sortDir: "asc", includeClosed: true });
    expect(projectFilterSchema.parse({}).sortDir).toBe("desc");
  });

  it("puts null expected end dates last and keeps a stable tie-breaker", () => {
    expect(buildExplicitOrderBy("expectedEndDate", "asc")[0]).toEqual({ expectedEndDate: { sort: "asc", nulls: "last" } });
    expect(buildExplicitOrderBy("name", "asc")).toEqual([
      { name: "asc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" }
    ]);
  });
});

describe("ProjectsService.findAll ordering", () => {
  const user = { sub: "u1", email: "a@ahso.vn", name: "A", role: "ADMIN" as const, permissions: [] };
  const row = (id: string, status: string) => ({
    id,
    code: id,
    name: id,
    description: null,
    status,
    priority: "NORMAL",
    estimatedValue: 0,
    startDate: null,
    expectedEndDate: null,
    stageChangedAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    activities: [],
    customer: { id: "c", name: "C", industry: null, status: "ACTIVE", assignedTo: { id: "u1", name: "A", role: "ADMIN" } },
    contract: null,
    _count: { quotes: 0, milestones: 0, activities: 0 }
  });

  let prisma: {
    $transaction: jest.Mock;
    project: { count: jest.Mock; findMany: jest.Mock };
    activity: { groupBy: jest.Mock };
  };
  let service: ProjectsService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((ops: Array<Promise<unknown>>) => Promise.all(ops)),
      project: { count: jest.fn(), findMany: jest.fn() },
      activity: { groupBy: jest.fn().mockResolvedValue([]) }
    };
    service = new ProjectsService(
      prisma as unknown as PrismaService,
      {} as unknown as CustomFieldsService,
      {} as unknown as DomainEventsService,
      {} as unknown as DocumentsService,
      {} as unknown as InventoryBalanceService
    );
  });

  it("lists active first, terminal last, newest first within each group", async () => {
    prisma.project.count.mockResolvedValue(3); // total and activeCount
    prisma.project.findMany.mockImplementation(async (args: { select?: unknown; where: { AND?: Array<{ status?: { in?: string[]; notIn?: string[] } }> } }) => {
      if (args.select) return [];
      const status = args.where.AND?.[1]?.status;
      return status?.in ? [row("done", "COMPLETED")] : [row("new", "QUOTING"), row("old", "WON")];
    });

    const result = await service.findAll({ page: 1, limit: 8, view: "list", sortDir: "desc", includeClosed: true }, user);

    expect(result.items?.map((item) => item.id)).toEqual(["new", "old", "done"]);
    const listCalls = prisma.project.findMany.mock.calls.map(([args]) => args).filter((args) => !args.select);
    expect(listCalls).toHaveLength(2);
    for (const args of listCalls) {
      expect(args.orderBy).toEqual([{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]);
    }
  });

  it("hides terminal statuses by default and skips the terminal query", async () => {
    prisma.project.count.mockResolvedValue(1);
    prisma.project.findMany.mockImplementation(async (args: { select?: unknown }) => (args.select ? [] : [row("a", "QUOTING")]));

    await service.findAll({ page: 1, limit: 8, view: "list", sortDir: "desc" }, user);

    const listCalls = prisma.project.findMany.mock.calls.map(([args]) => args).filter((args) => !args.select);
    expect(listCalls).toHaveLength(1);
    expect(JSON.stringify(prisma.project.count.mock.calls[0][0].where)).toContain("notIn");
  });

  it("uses the explicit sort directly, without group-first, when sortBy is given", async () => {
    prisma.project.count.mockResolvedValue(2);
    prisma.project.findMany.mockImplementation(async (args: { select?: unknown }) => (args.select ? [] : [row("a", "COMPLETED")]));

    await service.findAll({ page: 2, limit: 5, view: "list", sortBy: "name", sortDir: "asc", includeClosed: true }, user);

    const listCalls = prisma.project.findMany.mock.calls.map(([args]) => args).filter((args) => !args.select);
    expect(listCalls).toHaveLength(1);
    expect(listCalls[0]).toMatchObject({ skip: 5, take: 5 });
    expect(listCalls[0].orderBy[0]).toEqual({ name: "asc" });
  });

  it("orders kanban by updatedAt desc", async () => {
    prisma.project.count.mockResolvedValue(0);
    prisma.project.findMany.mockResolvedValue([]);

    await service.findAll({ page: 1, limit: 8, view: "kanban", sortDir: "desc" }, user);

    const kanbanCall = prisma.project.findMany.mock.calls.map(([args]) => args).find((args) => !args.select);
    expect(kanbanCall.orderBy[0]).toEqual({ updatedAt: "desc" });
  });
});
