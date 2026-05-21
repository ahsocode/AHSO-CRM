"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type {
  DocumentTemplateLayout,
  TemplateBox,
  TemplateValidationIssue
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  PX_PER_MM,
  clampBoxToPage,
  getLocalizedText,
  getValueByPath,
  interpolateTemplateString,
  snapToGrid,
  updateBoxInLayout
} from "./template-editor-utils";

interface TemplateCanvasProps {
  layout: DocumentTemplateLayout;
  sampleData: Record<string, unknown>;
  previewLanguage: "vi" | "viEn";
  selectedBoxId?: string;
  editable: boolean;
  presentationMode?: boolean;
  onSelectBox: (boxId: string) => void;
  onLayoutChange: (layout: DocumentTemplateLayout) => void;
  onOverflowIssuesChange: (issues: TemplateValidationIssue[]) => void;
}

function toVerticalJustify(value?: "top" | "center" | "bottom") {
  switch (value) {
    case "center":
      return "center";
    case "bottom":
      return "flex-end";
    default:
      return "flex-start";
  }
}

function toObjectPosition(
  horizontal?: "left" | "center" | "right" | "justify",
  vertical?: "top" | "center" | "bottom"
) {
  const x =
    horizontal === "center" || horizontal === "justify"
      ? "50%"
      : horizontal === "right"
        ? "100%"
        : "0%";
  const y = vertical === "center" ? "50%" : vertical === "bottom" ? "100%" : "0%";

  return `${x} ${y}`;
}

function boxStyle(box: TemplateBox): CSSProperties {
  return {
    left: `${box.x * PX_PER_MM}px`,
    top: `${box.y * PX_PER_MM}px`,
    width: `${box.width * PX_PER_MM}px`,
    height: `${box.height * PX_PER_MM}px`,
    zIndex: box.zIndex,
    fontSize: box.style?.fontSize ? `${box.style.fontSize}px` : undefined,
    fontWeight: box.style?.fontWeight,
    lineHeight: box.style?.lineHeight,
    textAlign: box.type === "text" || box.type === "key_value_table" ? undefined : box.style?.textAlign,
    color: box.style?.color,
    backgroundColor: box.style?.backgroundColor,
    borderColor: box.style?.borderColor,
    borderWidth: box.style?.borderWidth ? `${box.style.borderWidth}px` : undefined,
    borderStyle: box.style?.borderWidth ? "solid" : undefined,
    borderRadius: box.style?.borderRadius ? `${box.style.borderRadius * PX_PER_MM}px` : undefined,
    padding: box.style?.padding ? `${box.style.padding * PX_PER_MM}px` : undefined
  };
}

