import { projectProgressPercent } from "./project-progress";

describe("projectProgressPercent", () => {
  it("maps each known pipeline stage to its percentage", () => {
    expect(projectProgressPercent("SURVEY")).toBe(15);
    expect(projectProgressPercent("QUOTING")).toBe(35);
    expect(projectProgressPercent("NEGOTIATING")).toBe(60);
    expect(projectProgressPercent("WON")).toBe(75);
    expect(projectProgressPercent("DELIVERING")).toBe(85);
    expect(projectProgressPercent("COMPLETED")).toBe(100);
  });

  it("returns 0 for LOST or any unknown status", () => {
    expect(projectProgressPercent("LOST")).toBe(0);
    expect(projectProgressPercent("whatever")).toBe(0);
  });
});
