"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SonnerToaster } from "./ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            retry: 1,
            refetchOnWindowFocus: true,
            refetchOnMount: true
          },
          mutations: {
            retry: 0
          }
        }
      })
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

    if (isLocalhost) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(() => ("caches" in window ? caches.keys() : Promise.resolve([])))
        .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
        .catch(() => {
          // Local cleanup is best-effort; the app must still render if browser APIs reject.
        });
      return;
    }

    void navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Ignore service worker registration errors in unsupported or restricted environments.
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <SonnerToaster />
    </QueryClientProvider>
  );
}
