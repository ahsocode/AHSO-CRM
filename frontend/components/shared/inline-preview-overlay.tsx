"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/shared/app-icon";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";

interface InlinePreviewOverlayProps {
  html: string | null | undefined;
  isLoading: boolean;
  error?: Error | null;
  title?: string;
  onClose: () => void;
}

export function InlinePreviewOverlay({
  html,
  isLoading,
  error,
  title = "Xem trước tài liệu",
  onClose,
}: InlinePreviewOverlayProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col px-4 py-4 md:py-6">
        {/* Toolbar */}
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/20 bg-white/95 px-5 py-3 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <AppIcon name="preview" className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-text-primary">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => iframeRef.current?.contentWindow?.print()}
              disabled={!html}
            >
              <AppIcon name="description" className="mr-1.5 h-3.5 w-3.5" />
              In / Lưu PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <AppIcon name="close" className="h-4 w-4" />
              Đóng
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden rounded-2xl border border-white/30 bg-white shadow-xl">
          {isLoading ? (
            <LoadingSkeleton className="h-full w-full rounded-none" />
          ) : error ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <AppIcon name="warning" className="mx-auto h-10 w-10 text-danger" />
                <p className="mt-3 text-sm font-medium text-text-primary">Không thể tải xem trước</p>
                <p className="mt-1 text-xs text-text-secondary">{error.message}</p>
              </div>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              title="document-preview"
              srcDoc={html ?? ""}
              sandbox="allow-same-origin allow-popups"
              className="h-full w-full bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}
