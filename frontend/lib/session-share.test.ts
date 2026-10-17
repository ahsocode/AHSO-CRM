import { BroadcastChannel as NodeBroadcastChannel } from "node:worker_threads";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY, SESSION_ID_KEY } from "./constants";

/**
 * Regression: opening the CRM in a new tab (empty per-tab sessionStorage)
 * used to call logout(), revoking the session server-side for ALL tabs.
 * The new tab must first ask already-open tabs for their session.
 */
describe("requestSessionFromOtherTabs", () => {
  let otherTab: NodeBroadcastChannel;

  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
    // jsdom has no BroadcastChannel; Node's implementation is same-process.
    Object.defineProperty(window, "BroadcastChannel", {
      value: NodeBroadcastChannel,
      configurable: true,
      writable: true
    });
    otherTab = new NodeBroadcastChannel("ahso-crm-session");
  });

  afterEach(() => {
    otherTab.close();
  });

  it("adopts the token and session id shared by an open tab", async () => {
    otherTab.onmessage = (event: unknown) => {
      const data = (event as { data: { type: string; requestId: string } }).data;
      if (data.type === "SESSION_REQUEST") {
        otherTab.postMessage({
          type: "SESSION_SHARE",
          requestId: data.requestId,
          accessToken: "shared-token",
          sessionId: "session-1"
        });
      }
    };

    const { requestSessionFromOtherTabs } = await import("./api-client");
    await expect(requestSessionFromOtherTabs(500)).resolves.toBe(true);
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe("shared-token");
    expect(window.sessionStorage.getItem(SESSION_ID_KEY)).toBe("session-1");
  });

  it("resolves false when no other tab answers (genuinely new browser session)", async () => {
    const { requestSessionFromOtherTabs } = await import("./api-client");
    await expect(requestSessionFromOtherTabs(100)).resolves.toBe(false);
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it("ignores shares that answer a different request", async () => {
    otherTab.onmessage = (event: unknown) => {
      const data = (event as { data: { type: string } }).data;
      if (data.type === "SESSION_REQUEST") {
        otherTab.postMessage({ type: "SESSION_SHARE", requestId: "someone-else", accessToken: "foreign" });
      }
    };

    const { requestSessionFromOtherTabs } = await import("./api-client");
    await expect(requestSessionFromOtherTabs(150)).resolves.toBe(false);
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it("an open tab answers requests with its own session", async () => {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, "my-token");
    window.sessionStorage.setItem(SESSION_ID_KEY, "my-session");
    await import("./api-client"); // registers this tab's channel listener

    const reply = new Promise<unknown>((resolve) => {
      otherTab.onmessage = (event: unknown) => resolve((event as { data: unknown }).data);
    });
    otherTab.postMessage({ type: "SESSION_REQUEST", requestId: "req-1" });

    await expect(reply).resolves.toEqual({
      type: "SESSION_SHARE",
      requestId: "req-1",
      accessToken: "my-token",
      sessionId: "my-session"
    });
  });
});
