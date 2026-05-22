"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/shared/app-icon";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import type { QuoteTableColumnWidths } from "@/lib/types";

interface InlinePreviewOverlayProps {
  html: string | null | undefined;
  isLoading: boolean;
  error?: Error | null;
  title?: string;
  quoteColumnResize?: {
    initialWidths?: QuoteTableColumnWidths | null;
    canEdit: boolean;
    isSaving?: boolean;
    onSave: (widths: QuoteTableColumnWidths) => void;
  };
  onClose: () => void;
}

const DEFAULT_QUOTE_TABLE_COLUMN_WIDTHS: QuoteTableColumnWidths = {
  index: 6,
  name: 41,
  description: 23,
  quantity: 6,
  unitPrice: 12,
  total: 12
};

const QUOTE_TABLE_COLUMNS = [
  { key: "index", label: "STT", min: 3, max: 25 },
  { key: "name", label: "Hạng mục", min: 10, max: 75 },
  { key: "description", label: "Mô tả", min: 10, max: 75 },
  { key: "quantity", label: "SL", min: 3, max: 25 },
  { key: "unitPrice", label: "Đơn giá", min: 6, max: 40 },
  { key: "total", label: "Thành tiền", min: 6, max: 40 }
] as const;

function roundColumnWidth(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeQuoteTableWidths(widths?: QuoteTableColumnWidths | null): QuoteTableColumnWidths {
  const next = widths ?? DEFAULT_QUOTE_TABLE_COLUMN_WIDTHS;
  const total = Object.values(next).reduce((sum, value) => sum + Number(value || 0), 0) || 1;

  return {
    index: roundColumnWidth((next.index / total) * 100),
    name: roundColumnWidth((next.name / total) * 100),
    description: roundColumnWidth((next.description / total) * 100),
    quantity: roundColumnWidth((next.quantity / total) * 100),
    unitPrice: roundColumnWidth((next.unitPrice / total) * 100),
    total: roundColumnWidth((next.total / total) * 100)
  };
}

function clampColumnWidth(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function adjustAdjacentColumnWidths(
  widths: QuoteTableColumnWidths,
  columnIndex: number,
  deltaPercent: number
): QuoteTableColumnWidths {
  const leftColumn = QUOTE_TABLE_COLUMNS[columnIndex];
  const rightColumn = QUOTE_TABLE_COLUMNS[columnIndex + 1];
  if (!leftColumn || !rightColumn) {
    return widths;
  }

  const leftWidth = widths[leftColumn.key];
  const rightWidth = widths[rightColumn.key];
  const pairTotal = leftWidth + rightWidth;
  const minLeft = Math.max(leftColumn.min, pairTotal - rightColumn.max);
  const maxLeft = Math.min(leftColumn.max, pairTotal - rightColumn.min);
  const nextLeft = clampColumnWidth(leftWidth + deltaPercent, minLeft, maxLeft);

  return {
    ...widths,
    [leftColumn.key]: roundColumnWidth(nextLeft),
    [rightColumn.key]: roundColumnWidth(pairTotal - nextLeft)
  };
}

function getColumnDividerPosition(widths: QuoteTableColumnWidths, columnIndex: number) {
  return QUOTE_TABLE_COLUMNS.slice(0, columnIndex + 1).reduce(
    (sum, column) => sum + widths[column.key],
    0
  );
}

function areQuoteTableWidthsEqual(left: QuoteTableColumnWidths, right: QuoteTableColumnWidths) {
  return QUOTE_TABLE_COLUMNS.every((column) => Math.abs(left[column.key] - right[column.key]) < 0.05);
}

function removeQuoteResizeLayers(documentRef: Document) {
  documentRef.querySelectorAll("[data-quote-column-resize-layer]").forEach((node) => node.remove());
}

function applyQuoteColumnResizeControls({
  iframe,
  widths,
  canEdit,
  onChange
}: {
  iframe: HTMLIFrameElement;
  widths: QuoteTableColumnWidths;
  canEdit: boolean;
  onChange: (widths: QuoteTableColumnWidths) => void;
}) {
  const documentRef = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!documentRef || !frameWindow) {
    return;
  }

  removeQuoteResizeLayers(documentRef);

  const tables = Array.from(documentRef.querySelectorAll<HTMLTableElement>(".schema-document__table"));
  const lineItemTables = tables.filter((candidate) => candidate.querySelectorAll("colgroup col").length >= 6);
  const table = lineItemTables[0];
  if (!table) {
    return;
  }

  lineItemTables.forEach((lineItemTable) => {
    const columns = Array.from(lineItemTable.querySelectorAll<HTMLTableColElement>("colgroup col")).slice(
      0,
      QUOTE_TABLE_COLUMNS.length
    );
    QUOTE_TABLE_COLUMNS.forEach((column, index) => {
      const tableColumn = columns[index];
      if (tableColumn) {
        tableColumn.style.width = `${widths[column.key].toFixed(4)}%`;
      }
    });
  });

  if (!canEdit) {
    return;
  }

  const box = table.closest<HTMLElement>(".schema-document__box");
  if (!box) {
    return;
  }

  if (frameWindow.getComputedStyle(box).position === "static") {
    box.style.position = "relative";
  }

  const headerHeight = Math.max(32, table.tHead?.getBoundingClientRect().height ?? 38);
  const layer = documentRef.createElement("div");
  layer.dataset.quoteColumnResizeLayer = "true";
  layer.style.position = "absolute";
  layer.style.left = "0";
  layer.style.right = "0";
  layer.style.top = "0";
  layer.style.height = `${headerHeight}px`;
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "9999";

  QUOTE_TABLE_COLUMNS.slice(0, -1).forEach((column, index) => {
    const handle = documentRef.createElement("button");
    handle.type = "button";
    handle.setAttribute("aria-label", `Kéo để chỉnh cột ${column.label}`);
    handle.style.position = "absolute";
    handle.style.top = "0";
    handle.style.left = `${getColumnDividerPosition(widths, index)}%`;
    handle.style.width = "16px";
    handle.style.height = "100%";
    handle.style.transform = "translateX(-50%)";
    handle.style.border = "0";
    handle.style.padding = "0";
    handle.style.background = "transparent";
    handle.style.cursor = "col-resize";
    handle.style.pointerEvents = "auto";

    const indicator = documentRef.createElement("span");
    indicator.style.display = "block";
    indicator.style.width = "4px";
    indicator.style.height = `${Math.max(24, headerHeight - 8)}px`;
    indicator.style.margin = "4px auto";
    indicator.style.borderRadius = "999px";
    indicator.style.background = "rgba(255,255,255,0.9)";
    indicator.style.boxShadow = "0 2px 8px rgba(15,23,42,0.24)";
    handle.appendChild(indicator);

    handle.addEventListener("pointerdown", (event) => {
      const pointerEvent = event as PointerEvent;
      pointerEvent.preventDefault();
      const startClientX = pointerEvent.clientX;
      const startWidths = widths;

      const handleMove = (moveEvent: PointerEvent) => {
        const tableWidthPx = table.getBoundingClientRect().width;
        if (tableWidthPx <= 0) {
          return;
        }

        const deltaPercent = ((moveEvent.clientX - startClientX) / tableWidthPx) * 100;
        onChange(adjustAdjacentColumnWidths(startWidths, index, deltaPercent));
      };

      const handleUp = () => {
        frameWindow.document.body.style.cursor = "";
        frameWindow.document.body.style.userSelect = "";
        frameWindow.removeEventListener("pointermove", handleMove);
        frameWindow.removeEventListener("pointerup", handleUp);
      };

      frameWindow.document.body.style.cursor = "col-resize";
      frameWindow.document.body.style.userSelect = "none";
      frameWindow.addEventListener("pointermove", handleMove);
      frameWindow.addEventListener("pointerup", handleUp);
    });

    layer.appendChild(handle);
  });

  box.appendChild(layer);
}

export function InlinePreviewOverlay({
  html,
  isLoading,
  error,
  title = "Xem trước tài liệu",
  quoteColumnResize,
  onClose,
}: InlinePreviewOverlayProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [draftColumnWidths, setDraftColumnWidths] = useState<QuoteTableColumnWidths>(
    normalizeQuoteTableWidths(quoteColumnResize?.initialWidths)
  );
  const savedColumnWidths = normalizeQuoteTableWidths(quoteColumnResize?.initialWidths);
  const normalizedDraftColumnWidths = normalizeQuoteTableWidths(draftColumnWidths);
  const hasUnsavedColumnWidths = quoteColumnResize
    ? !areQuoteTableWidthsEqual(normalizedDraftColumnWidths, savedColumnWidths)
    : false;

  useEffect(() => {
    setDraftColumnWidths(normalizeQuoteTableWidths(quoteColumnResize?.initialWidths));
  }, [quoteColumnResize?.initialWidths]);

  useEffect(() => {
    if (!quoteColumnResize || isLoading || error || !html) {
      return undefined;
    }

    const currentIframe = iframeRef.current;
    const frame = window.requestAnimationFrame(() => {
      if (!currentIframe) {
        return;
      }

      applyQuoteColumnResizeControls({
        iframe: currentIframe,
        widths: normalizedDraftColumnWidths,
        canEdit: quoteColumnResize.canEdit && !quoteColumnResize.isSaving,
        onChange: setDraftColumnWidths
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      const documentRef = currentIframe?.contentDocument;
      if (documentRef) {
        removeQuoteResizeLayers(documentRef);
      }
    };
  }, [
    error,
    html,
    isLoading,
    normalizedDraftColumnWidths,
    quoteColumnResize,
    quoteColumnResize?.canEdit,
    quoteColumnResize?.isSaving
  ]);

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
            {quoteColumnResize ? (
              <>
                <span className="hidden rounded-full bg-bg-hover px-3 py-1 text-xs font-semibold text-text-secondary md:inline-flex">
                  {quoteColumnResize.canEdit
                    ? hasUnsavedColumnWidths
                      ? "Chưa lưu độ rộng"
                      : "Kéo vạch cột để chỉnh"
                    : "Bản đã khóa layout"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!quoteColumnResize.canEdit || quoteColumnResize.isSaving}
                  onClick={() => setDraftColumnWidths(savedColumnWidths)}
                >
                  Hủy chỉnh cột
                </Button>
                <Button
                  size="sm"
                  disabled={
                    !quoteColumnResize.canEdit ||
                    !hasUnsavedColumnWidths ||
                    quoteColumnResize.isSaving
                  }
                  onClick={() => quoteColumnResize.onSave(normalizedDraftColumnWidths)}
                >
                  {quoteColumnResize.isSaving ? "Đang lưu..." : "Lưu độ rộng"}
                </Button>
              </>
            ) : null}
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
              onLoad={() => {
                if (!quoteColumnResize || !html) {
                  return;
                }

                const iframe = iframeRef.current;
                if (!iframe) {
                  return;
                }

                applyQuoteColumnResizeControls({
                  iframe,
                  widths: normalizedDraftColumnWidths,
                  canEdit: quoteColumnResize.canEdit && !quoteColumnResize.isSaving,
                  onChange: setDraftColumnWidths
                });
              }}
              sandbox="allow-same-origin allow-popups allow-modals"
              className="h-full w-full bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}
