"use client";

import Link from "next/link";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function DocumentPreviewClient({
  type,
  entityId,
  lang,
  templateVariantId,
}: {
  type?: string;
  entityId?: string;
  lang?: string;
  templateVariantId?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isReady = Boolean(type && entityId);
  const language = lang ?? "vi";

  const previewQuery = useQuery({
    queryKey: ["documents", "preview-page", type, entityId, language, templateVariantId],
    enabled: isReady,
    queryFn: async () => {
      const response = await apiClient.get<string>(`/documents/${type}/${entityId}/preview`, {
        params: { lang: language, templateVariantId },
        responseType: "text",
      });
      return response.data;
    },
  });

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/90 px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
              Document Preview
            </p>
            <h1 className="text-2xl font-bold text-text-primary">Xem trước tài liệu</h1>
            <p className="text-sm text-text-secondary">
              Preview HTML được tải qua session hiện tại để giữ đúng quyền truy cập.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => iframeRef.current?.contentWindow?.print()} disabled={!previewQuery.data}>
              In / Lưu PDF
            </Button>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }))}>
              Về dashboard
            </Link>
          </div>
        </div>

        {!isReady ? (
          <EmptyState
            title="Thiếu tham số preview"
            description="Cần có loại tài liệu và entityId để dựng bản xem trước."
          />
        ) : previewQuery.isLoading ? (
          <LoadingSkeleton className="h-[75vh] w-full rounded-[32px]" />
        ) : previewQuery.error ? (
          <EmptyState
            title="Không thể tải preview tài liệu"
            description={getApiErrorMessage(previewQuery.error)}
          />
        ) : (
          <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <iframe
              ref={iframeRef}
              title="document-preview"
              srcDoc={previewQuery.data}
              className="h-[calc(100vh-180px)] w-full bg-white"
            />
          </div>
        )}
      </div>
    </main>
  );
}
