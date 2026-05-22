"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
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

interface RenderablePage {
  id: string;
  boxes: TemplateBox[];
}

interface FlowFragment {
  box: TemplateBox;
  height: number;
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
    const columnPercents = getLineItemColumnPercents(box, sampleData);

    return (
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          {box.content.columns.map((column) => (
            <col
              key={column.id}
              style={{ width: `${(columnPercents[box.content.columns.indexOf(column)] ?? 1).toFixed(4)}%` }}
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

type LineItemColumnRole = "index" | "name" | "description" | "quantity" | "unitPrice" | "total" | "other";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getLineItemColumnRole(column: Extract<TemplateBox, { type: "line_items_table" }>["content"]["columns"][number]): LineItemColumnRole {
  const label = `${column.label.vi} ${column.label.viEn ?? ""}`;
  const text = normalizeText(`${column.id} ${column.value} ${label}`);

  if (text.includes("index") || text.includes("stt") || text.includes("no.") || text.includes("{{index")) {
    return "index";
  }
  if (text.includes("unitprice") || text.includes("unit-price") || text.includes("don gia") || text.includes("price")) {
    return "unitPrice";
  }
  if (text.includes("total") || text.includes("amount") || text.includes("thanh tien")) {
    return "total";
  }
  if (text.includes("quantity") || text.includes("qty") || text.includes(" so luong") || text.includes(" sl")) {
    return "quantity";
  }
  if (text.includes("description") || text.includes("mo ta") || text.includes("desc")) {
    return "description";
  }
  if (text.includes("name") || text.includes("hang muc") || text.includes("item")) {
    return "name";
  }

  return "other";
}

function getLineItemColumnPercents(
  box: Extract<TemplateBox, { type: "line_items_table" }>,
  sampleData?: Record<string, unknown>
) {
  const roles = box.content.columns.map((column) => getLineItemColumnRole(column));
  const roleSet = new Set(roles);
  const isStandardCommercialTable =
    roleSet.has("index") &&
    roleSet.has("name") &&
    roleSet.has("quantity") &&
    roleSet.has("unitPrice") &&
    roleSet.has("total");

  const quoteOverrides = getQuoteTableColumnWidthOverrides(sampleData);
  if (!isStandardCommercialTable && !quoteOverrides) {
    const raw = box.content.columns.map((column) => Math.max(1, column.width ?? 1));
    const total = raw.reduce((sum, value) => sum + value, 0) || 1;
    return raw.map((value) => (value / total) * 100);
  }

  const weights: Record<LineItemColumnRole, number> = roleSet.has("description")
    ? { index: 6, name: 41, description: 23, quantity: 6, unitPrice: 12, total: 12, other: 8 }
    : { index: 6, name: 50, description: 0, quantity: 7, unitPrice: 18, total: 19, other: 8 };
  const raw = roles.map((role, index) => {
    const column = box.content.columns[index];
    const exactOverride = column ? quoteOverrides?.[column.id] : undefined;
    const roleOverride = quoteOverrides?.[role];
    return exactOverride ?? roleOverride ?? weights[role] ?? weights.other;
  });
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;

  return raw.map((value) => (value / total) * 100);
}

function getQuoteTableColumnWidthOverrides(sampleData?: Record<string, unknown>) {
  const raw = sampleData
    ? getValueByPath(sampleData, "quote.tableColumnWidths") ?? getValueByPath(sampleData, "tableColumnWidths")
    : undefined;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }

  return Object.entries(raw as Record<string, unknown>).reduce<Record<string, number>>((result, [key, value]) => {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      result[key] = numericValue;
    }
    return result;
  }, {});
}

function estimateTextLines(text: string, columnWidthMm: number, fontSize: number) {
  const availableWidthMm = Math.max(6, columnWidthMm - 3.6);
  const averageCharWidthMm = Math.max(1.1, fontSize * 0.3528 * 0.48);
  const charsPerLine = Math.max(4, Math.floor(availableWidthMm / averageCharWidthMm));

  return text
    .split(/\r?\n/)
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

function getMaxContentHeight(layout: DocumentTemplateLayout) {
  return layout.page.heightMm - layout.page.marginMm.top - layout.page.marginMm.bottom - 18;
}

function groupBoxesForFlow(boxes: TemplateBox[]) {
  const sorted = [...boxes].sort((left, right) => left.y - right.y || left.x - right.x);
  const groups: Array<{ y: number; bottom: number; boxes: TemplateBox[] }> = [];

  sorted.forEach((box) => {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && (box.y <= lastGroup.bottom - 2 || Math.abs(box.y - lastGroup.y) <= 4)) {
      lastGroup.boxes.push(box);
      lastGroup.bottom = Math.max(lastGroup.bottom, box.y + box.height);
      return;
    }

    groups.push({
      y: box.y,
      bottom: box.y + box.height,
      boxes: [box]
    });
  });

  return groups;
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function setFlowValue(data: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split(".");
  let current = data;
  segments.slice(0, -1).forEach((segment) => {
    if (typeof current[segment] !== "object" || current[segment] === null) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  });
  current[segments[segments.length - 1]] = value;
}

function createTextFragments(
  box: Extract<TemplateBox, { type: "text" }>,
  sampleData: Record<string, unknown>,
  previewLanguage: "vi" | "viEn",
  layout: DocumentTemplateLayout
): FlowFragment[] {
  const text = getLocalizedText(box.content.text, previewLanguage, sampleData);
  const fontSize = box.style?.fontSize ?? 10;
  const lineHeight = box.style?.lineHeight ?? 1.35;
  const padding = box.style?.padding ?? 0;
  const lineHeightMm = fontSize * 0.3528 * lineHeight;
  const maxChunkHeight = Math.min(Math.max(box.height, 80), getMaxContentHeight(layout));
  const maxLinesPerChunk = Math.max(1, Math.floor((maxChunkHeight - padding * 2) / lineHeightMm));
  const lines = wrapText(text, box.width, fontSize);
  const chunks = chunkArray(lines.length > 0 ? lines : [""], maxLinesPerChunk);

  return chunks.map((chunk, index) => ({
    box: {
      ...box,
      id: index === 0 ? box.id : `${box.id}__flow_text_${index + 1}`,
      content: { text: { vi: chunk.join("\n") } }
    },
    height: Math.max(box.height, chunk.length * lineHeightMm + padding * 2)
  }));
}

function createKeyValueFragments(
  box: Extract<TemplateBox, { type: "key_value_table" }>,
  sampleData: Record<string, unknown>,
  layout: DocumentTemplateLayout
): FlowFragment[] {
  const fontSize = box.style?.fontSize ?? 9.5;
  const lineHeight = box.style?.lineHeight ?? 1.35;
  const padding = box.style?.padding ?? 0;
  const lineHeightMm = fontSize * 0.3528 * lineHeight;
  const maxChunkHeight = Math.min(Math.max(box.height, 80), getMaxContentHeight(layout));
  const labelWidth = box.width * ((box.content.labelWidth ?? 30) / 100);
  const valueWidth = box.width - labelWidth - 2;
  const chunks: typeof box.content.rows[] = [];
  let currentRows: typeof box.content.rows = [];
  let currentHeight = padding * 2;

  box.content.rows.forEach((row) => {
    const labelLines = estimateTextLines(row.label.vi, labelWidth, fontSize);
    const value = interpolateTemplateString(row.value, sampleData);
    const valueLines = estimateTextLines(value, valueWidth, fontSize);
    const rowHeight = Math.max(labelLines, valueLines, 1) * lineHeightMm + 2;

    if (currentRows.length > 0 && currentHeight + rowHeight > maxChunkHeight) {
      chunks.push(currentRows);
      currentRows = [];
      currentHeight = padding * 2;
    }

    currentRows.push(row);
    currentHeight += rowHeight;
  });

  if (currentRows.length > 0 || chunks.length === 0) {
    chunks.push(currentRows);
  }

  return chunks.map((rows, index) => ({
    box: {
      ...box,
      id: index === 0 ? box.id : `${box.id}__flow_kv_${index + 1}`,
      content: { ...box.content, rows }
    },
    height: Math.max(
      Math.min(box.height, maxChunkHeight),
      rows.reduce((height, row) => {
        const labelLines = estimateTextLines(row.label.vi, labelWidth, fontSize);
        const value = interpolateTemplateString(row.value, sampleData);
        const valueLines = estimateTextLines(value, valueWidth, fontSize);
        return height + Math.max(labelLines, valueLines, 1) * lineHeightMm + 2;
      }, padding * 2)
    )
  }));
}

function createLineItemsFragments(
  box: Extract<TemplateBox, { type: "line_items_table" }>,
  sampleData: Record<string, unknown>,
  layout: DocumentTemplateLayout,
  originalPageIndex: number
): FlowFragment[] {
  const source = getValueByPath(sampleData, box.content.source);
  const rows = Array.isArray(source) ? source : [];
  const rowHeights = estimateLineItemsRowHeights(box, rows, sampleData);
  const fontSize = box.style?.fontSize ?? 9;
  const lineHeight = box.style?.lineHeight ?? 1.35;
  const padding = box.style?.padding ?? 2;
  const headerHeight = fontSize * 0.3528 * lineHeight + 3.2;
  const maxChunkHeight = Math.min(Math.max(box.height, 90), getMaxContentHeight(layout));
  const chunks: unknown[][] = [];
  const chunkHeights: number[] = [];
  let currentRows: unknown[] = [];
  let currentHeight = headerHeight + padding * 2;

  rows.forEach((row, index) => {
    const rowHeight = rowHeights[index] ?? headerHeight;
    if (currentRows.length > 0 && currentHeight + rowHeight > maxChunkHeight) {
      chunks.push(currentRows);
      chunkHeights.push(currentHeight);
      currentRows = [];
      currentHeight = headerHeight + padding * 2;
    }

    currentRows.push(
      typeof row === "object" && row !== null
        ? { ...(row as Record<string, unknown>), __flowIndex: index + 1 }
        : { value: row, __flowIndex: index + 1 }
    );
    currentHeight += rowHeight;
  });

  if (currentRows.length > 0 || chunks.length === 0) {
    chunks.push(currentRows);
    chunkHeights.push(currentHeight);
  }

  return chunks.map((chunkRows, index) => {
    const sourcePath = `__flow.${box.id}_${originalPageIndex}_${index}`;
    setFlowValue(sampleData, sourcePath, chunkRows);

    return {
      box: {
        ...box,
        id: index === 0 ? box.id : `${box.id}__flow_table_${index + 1}`,
        content: { ...box.content, source: sourcePath }
      },
      height: Math.max(box.height, chunkHeights[index] ?? box.height)
    };
  });
}

function estimateLineItemsRowHeights(
  box: Extract<TemplateBox, { type: "line_items_table" }>,
  rows: unknown[],
  sampleData?: Record<string, unknown>
) {
  const fontSize = box.style?.fontSize ?? 9;
  const lineHeight = box.style?.lineHeight ?? 1.35;
  const rowVerticalPaddingMm = 3.2;
  const textLineHeightMm = fontSize * 0.3528 * lineHeight;
  const columnPercents = getLineItemColumnPercents(box, sampleData);

  return rows.map((row, index) => {
    const rowContext = {
      ...(typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {}),
      index: index + 1
    };
    const maxLines = box.content.columns.reduce((lineCount, column) => {
      const columnIndex = box.content.columns.findIndex((candidate) => candidate.id === column.id);
      const columnWidthMm = box.width * ((columnPercents[columnIndex] ?? 1) / 100);
      const text = interpolateTemplateString(column.value, rowContext);
      return Math.max(lineCount, estimateTextLines(text, columnWidthMm, fontSize));
    }, 1);

    return maxLines * textLineHeightMm + rowVerticalPaddingMm;
  });
}

function wrapText(text: string, boxWidthMm: number, fontSize: number) {
  const availableWidthMm = Math.max(8, boxWidthMm - 4);
  const averageCharWidthMm = Math.max(1.1, fontSize * 0.3528 * 0.48);
  const charsPerLine = Math.max(8, Math.floor(availableWidthMm / averageCharWidthMm));
  const lines: string[] = [];

  text.split(/\r?\n/).forEach((paragraph) => {
    if (!paragraph.trim()) {
      lines.push("");
      return;
    }

    let current = "";
    paragraph.split(/\s+/).forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > charsPerLine && current) {
        lines.push(current);
        current = word;
        return;
      }
      current = next;
    });

    if (current) {
      lines.push(current);
    }
  });

  return lines;
}

function createFlowFragments(
  box: TemplateBox,
  sampleData: Record<string, unknown>,
  previewLanguage: "vi" | "viEn",
  layout: DocumentTemplateLayout,
  originalPageIndex: number
): FlowFragment[] {
  if (box.type === "line_items_table") {
    return createLineItemsFragments(box, sampleData, layout, originalPageIndex);
  }
  if (box.type === "text") {
    return createTextFragments(box, sampleData, previewLanguage, layout);
  }
  if (box.type === "key_value_table") {
    return createKeyValueFragments(box, sampleData, layout);
  }

  return [{ box, height: Math.min(box.height, getMaxContentHeight(layout)) }];
}

function createContinuationHeader(
  layout: DocumentTemplateLayout,
  pageBoxes: TemplateBox[],
  sampleData: Record<string, unknown>,
  previewLanguage: "vi" | "viEn",
  pageNumber: number
): TemplateBox {
  const titleBox = pageBoxes.find((box) => box.type === "text" && box.id.toLowerCase().includes("title"));
  const metaBox = pageBoxes.find((box) => box.type === "text" && box.id.toLowerCase().includes("meta"));
  const title = titleBox?.type === "text" ? getLocalizedText(titleBox.content.text, previewLanguage, sampleData) : "Tài liệu";
  const meta = metaBox?.type === "text" ? getLocalizedText(metaBox.content.text, previewLanguage, sampleData) : "";

  return {
    id: `__continuation-header-${pageNumber}`,
    type: "text",
    page: pageNumber - 1,
    x: layout.page.marginMm.left,
    y: layout.page.marginMm.top,
    width: layout.page.widthMm - layout.page.marginMm.left - layout.page.marginMm.right,
    height: 12,
    zIndex: 1000,
    visible: true,
    style: {
      fontSize: 9,
      fontWeight: 600,
      lineHeight: 1.3,
      textAlign: "left",
      padding: 1,
      borderWidth: 0.3,
      borderColor: "#cbd5e1",
      borderRadius: 3
    },
    content: {
      text: {
        vi: `${title} · Trang ${pageNumber}${meta ? `\n${meta}` : ""}`
      }
    }
  };
}

function getFlowPlacementY({
  groupY,
  currentY,
  hasBoxes,
  hasContinuationHeader,
  fragmentIndex,
  contentGap
}: {
  groupY: number;
  currentY: number;
  hasBoxes: boolean;
  hasContinuationHeader: boolean;
  fragmentIndex: number;
  contentGap: number;
}) {
  if (!hasBoxes) {
    return Math.max(groupY, currentY);
  }

  if (hasContinuationHeader) {
    return fragmentIndex === 0 ? currentY : currentY + contentGap;
  }

  if (fragmentIndex > 0) {
    return currentY + contentGap;
  }

  return groupY >= currentY ? groupY : currentY + contentGap;
}

function buildPresentationPages(
  layout: DocumentTemplateLayout,
  rawSampleData: Record<string, unknown>,
  previewLanguage: "vi" | "viEn"
) {
  const sampleData: Record<string, unknown> = { ...rawSampleData, __flow: {} };
  const pages: RenderablePage[] = [];
  const pageBottom = layout.page.heightMm - layout.page.marginMm.bottom;
  const continuationStartY = layout.page.marginMm.top + 18;
  const contentGap = 4;

  layout.pages.forEach((page, originalPageIndex) => {
    let currentPage: RenderablePage = { id: `${page.id}-flow-${pages.length + 1}`, boxes: [] };
    pages.push(currentPage);
    let currentY = 0;
    const groups = groupBoxesForFlow(page.boxes.filter((box) => box.visible !== false));

    groups.forEach((group) => {
      const groupedFragments = group.boxes.map((box) =>
        createFlowFragments(box, sampleData, previewLanguage, layout, originalPageIndex)
      );
      const maxFragments = Math.max(...groupedFragments.map((fragments) => fragments.length), 0);

      for (let fragmentIndex = 0; fragmentIndex < maxFragments; fragmentIndex += 1) {
        const fragments = groupedFragments
          .map((fragmentsForBox) => fragmentsForBox[fragmentIndex])
          .filter((fragment): fragment is FlowFragment => Boolean(fragment));
        if (fragments.length === 0) {
          continue;
        }

        const groupHeight = Math.max(...fragments.map((fragment) => fragment.height));
        let y = getFlowPlacementY({
          groupY: group.y,
          currentY,
          hasBoxes: currentPage.boxes.length > 0,
          hasContinuationHeader: currentPage.boxes.some((box) => box.id.includes("__continuation-header")),
          fragmentIndex,
          contentGap
        });

        if (y + groupHeight > pageBottom && currentPage.boxes.length > 0) {
          currentPage = {
            id: `flow-continuation-${pages.length + 1}`,
            boxes: [createContinuationHeader(layout, page.boxes, sampleData, previewLanguage, pages.length + 1)]
          };
          pages.push(currentPage);
          y = continuationStartY;
        }

        fragments.forEach((fragment) => {
          currentPage.boxes.push({
            ...fragment.box,
            page: pages.length - 1,
            y,
            height: fragment.height
          });
        });
        currentY = y + groupHeight;
      }
    });
  });

  return { pages, sampleData };
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
  const presentation = useMemo(
    () =>
      presentationMode
        ? buildPresentationPages(layout, sampleData, previewLanguage)
        : { pages: layout.pages, sampleData },
    [layout, presentationMode, previewLanguage, sampleData]
  );
  const dragRef = useRef<{
    boxId: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    if (presentationMode) {
      onOverflowIssuesChange([]);
      return undefined;
    }

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
  }, [layout, onOverflowIssuesChange, presentationMode, previewLanguage, sampleData]);

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
        {presentation.pages.map((page, pageIndex) => (
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

            {page.boxes
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
                      {renderBoxContent(box, previewLanguage, presentation.sampleData)}
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
