// Pure helpers for the grouped sidebar (kept free of React so they can be unit-tested).

export interface NavLeaf {
  href: string;
  label: string;
  icon: string;
}

export interface NavSection<T extends NavLeaf = NavLeaf> {
  id: string;
  /** null = rendered at the top without a heading (Dashboard). */
  title: string | null;
  items: T[];
}

const SECTION_DEFS: Array<{ id: string; title: string | null; hrefs: string[] }> = [
  { id: "top", title: null, hrefs: ["/dashboard"] },
  {
    id: "sales",
    title: "Bán hàng",
    hrefs: ["/customers", "/projects", "/quotes", "/contracts", "/activities", "/surveys", "/calendar", "/mailbox"]
  },
  { id: "ops", title: "Vận hành", hrefs: ["/documents", "/suppliers", "/materials", "/inventory", "/inventory/models"] },
  { id: "analytics", title: "Phân tích & AI", hrefs: ["/reports", "/agents"] },
  { id: "admin", title: "Quản trị", hrefs: ["/users", "/admin"] }
];

/**
 * Groups already-filtered nav items (role/permission filtering stays with the
 * caller). Empty sections are dropped. Items not mapped to a section are kept
 * in a trailing "Khác" section so a new route is never silently hidden.
 */
export function buildNavSections<T extends NavLeaf>(items: readonly T[]): NavSection<T>[] {
  const byHref = new Map(items.map((item) => [item.href, item]));
  const used = new Set<string>();
  const sections: NavSection<T>[] = [];

  for (const def of SECTION_DEFS) {
    const sectionItems = def.hrefs.flatMap((href) => {
      const item = byHref.get(href);
      if (!item) return [];
      used.add(href);
      return [item];
    });
    if (sectionItems.length > 0) {
      sections.push({ id: def.id, title: def.title, items: sectionItems });
    }
  }

  const rest = items.filter((item) => !used.has(item.href));
  if (rest.length > 0) {
    sections.push({ id: "other", title: "Khác", items: [...rest] });
  }

  return sections;
}

/** True when `href` is the best (most specific) match for `pathname`. */
export function isNavItemActive(pathname: string, href: string, allHrefs: readonly string[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !allHrefs.some(
    (other) => other !== href && other.startsWith(`${href}/`) && (pathname === other || pathname.startsWith(`${other}/`))
  );
}

export const NAV_COLLAPSED_STORAGE_KEY = "crm:sidebar:collapsed";

export function parseCollapsedSections(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function toggleCollapsedSection(collapsed: readonly string[], id: string): string[] {
  return collapsed.includes(id) ? collapsed.filter((value) => value !== id) : [...collapsed, id];
}
