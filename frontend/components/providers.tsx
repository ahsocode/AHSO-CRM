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
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false
          },
          mutations: {
            retry: 1
          }
        }
      })
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
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
