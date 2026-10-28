"use client";

import { useCallback, useEffect, useRef } from "react";

export const UNSAVED_CHANGES_MESSAGE = "Bạn có thay đổi chưa lưu. Rời khỏi trang sẽ mất các thay đổi này.";

export interface UnsavedChangesGuardOptions {
  message?: string;
  /**
   * Also intercept browser Back/Forward. Best-effort only (see limits); default false.
   */
  interceptHistory?: boolean;
}

/**
 * Warns before losing unsaved form changes. No-op when `isDirty` is false.
 *
 * What it covers:
 *  - beforeunload: tab close, reload, typing a new URL, external links (native browser prompt;
 *    custom text is ignored by browsers).
 *  - In-app navigation: a capturing document click handler asks `window.confirm` for same-origin
 *    <a>/<Link> clicks that change the URL.
 *  - Optional `interceptHistory`: Back/Forward via a sentinel history entry.
 *
 * Limits (Next.js App Router has no route-change events or `router.events`):
 *  - Programmatic `router.push/replace/back()` are NOT intercepted; call `confirmLeave()` yourself
 *    before them, or `allowNextNavigation()` after a successful save to skip the prompt.
 *  - Back/Forward interception is best-effort: the URL may change briefly before being restored.
 *  - Keyboard/modified clicks (Ctrl/Cmd/Shift, middle-click), target=_blank, download links are ignored.
 *
 * After a successful submit RHF's `isDirty` stays true until `reset(values)`: call
 * `allowNextNavigation()` (or reset the form) BEFORE `router.push(...)`.
 */
export function useUnsavedChangesGuard(isDirty: boolean, options: UnsavedChangesGuardOptions = {}) {
  const { message = UNSAVED_CHANGES_MESSAGE, interceptHistory = false } = options;
  const dirtyRef = useRef(isDirty);
  const allowRef = useRef(false);
  const messageRef = useRef(message);
  dirtyRef.current = isDirty;
  messageRef.current = message;

  // A new edit re-arms the guard.
  useEffect(() => {
    if (isDirty) allowRef.current = false;
  }, [isDirty]);

  const active = useCallback(() => dirtyRef.current && !allowRef.current, []);

  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!active()) return;
      e.preventDefault();
      e.returnValue = "";
    };

    const onClick = (e: MouseEvent) => {
      if (!active() || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return; // beforeunload handles external links
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // hash / same page
      if (!window.confirm(messageRef.current)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onPopState = () => {
      if (!active()) return;
      if (!window.confirm(messageRef.current)) {
        window.history.pushState(null, "", window.location.href);
      } else {
        allowRef.current = true;
        window.history.back();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    if (interceptHistory) {
      window.history.pushState(null, "", window.location.href);
      window.addEventListener("popstate", onPopState);
    }
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      if (interceptHistory) window.removeEventListener("popstate", onPopState);
    };
  }, [isDirty, interceptHistory, active]);

  /** Returns true when it is OK to leave (not dirty, already allowed, or user confirmed). */
  const confirmLeave = useCallback(() => {
    if (!active()) return true;
    return window.confirm(messageRef.current);
  }, [active]);

  /** Disable the guard until the form becomes dirty again (call right after a successful save). */
  const allowNextNavigation = useCallback(() => {
    allowRef.current = true;
  }, []);

  return { confirmLeave, allowNextNavigation };
}
