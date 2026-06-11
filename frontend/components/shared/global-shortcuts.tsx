"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";

const SEQUENCE_TIMEOUT_MS = 900;

const GO_TO_ROUTES: Record<string, { href: Route; label: string }> = {
  d: { href: "/dashboard", label: "Dashboard" },
  k: { href: "/customers", label: "Khách hàng" },
  p: { href: "/projects", label: "Dự án" },
  b: { href: "/quotes", label: "Báo giá" },
  h: { href: "/contracts", label: "Hợp đồng" },
  a: { href: "/activities", label: "Hoạt động" },
  l: { href: "/calendar", label: "Lịch" },
  r: { href: "/reports", label: "Báo cáo" }
};

const CREATE_ROUTES: Array<{ prefix: string; href: Route; label: string }> = [
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

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((key) => (
        <kbd key={key} className="min-w-7 rounded-md bg-bg-hover px-2 py-1 text-center text-xs font-semibold text-text-primary">
          {key}
        </kbd>
      ))}
    </span>
  );
}

export function GlobalShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [showHelp, setShowHelp] = useState(false);
  const sequenceRef = useRef<{ key: string; timer: number | null }>({
    key: "",
    timer: null
  });

  const createTarget = useMemo(() => {
    return CREATE_ROUTES.find((route) => pathname.startsWith(route.prefix)) ?? CREATE_ROUTES[0];
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (sequenceRef.current.timer) {
        window.clearTimeout(sequenceRef.current.timer);
      }
    };
  }, []);

  useEffect(() => {
    const resetSequence = () => {
      if (sequenceRef.current.timer) {
        window.clearTimeout(sequenceRef.current.timer);
      }
      sequenceRef.current = { key: "", timer: null };
    };

    const startSequence = (key: string) => {
      resetSequence();
      sequenceRef.current = {
        key,
        timer: window.setTimeout(resetSequence, SEQUENCE_TIMEOUT_MS)
      };
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        setShowHelp(false);
        resetSequence();
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setShowHelp((current) => !current);
        resetSequence();
        return;
      }

      const key = event.key.toLowerCase();

      if (sequenceRef.current.key === "g") {
        const target = GO_TO_ROUTES[key];
        resetSequence();

        if (target) {
          event.preventDefault();
          router.push(target.href);
        }
        return;
      }

      if (key === "g") {
        event.preventDefault();
        startSequence("g");
        return;
      }

      if (key === "c" && createTarget) {
        event.preventDefault();
        router.push(createTarget.href);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      resetSequence();
    };
  }, [createTarget, router]);

  if (!showHelp) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-center bg-slate-900/35 px-4 pt-[14vh] backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-white/70 bg-white shadow-[0_30px_80px_rgba(21,67,96,0.2)]">
        <div className="flex items-center justify-between gap-3 bg-bg-subtle px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <AppIcon name="keyboard" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Phím tắt</h2>
              <p className="text-xs text-text-secondary">Điều hướng và tạo mới nhanh trong workspace.</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowHelp(false)}>
            Esc
          </Button>
        </div>

        <div className="space-y-5 p-5">
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Tạo mới</p>
            <div className="flex items-center justify-between gap-4 rounded-lg bg-bg-hover/50 px-4 py-3">
              <span className="text-sm font-medium text-text-primary">Tạo {createTarget?.label.toLowerCase() ?? "bản ghi"} theo ngữ cảnh</span>
              <ShortcutKeys keys={["c"]} />
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Điều hướng</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(GO_TO_ROUTES).map(([key, item]) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-lg bg-bg-hover/50 px-4 py-3">
                  <span className="text-sm font-medium text-text-primary">{item.label}</span>
                  <ShortcutKeys keys={["g", key]} />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Tìm kiếm</p>
            <div className="flex items-center justify-between gap-4 rounded-lg bg-bg-hover/50 px-4 py-3">
              <span className="text-sm font-medium text-text-primary">Command palette</span>
              <ShortcutKeys keys={["⌘", "K"]} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
