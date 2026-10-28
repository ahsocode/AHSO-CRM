import { describe, expect, it } from "vitest";
import {
  activeKpi,
  kpiToFilters,
  parseQuotePageSize,
  partitionDeletable,
  runSequential
} from "./quote-list";

describe("quote list helpers", () => {
  it("allow-lists page size", () => {
    expect(parseQuotePageSize("50")).toBe(50);
    expect(parseQuotePageSize("100")).toBe(25);
    expect(parseQuotePageSize(null)).toBe(25);
    expect(parseQuotePageSize("abc")).toBe(25);
  });

  it("maps KPI cards to filters and back", () => {
    expect(kpiToFilters("draft")).toEqual({ status: "DRAFT", expiring: false });
    expect(kpiToFilters("expiring")).toEqual({ status: "", expiring: true });
    expect(kpiToFilters("all")).toEqual({ status: "", expiring: false });
    expect(activeKpi("SENT", false)).toBe("sent");
    expect(activeKpi("", true)).toBe("expiring");
    expect(activeKpi("", false)).toBe("all");
    expect(activeKpi("ACCEPTED", false)).toBeNull();
  });

  it("only DRAFT and REJECTED are deletable", () => {
    const { deletable, skipped } = partitionDeletable([
      { id: "a", status: "DRAFT" as const },
      { id: "b", status: "SENT" as const },
      { id: "c", status: "REJECTED" as const },
      { id: "d", status: "ACCEPTED" as const }
    ]);
    expect(deletable.map((q) => q.id)).toEqual(["a", "c"]);
    expect(skipped.map((q) => q.id)).toEqual(["b", "d"]);
  });

  it("runSequential continues after failures and reports progress", async () => {
    const progress: number[] = [];
    const result = await runSequential(
      [1, 2, 3],
      async (n) => {
        if (n === 2) throw new Error("boom");
      },
      (done) => progress.push(done)
    );
    expect(result.ok.map((r) => r.item)).toEqual([1, 3]);
    expect(result.failed).toEqual([{ item: 2, message: "boom" }]);
    expect(progress).toEqual([1, 2, 3]);
  });
});
