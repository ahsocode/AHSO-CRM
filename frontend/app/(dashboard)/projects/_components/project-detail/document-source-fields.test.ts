import { describe, expect, it } from "vitest";
import { sourceDateFromISO, sourceDateToISO } from "./document-source-fields";

describe("recorded document dates", () => {
  it("submits a Vietnamese calendar date with an explicit +07:00 offset", () => {
    const date = sourceDateToISO("2026-09-16");
    expect(date).toBe("2026-09-16T00:00:00+07:00");
    expect(new Date(date).toISOString()).toBe("2026-09-15T17:00:00.000Z");
  });
  it("loads persisted dates as the same Vietnamese day across midnight UTC", () => {
    expect(sourceDateFromISO("2026-09-15T17:00:00Z")).toBe("2026-09-16");
    expect(sourceDateFromISO("2026-09-16T23:30:00Z")).toBe("2026-09-17");
    expect(sourceDateFromISO(sourceDateToISO("2026-09-16"))).toBe("2026-09-16");
  });
  it("does not substitute today for a missing or invalid date", () => {
    expect(sourceDateToISO("")).toBe("");
    expect(sourceDateFromISO(undefined)).toBe("");
    expect(sourceDateFromISO("invalid")).toBe("");
  });
});
