"use client";

export const SESSION_ACTIVITY_EVENT = "ahso:session-activity";
export const SESSION_LAST_ACTIVITY_KEY = "ahso_last_activity_at";

interface SessionActivityDetail {
  source: "api" | "interaction" | "sync";
  timestamp: number;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function safeLocalStorage() {
  if (!isBrowser()) return null;

  try {
    window.localStorage.getItem("__test__");
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLastSessionActivity(fallback = Date.now()) {
  const raw = safeLocalStorage()?.getItem(SESSION_LAST_ACTIVITY_KEY);
  if (!raw) return fallback;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function recordSessionActivity(source: SessionActivityDetail["source"] = "interaction") {
  if (!isBrowser()) return Date.now();

  const timestamp = Date.now();
  safeLocalStorage()?.setItem(SESSION_LAST_ACTIVITY_KEY, String(timestamp));

  window.dispatchEvent(
    new CustomEvent<SessionActivityDetail>(SESSION_ACTIVITY_EVENT, {
      detail: {
        source,
        timestamp
      }
    })
  );

  return timestamp;
}
