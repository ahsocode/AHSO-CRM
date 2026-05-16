"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { SonnerToaster } from "./ui/sonner";

function getErrorStatus(error: Error): number | undefined {
  const maybeStatusError = error as Error & {
    status?: number;
    response?: {
      status?: number;
    };
  };

  return maybeStatusError.status ?? maybeStatusError.response?.status;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            retry: (failureCount, error) => {
              if (typeof window !== "undefined" && !window.navigator.onLine) {
                return false;
              }

              if (error instanceof Error) {
                const status = getErrorStatus(error);
                if (status && status >= 400 && status < 500) {
                  return false;
                }
              }

              return failureCount < 2;
            },
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

    void navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => {
      // Ignore service worker registration errors in unsupported or restricted environments.
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOffline = () => {
      toast({
        title: "Mất kết nối internet",
        description: "AHSO CRM sẽ dùng dữ liệu đã tải khi có thể."
      });
    };

    const handleOnline = () => {
      toast("Đã kết nối lại internet.");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <SonnerToaster />
    </QueryClientProvider>
  );
}
