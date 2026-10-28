import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/lib/constants";
import {
  buildNavSections,
  isNavItemActive,
  parseCollapsedSections,
  toggleCollapsedSection
} from "./nav-groups";
import { resolveCreateRoute, resolveGoTo, shouldIgnoreShortcut } from "./shortcut-helpers";

describe("buildNavSections", () => {
  const items = [...NAV_ITEMS, { href: "/admin", label: "Quản trị", icon: "settings" }];

  it("keeps every item exactly once and Dashboard alone on top", () => {
    const sections = buildNavSections(items);
    expect(sections[0].title).toBeNull();
    expect(sections[0].items.map((i) => i.href)).toEqual(["/dashboard"]);
    const all = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(all.sort()).toEqual(items.map((i) => i.href).sort());
    expect(sections.map((s) => s.title)).toEqual([null, "Bán hàng", "Vận hành", "Phân tích & AI", "Quản trị"]);
  });

  it("drops empty sections when items are filtered out (STAFF)", () => {
    const staff = items.filter((i) => i.href !== "/users" && i.href !== "/admin");
    expect(buildNavSections(staff).some((s) => s.id === "admin")).toBe(false);
  });

  it("does not hide unknown routes", () => {
    const sections = buildNavSections([...items, { href: "/new-thing", label: "X", icon: "x" }]);
    expect(sections.at(-1)?.items[0].href).toBe("/new-thing");
  });
});

describe("isNavItemActive", () => {
  const hrefs = ["/inventory", "/inventory/models", "/customers"];
  it("prefers the most specific item", () => {
    expect(isNavItemActive("/inventory/models/1", "/inventory", hrefs)).toBe(false);
    expect(isNavItemActive("/inventory/models/1", "/inventory/models", hrefs)).toBe(true);
    expect(isNavItemActive("/inventory/receipts", "/inventory", hrefs)).toBe(true);
    expect(isNavItemActive("/customers", "/customers", hrefs)).toBe(true);
  });
});

describe("collapsed state helpers", () => {
  it("parses defensively", () => {
    expect(parseCollapsedSections(null)).toEqual([]);
    expect(parseCollapsedSections("{bad")).toEqual([]);
    expect(parseCollapsedSections('{"a":1}')).toEqual([]);
    expect(parseCollapsedSections('["ops",3]')).toEqual(["ops"]);
  });
  it("toggles", () => {
    expect(toggleCollapsedSection([], "ops")).toEqual(["ops"]);
    expect(toggleCollapsedSection(["ops"], "ops")).toEqual([]);
  });
});

describe("shortcuts", () => {
  it("maps g-then keys", () => {
    expect(resolveGoTo("d")?.href).toBe("/dashboard");
    expect(resolveGoTo("P")?.href).toBe("/projects");
    expect(resolveGoTo("q")?.href).toBe("/quotes");
    expect(resolveGoTo("c")?.href).toBe("/customers");
    expect(resolveGoTo("z")).toBeNull();
  });
  it("resolves create route per section and none elsewhere", () => {
    expect(resolveCreateRoute("/quotes")?.href).toBe("/quotes/new");
    expect(resolveCreateRoute("/inventory/receipts/abc")?.href).toBe("/inventory/receipts/new");
    expect(resolveCreateRoute("/quotes/new")).toBeNull();
    expect(resolveCreateRoute("/dashboard")).toBeNull();
  });
  it("ignores typing targets and modifiers", () => {
    expect(shouldIgnoreShortcut({ key: "n" }, { tagName: "INPUT" })).toBe(true);
    expect(shouldIgnoreShortcut({ key: "n" }, { tagName: "TEXTAREA" })).toBe(true);
    expect(shouldIgnoreShortcut({ key: "n" }, { tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(shouldIgnoreShortcut({ key: "n", metaKey: true }, { tagName: "BODY" })).toBe(true);
    expect(shouldIgnoreShortcut({ key: "n", ctrlKey: true }, null)).toBe(true);
    expect(shouldIgnoreShortcut({ key: "n" }, { tagName: "BODY" })).toBe(false);
  });
});
