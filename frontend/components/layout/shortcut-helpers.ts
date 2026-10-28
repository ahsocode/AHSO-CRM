// Pure helpers for global keyboard shortcuts (g-then-key navigation, n = create).

export const GO_TO_ROUTES: Record<string, { href: string; label: string }> = {
  d: { href: "/dashboard", label: "Dashboard" },
  p: { href: "/projects", label: "Dự án" },
  q: { href: "/quotes", label: "Báo giá" },
  c: { href: "/customers", label: "Khách hàng" },
  // Giữ các phím tắt cũ
  k: { href: "/customers", label: "Khách hàng" },
  b: { href: "/quotes", label: "Báo giá" },
  h: { href: "/contracts", label: "Hợp đồng" },
  a: { href: "/activities", label: "Hoạt động" },
  l: { href: "/calendar", label: "Lịch" },
  r: { href: "/reports", label: "Báo cáo" }
};

export const CREATE_ROUTES: Array<{ prefix: string; href: string; label: string }> = [
  { prefix: "/customers", href: "/customers/new", label: "Khách hàng" },
  { prefix: "/projects", href: "/projects/new", label: "Dự án" },
  { prefix: "/quotes", href: "/quotes/new", label: "Báo giá" },
  { prefix: "/contracts", href: "/contracts/new", label: "Hợp đồng" },
  { prefix: "/activities", href: "/activities/new", label: "Hoạt động" },
  { prefix: "/surveys", href: "/surveys/new", label: "Khảo sát" },
  { prefix: "/materials", href: "/materials/new", label: "Vật tư" },
  { prefix: "/suppliers", href: "/suppliers/new", label: "Nhà cung cấp" },
  { prefix: "/inventory/receipts", href: "/inventory/receipts/new", label: "Phiếu nhập" },
  { prefix: "/inventory/issues", href: "/inventory/issues/new", label: "Phiếu xuất" },
  { prefix: "/inventory/transfers", href: "/inventory/transfers/new", label: "Phiếu chuyển" },
  { prefix: "/inventory/counts", href: "/inventory/counts/new", label: "Phiếu kiểm kê" },
  { prefix: "/inventory/warehouses", href: "/inventory/warehouses/new", label: "Kho" }
];

export interface ShortcutKeyEvent {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  defaultPrevented?: boolean;
}

export interface ShortcutTarget {
  tagName?: string;
  isContentEditable?: boolean;
  /** true when the element sits inside a contenteditable="true" ancestor */
  insideContentEditable?: boolean;
}

export function isTypingTarget(target: ShortcutTarget | null | undefined): boolean {
  if (!target) return false;
  const tag = (target.tagName ?? "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target.isContentEditable) || Boolean(target.insideContentEditable);
}

/** Shortcuts are ignored with modifier keys, when already handled, or while typing. */
export function shouldIgnoreShortcut(event: ShortcutKeyEvent, target: ShortcutTarget | null | undefined): boolean {
  return Boolean(event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(target));
}

export function resolveGoTo(key: string): { href: string; label: string } | null {
  return GO_TO_ROUTES[key.toLowerCase()] ?? null;
}

/** Create route for the current section, or null when the section has none (no fallback). */
export function resolveCreateRoute(pathname: string): { href: string; label: string } | null {
  // Longest prefix first so /inventory/receipts wins over a shorter match.
  const match = [...CREATE_ROUTES]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`));
  if (!match || pathname === match.href) return null;
  return { href: match.href, label: match.label };
}
