"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  readLastSessionActivity,
  recordSessionActivity,
  SESSION_ACTIVITY_EVENT,
  SESSION_LAST_ACTIVITY_KEY
} from "@/lib/session-activity";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS = 60 * 1000;    // warn 1 minute before logout
const THROTTLE_MS = 1_000;              // handle activity at most once per second
const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "mousedown",
  "mousemove",
  "keydown",
  "keyup",
  "input",
  "change",
  "compositionstart",
  "compositionend",
  "touchstart",
  "touchmove",
  "wheel",
  "scroll",
  "click",
  "dragstart",
  "drag",
  "drop",
  "focusin"
] as const;

export function useIdleTimeout(onTimeout: () => void, enabled = true) {
  // Ref keeps onTimeout always current without putting it in any dependency array.
  // This is the standard React pattern for "stable callback that reads latest state".
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningToastIdRef = useRef<string | number | null>(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    function clearTimers() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
        warningRef.current = null;
      }
    }

    function dismissWarning() {
      if (warningToastIdRef.current !== null) {
        toast.dismiss(warningToastIdRef.current);
        warningToastIdRef.current = null;
      }
    }

    function scheduleTimers() {
      clearTimers();
      dismissWarning();

      const lastActivityAt = readLastSessionActivity(lastActivityRef.current);
      lastActivityRef.current = lastActivityAt;
      const elapsedMs = Date.now() - lastActivityAt;
      const warningDelayMs = Math.max(0, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS - elapsedMs);
      const timeoutDelayMs = Math.max(0, IDLE_TIMEOUT_MS - elapsedMs);

      warningRef.current = setTimeout(() => {
        const latestActivityAt = readLastSessionActivity(lastActivityRef.current);
        const latestElapsedMs = Date.now() - latestActivityAt;
        if (latestElapsedMs < IDLE_TIMEOUT_MS - WARNING_BEFORE_MS) {
          scheduleTimers();
          return;
        }

        if (document.hidden) {
          return;
        }

        warningToastIdRef.current = toast.warning("Phiên sắp hết hạn", {
          description: "Phiên của bạn sẽ tự động đăng xuất trong 1 phút do không có hoạt động.",
          duration: 55_000
        });
      }, warningDelayMs);

      timeoutRef.current = setTimeout(() => {
        const latestActivityAt = readLastSessionActivity(lastActivityRef.current);
        const latestElapsedMs = Date.now() - latestActivityAt;

        // Another tab, an iframe focus, or an API request may have refreshed the
        // shared activity timestamp. Never log out while the CRM is active
        // elsewhere in the same browser profile.
        if (latestElapsedMs < IDLE_TIMEOUT_MS) {
          scheduleTimers();
          return;
        }

        clearTimers();
        onTimeoutRef.current();
      }, timeoutDelayMs);
    }

    function resetTimer() {
      lastActivityRef.current = recordSessionActivity("interaction");
      scheduleTimers();
    }

    // Throttle: reset timer at most once per second even if many events fire.
    let lastResetAt = 0;

    function handleActivity() {
      const now = Date.now();
      if (now - lastResetAt < THROTTLE_MS) return;
      lastResetAt = now;
      resetTimer();
    }

    function handleSharedActivity(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail : null;
      const timestamp = typeof detail?.timestamp === "number"
        ? detail.timestamp
        : readLastSessionActivity(lastActivityRef.current);

      if (timestamp >= lastActivityRef.current) {
        lastActivityRef.current = timestamp;
        scheduleTimers();
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== SESSION_LAST_ACTIVITY_KEY) return;
      handleSharedActivity(event);
    }

    function handleVisibilityChange() {
      if (document.hidden) return;
      resetTimer();
    }

    function handleWindowFocus() {
      resetTimer();
    }

    resetTimer();

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { capture: true, passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener(SESSION_ACTIVITY_EVENT, handleSharedActivity);
    window.addEventListener("storage", handleStorage);

    return () => {
      clearTimers();
      dismissWarning();
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity, { capture: true });
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener(SESSION_ACTIVITY_EVENT, handleSharedActivity);
      window.removeEventListener("storage", handleStorage);
    };
  }, [enabled]); // Only re-runs when enabled flips — onTimeout is read via ref above.
}