function renderBoxContent(
  box: TemplateBox,
  previewLanguage: "vi" | "viEn",
  sampleData: Record<string, unknown>
) {
  if (box.type === "text") {
    return (
      <div
        className="w-full whitespace-pre-wrap break-words"
        style={{
          textAlign: box.style?.textAlign ?? "left"
        }}
      >
        {getLocalizedText(box.content.text, previewLanguage, sampleData)}
      </div>
    );
  }

  if (box.type === "image") {
    const source = interpolateTemplateString(box.content.src, sampleData);
    return source ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source}
        alt={box.content.alt ?? ""}
        className={cn(
          "h-full w-full",
          box.content.fit === "cover" ? "object-cover" : "object-contain"
        )}
        style={{
          objectPosition: toObjectPosition(box.style?.textAlign, box.style?.verticalAlign)
        }}
      />
    ) : (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        Chưa có ảnh
      </div>
    );
  }

  if (box.type === "key_value_table") {
    const valueAlignment = box.style?.textAlign ?? "left";

    return (
      <div
        className="grid h-full content-start gap-1"
        style={{ gridTemplateColumns: `${box.content.labelWidth ?? 30}% 1fr` }}
      >
        {box.content.rows.flatMap((row) => [
          <div key={`${row.id}-label`} className="font-semibold text-text-primary">
            {previewLanguage === "viEn" ? row.label.viEn ?? row.label.vi : row.label.vi}
          </div>,
          <div
            key={`${row.id}-value`}
            className="min-w-0 whitespace-pre-wrap break-words text-text-secondary"
            style={{ textAlign: valueAlignment }}
          >
            {interpolateTemplateString(row.value, sampleData)}
          </div>
        ])}
      </div>
    );
  }

  if (box.type === "line_items_table") {
    const source = getValueByPath(sampleData, box.content.source);
    const items = Array.isArray(source) ? source : [];
    const widthTotal = box.content.columns.reduce((sum, column) => sum + (column.width ?? 1), 0) || 1;

    return (
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          {box.content.columns.map((column) => (
            <col
              key={column.id}
              style={{ width: `${(((column.width ?? 1) / widthTotal) * 100).toFixed(4)}%` }}
            />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-slate-100">
            {box.content.columns.map((column) => (
              <th
                key={column.id}
                className="min-w-0 overflow-hidden break-words border border-slate-300 px-1.5 py-1 font-semibold"
                style={{
                  textAlign: column.align ?? "left"
                }}
              >
                {previewLanguage === "viEn" ? column.label.viEn ?? column.label.vi : column.label.vi}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            items.map((item, index) => (
              <tr key={index}>
                {box.content.columns.map((column) => (
                  <td
                    key={column.id}
                    className="min-w-0 whitespace-pre-wrap break-words border border-slate-300 px-1.5 py-1 align-top"
                    style={{ textAlign: column.align ?? "left" }}
                  >
                    {interpolateTemplateString(column.value, {
                      ...(typeof item === "object" && item !== null
                        ? (item as Record<string, unknown>)
                        : {}),
                      index: index + 1
                    })}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={box.content.columns.length} className="border border-slate-300 px-2 py-2 text-center">
                {previewLanguage === "viEn"
                  ? box.content.emptyText?.viEn ?? box.content.emptyText?.vi ?? "No data"
                  : box.content.emptyText?.vi ?? "Chưa có dữ liệu"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }

  return (
    <div className="grid h-full grid-cols-2 gap-8">
      <div className="flex h-full flex-col items-center justify-start text-center">
        <span className="font-semibold">
          {previewLanguage === "viEn"
            ? box.content.leftTitle.viEn ?? box.content.leftTitle.vi
            : box.content.leftTitle.vi}
        </span>
        <span className="flex-1" />
        <span className="text-xs text-text-muted">
          {box.content.leftCaption
            ? previewLanguage === "viEn"
              ? box.content.leftCaption.viEn ?? box.content.leftCaption.vi
              : box.content.leftCaption.vi
            : ""}
        </span>
      </div>
      <div className="flex h-full flex-col items-center justify-start text-center">
        <span className="font-semibold">
          {previewLanguage === "viEn"
            ? box.content.rightTitle.viEn ?? box.content.rightTitle.vi
            : box.content.rightTitle.vi}
        </span>
        <span className="flex-1" />
        <span className="text-xs text-text-muted">
          {box.content.rightCaption
            ? previewLanguage === "viEn"
              ? box.content.rightCaption.viEn ?? box.content.rightCaption.vi
              : box.content.rightCaption.vi
            : ""}
        </span>
      </div>
    </div>
  );
}

function estimateTextLines(text: string, columnWidthMm: number, fontSize: number) {
  const availableWidthMm = Math.max(6, columnWidthMm - 3.6);
  const averageCharWidthMm = Math.max(1.1, fontSize * 0.3528 * 0.48);
  const charsPerLine = Math.max(4, Math.floor(availableWidthMm / averageCharWidthMm));

  return text
    .split(/\r?\n/)
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

function estimateLineItemsTableHeight(box: Extract<TemplateBox, { type: "line_items_table" }>, sampleData: Record<string, unknown>) {
  const source = getValueByPath(sampleData, box.content.source);
  const items = Array.isArray(source) ? source : [];
  const fontSize = box.style?.fontSize ?? 9;
  const lineHeight = box.style?.lineHeight ?? 1.35;
  const paddingMm = box.style?.padding ?? 2;
  const rowVerticalPaddingMm = 3.2;
  const textLineHeightMm = fontSize * 0.3528 * lineHeight;
  const headerHeightMm = textLineHeightMm + rowVerticalPaddingMm;
  const widthTotal = box.content.columns.reduce((sum, column) => sum + (column.width ?? 1), 0) || 1;
  const rowHeights = items.map((item, index) => {
    const rowContext = {
      ...(typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {}),
      index: index + 1
    };
    const maxLines = box.content.columns.reduce((lineCount, column) => {
      const columnWidthMm = box.width * ((column.width ?? 1) / widthTotal);
      const text = interpolateTemplateString(column.value, rowContext);
      return Math.max(lineCount, estimateTextLines(text, columnWidthMm, fontSize));
    }, 1);

    return maxLines * textLineHeightMm + rowVerticalPaddingMm;
  });

  const bodyHeight = rowHeights.length > 0 ? rowHeights.reduce((sum, height) => sum + height, 0) : headerHeightMm;
  return headerHeightMm + bodyHeight + paddingMm * 2;
}

function applyPresentationFlow(boxes: TemplateBox[], sampleData: Record<string, unknown>) {
  const visibleBoxes = boxes
    .filter((box) => box.visible !== false)
    .sort((left, right) => left.y - right.y || left.x - right.x);
  const offsetByBoxId = new Map<string, number>();
  let accumulatedOffset = 0;

  visibleBoxes.forEach((box) => {
    offsetByBoxId.set(box.id, accumulatedOffset);

    if (box.type !== "line_items_table") {
      return;
    }

    const estimatedHeight = estimateLineItemsTableHeight(box, sampleData);
    const overflow = Math.max(0, estimatedHeight - box.height);
    if (overflow > 0) {
      accumulatedOffset += overflow + 4;
    }
  });

  if (accumulatedOffset === 0) {
    return boxes;
  }

  return boxes.map((box) => {
    const offset = offsetByBoxId.get(box.id) ?? 0;
    return offset > 0 ? { ...box, y: box.y + offset } : box;
  });
}

export function TemplateCanvas({
  layout,
  sampleData,
  previewLanguage,
  selectedBoxId,
  editable,
  presentationMode = false,
  onSelectBox,
  onLayoutChange,
  onOverflowIssuesChange
}: TemplateCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    boxId: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const nextIssues: TemplateValidationIssue[] = [];
      const nodes = rootRef.current?.querySelectorAll<HTMLElement>("[data-box-id]");
      nodes?.forEach((node) => {
        const boxId = node.dataset.boxId;
        if (!boxId) {
          return;
        }

        if (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) {
          nextIssues.push({
            boxId,
            code: "overflow",
            severity: "warning",
            message: `Box "${boxId}" có thể tràn nội dung trên canvas preview.`
          });
        }
      });

      onOverflowIssuesChange(nextIssues);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [layout, onOverflowIssuesChange, previewLanguage, sampleData]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragRef.current) {
        return;
      }

      const { boxId, startClientX, startClientY, startX, startY } = dragRef.current;
      const deltaX = (event.clientX - startClientX) / PX_PER_MM;
      const deltaY = (event.clientY - startClientY) / PX_PER_MM;
      const grid = layout.page.gridMm;

      const nextLayout = updateBoxInLayout(layout, boxId, (box) =>
        clampBoxToPage(layout, {
          ...box,
          x: snapToGrid(startX + deltaX, grid),
          y: snapToGrid(startY + deltaY, grid)
        })
      );

      onLayoutChange(nextLayout);
    };

    const handlePointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [layout, onLayoutChange]);

  return (
    <div
      className={cn(
        "overflow-auto",
        presentationMode
          ? "rounded-[28px] bg-transparent p-0"
          : "rounded-[28px] border border-white/70 bg-slate-100/70 p-5"
      )}
    >
      <div ref={rootRef} className="mx-auto flex w-fit flex-col gap-6">
        {layout.pages.map((page, pageIndex) => (
          <div
            key={page.id}
            className={cn(
              "relative mx-auto overflow-hidden bg-white",
              presentationMode
                ? "rounded-[18px] shadow-[0_18px_45px_rgba(15,23,42,0.16)]"
                : "rounded-[24px] shadow-[0_30px_70px_rgba(15,23,42,0.18)]"
            )}
            style={{
              width: `${layout.page.widthMm * PX_PER_MM}px`,
              minHeight: `${layout.page.heightMm * PX_PER_MM}px`,
              backgroundImage: presentationMode
                ? "none"
                : `
                    linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)
                  `,
              backgroundSize: presentationMode
                ? undefined
                : `${layout.page.gridMm * PX_PER_MM}px ${layout.page.gridMm * PX_PER_MM}px`
            }}
          >
            {!presentationMode ? (
              <>
                <div
                  className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted shadow-sm"
                >
                  Trang {pageIndex + 1}
                </div>
                <div
                  className="absolute border border-dashed border-primary/30"
                  style={{
                    left: `${layout.page.marginMm.left * PX_PER_MM}px`,
                    top: `${layout.page.marginMm.top * PX_PER_MM}px`,
                    width: `${(layout.page.widthMm - layout.page.marginMm.left - layout.page.marginMm.right) * PX_PER_MM}px`,
                    height: `${(layout.page.heightMm - layout.page.marginMm.top - layout.page.marginMm.bottom) * PX_PER_MM}px`
                  }}
                />
              </>
            ) : null}

            {(presentationMode ? applyPresentationFlow(page.boxes, sampleData) : page.boxes)
              .filter((box) => box.visible !== false)
              .sort((left, right) => left.zIndex - right.zIndex)
              .map((box) => {
                const isSelected = selectedBoxId === box.id;
                const commonClassName = cn(
                  "absolute flex overflow-hidden rounded-lg bg-white/90 shadow-sm transition",
                  presentationMode
                    ? "border border-transparent"
                    : isSelected
                      ? "border border-primary ring-2 ring-primary/25"
                      : "border border-slate-300 hover:border-primary/40",
                  editable && !presentationMode ? "cursor-move" : "cursor-default"
                );
                const content = (
                  <>
                    {!presentationMode ? (
                      <span className="pointer-events-none absolute left-2 top-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                        {box.type}
                      </span>
                    ) : null}
                    <div
                      className={cn("h-full w-full overflow-hidden", presentationMode ? "pt-0" : "pt-5")}
                      style={
                        box.type === "text"
                          ? {
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: toVerticalJustify(box.style?.verticalAlign)
                            }
                          : undefined
                      }
                    >
                      {renderBoxContent(box, previewLanguage, sampleData)}
                    </div>
                  </>
                );

                if (presentationMode) {
                  return (
                    <div key={box.id} data-box-id={box.id} className={commonClassName} style={boxStyle(box)}>
                      {content}
                    </div>
                  );
                }

                return (
                  <button
                    key={box.id}
                    type="button"
                    data-box-id={box.id}
                    className={commonClassName}
                    style={boxStyle(box)}
                    onClick={() => onSelectBox(box.id)}
                    onPointerDown={(event) => {
                      if (!editable) {
                        return;
                      }

                      event.preventDefault();
                      onSelectBox(box.id);
                      dragRef.current = {
                        boxId: box.id,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                        startX: box.x,
                        startY: box.y
                      };
                    }}
                  >
                    {content}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
