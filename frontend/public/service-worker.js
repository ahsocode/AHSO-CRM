// Cache version — bump this string whenever you want to force clients to purge old caches.
const SHELL_CACHE = "ahso-crm-shell-v3";

// Pre-cache the web app manifest and offline fallback. Static JS/CSS chunks are cached on-demand below.
const PRECACHE_ASSETS = ["/manifest.json", "/offline.html"];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS)));
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Non-GET requests always bypass the service worker.
  if (request.method !== "GET") {
    return;
  }

  // API calls (/api/*) must NEVER be served from cache — always hit the network.
  // This applies both when the API is on a separate origin and when Nginx proxies
  // /api/* on the same domain (production at crm.ahso.vn).
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // For same-origin requests: cache only immutable static assets from Next.js.
  // HTML pages and other dynamic routes are NOT cached — they always go to network.
  if (url.origin === self.location.origin) {
    const isImmutableAsset =
      url.pathname.startsWith("/_next/static/") ||
      /\.(woff2?|ttf|eot|otf)(\?.*)?$/.test(url.pathname);

    if (isImmutableAsset) {
      event.respondWith(
        caches.match(request).then((hit) => {
          if (hit) return hit;
          return fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              void caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          });
        })
      );
    }

    // Navigation requests (HTML pages): try network, fall back to offline page.
    if (request.mode === "navigate") {
      event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
      return;
    }

    // All other same-origin requests (JSON, etc.) — pass through to network.
    return;
  }
});

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "AHSO CRM";
  const options = {
    body: data.body || "Có cập nhật mới trong hệ thống.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { link: data.link || "/dashboard" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
      return undefined;
    })
  );
});
