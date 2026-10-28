import { dateHelper } from "./format-date";

/** 2026-10-19T17:00Z is 20/10/2026 00:00 in Asia/Ho_Chi_Minh (audit E-08). */
const SIGN_DATE = "2026-10-19T17:00:00.000Z";

describe("date helper (Asia/Ho_Chi_Minh, independent of process TZ)", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it.each(["UTC", "America/New_York", "Asia/Ho_Chi_Minh"])("prints the Vietnamese calendar day with TZ=%s", (tz) => {
    process.env.TZ = tz;
    expect(dateHelper(SIGN_DATE)).toBe("20/10/2026");
    expect(dateHelper(SIGN_DATE, "long")).toBe("ngày 20 tháng 10 năm 2026");
    expect(dateHelper(SIGN_DATE, "long-body")).toBe("20 tháng 10 năm 2026");
    expect(dateHelper(SIGN_DATE, "long-en")).toBe("October 20, 2026");
    expect(dateHelper("2026-12-31T17:30:00.000Z", "year")).toBe("2027");
  });

  it("keeps iso output and empty string for missing/invalid dates", () => {
    expect(dateHelper(SIGN_DATE, "iso")).toBe(SIGN_DATE);
    expect(dateHelper(null)).toBe("");
    expect(dateHelper("not a date")).toBe("");
    expect(dateHelper(new Date(SIGN_DATE), "unknown-mode")).toBe("20/10/2026");
  });
});
