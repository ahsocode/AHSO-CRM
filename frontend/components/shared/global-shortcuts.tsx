"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { GO_TO_ROUTES, resolveCreateRoute, resolveGoTo, shouldIgnoreShortcut } from "@/components/layout/shortcut-helpers";

const SEQUENCE_TIMEOUT_MS = 900;

const GO_TO_ENTRIES = Object.entries(GO_TO_ROUTES);

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

  const createTarget = useMemo(() => resolveCreateRoute(pathname), [pathname]);

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
      const el = event.target instanceof HTMLElement ? event.target : null;
      if (
        shouldIgnoreShortcut(event, el && {
          tagName: el.tagName,
          isContentEditable: el.isContentEditable,
          insideContentEditable: Boolean(el.closest("[contenteditable='true']"))
        })
      ) {
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
        const target = resolveGoTo(key);
        resetSequence();

        if (target) {
          event.preventDefault();
          router.push(target.href as Route);
        }
        return;
      }

      if (key === "g") {
        event.preventDefault();
        startSequence("g");
        return;
      }

      if ((key === "n" || key === "c") && createTarget) {
        event.preventDefault();
        router.push(createTarget.href as Route);
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
              <p className="text-xs text-text-secondary">Điều hướng và tạo mới nhanh trong hệ thống.</p>
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
              <span className="text-sm font-medium text-text-primary">{createTarget ? `Tạo ${createTarget.label.toLowerCase()} mới` : "Tạo mới (chỉ ở trang có chức năng tạo)"}</span>
              <ShortcutKeys keys={["n"]} />
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Điều hướng</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {GO_TO_ENTRIES.map(([key, item]) => (
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
