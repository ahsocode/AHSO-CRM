import { describe, expect, it } from "vitest";
import { ariaSortFor, isTerminalProjectStatus, nextProjectSort } from "./project-list-helpers";

describe("nextProjectSort", () => {
  it("starts with the natural direction for a new column", () => {
    expect(nextProjectSort({}, "name")).toEqual({ sortBy: "name", sortDir: "asc" });
    expect(nextProjectSort({}, "estimatedValue")).toEqual({ sortBy: "estimatedValue", sortDir: "desc" });
  });

  it("reverses on the second click and resets on the third", () => {
    const first = nextProjectSort({}, "name");
    const second = nextProjectSort(first, "name");
    expect(second).toEqual({ sortBy: "name", sortDir: "desc" });
    expect(nextProjectSort(second, "name")).toEqual({});
  });

  it("switches column with that column's natural direction", () => {
    expect(nextProjectSort({ sortBy: "name", sortDir: "desc" }, "estimatedValue")).toEqual({
      sortBy: "estimatedValue",
      sortDir: "desc"
    });
  });
});

describe("ariaSortFor / isTerminalProjectStatus", () => {
  it("maps state to aria-sort values", () => {
    expect(ariaSortFor({ sortBy: "name", sortDir: "asc" }, "name")).toBe("ascending");
    expect(ariaSortFor({ sortBy: "name", sortDir: "desc" }, "name")).toBe("descending");
    expect(ariaSortFor({ sortBy: "name", sortDir: "asc" }, "code")).toBe("none");
  });

  it("flags COMPLETED and LOST as terminal only", () => {
    expect(isTerminalProjectStatus("COMPLETED")).toBe(true);
    expect(isTerminalProjectStatus("LOST")).toBe(true);
    expect(isTerminalProjectStatus("WON")).toBe(false);
  });
});
