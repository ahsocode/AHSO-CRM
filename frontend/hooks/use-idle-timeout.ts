"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS = 60 * 1000;    // warn 1 minute before logout
const THROTTLE_MS = 1_000;              // handle activity at most once per second
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

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

    function resetTimer() {
      lastActivityRef.current = Date.now();
      clearTimers();

      if (warningToastIdRef.current !== null) {
        toast.dismiss(warningToastIdRef.current);
        warningToastIdRef.current = null;
      }

      warningRef.current = setTimeout(() => {
        warningToastIdRef.current = toast.warning("Phiên sắp hết hạn", {
          description: "Phiên của bạn sẽ tự động đăng xuất trong 1 phút do không có hoạt động.",
          duration: 55_000
        });
      }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

      timeoutRef.current = setTimeout(() => {
        onTimeoutRef.current();
      }, IDLE_TIMEOUT_MS);
    }

    // Throttle: reset timer at most once per second even if many events fire.
    let lastResetAt = Date.now();

    function handleActivity() {
      const now = Date.now();
      if (now - lastResetAt < THROTTLE_MS) return;
      lastResetAt = now;
      resetTimer();
    }

    // Handles browser sleep / minimized tab: when the tab becomes visible again,
    // check whether 15 minutes have already elapsed and logout immediately.
    function handleVisibilityChange() {
      if (document.hidden) return;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        clearTimers();
        onTimeoutRef.current();
      }
    }

    resetTimer();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled]); // Only re-runs when enabled flips — onTimeout is read via ref above.
}
