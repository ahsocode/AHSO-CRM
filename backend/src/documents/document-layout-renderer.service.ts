import { Injectable } from "@nestjs/common";
import type {
  DocumentTemplateLayout,
  TemplateBox,
  TemplateKeyValueRow,
  TemplateLanguageKey,
  TemplateLocalizedText
} from "./document-template.types";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toKebabCase(styleKey: string) {
  return styleKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function getByPath(input: unknown, path: string): unknown {
  if (!path) {
    return input;
  }

  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const parsedIndex = Number(segment);
      return Number.isInteger(parsedIndex) ? current[parsedIndex] : undefined;
    }

    if (typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, input);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
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

type LineItemColumnRole = "index" | "name" | "description" | "quantity" | "unitPrice" | "total" | "other";

interface RenderablePage {
  id: string;
  boxes: TemplateBox[];
}

interface FlowFragment {
  box: TemplateBox;
  height: number;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

@Injectable()
export class DocumentLayoutRendererService {
  getCss() {
    return `
/* Each .schema-document__page is exactly one A4 sheet.
   @page margin: 0 overrides base.css so the 210×297 mm div maps 1-to-1
   to the PDF page without any Puppeteer/CSS margin stacking. */
@page {
  size: A4;
  margin: 0;
}

.schema-document {
  background: #f8fafc;
  color: #0f172a;
  font-family: "Be Vietnam Pro", "Segoe UI", sans-serif;
}

.schema-document__page {
  position: relative;
  width: 210mm;
  height: 297mm;
  margin: 0 auto 12mm;
  background: #ffffff;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.schema-document__box {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
}

.schema-document__text {
  white-space: pre-wrap;
}

.schema-document__text-inner {
  max-width: 100%;
  width: 100%;
}

.schema-document__image {
  width: 100%;
  height: 100%;
}

.schema-document__image img {
  width: 100%;
  height: 100%;
  display: block;
}

.schema-document__table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.schema-document__table thead th {
  background: #e2e8f0;
  font-weight: 700;
}

.schema-document__table th,
.schema-document__table td {
  border: 1px solid #cbd5e1;
  padding: 1.6mm 1.8mm;
  vertical-align: top;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: normal;
}

.schema-document__kv-row {
  display: grid;
  grid-template-columns: var(--label-width, 30%) 1fr;
  gap: 2mm;
  padding: 1mm 0;
  border-bottom: 1px solid rgba(203, 213, 225, 0.6);
}

.schema-document__kv-row:last-child {
  border-bottom: none;
}

.schema-document__kv-label {
  font-weight: 700;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.schema-document__kv-value {
  display: block;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.schema-document__signature {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8mm;
  height: 100%;
}

.schema-document__signature-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  text-align: center;
  height: 100%;
}

.schema-document__signature-space {
  flex: 1;
  min-height: 12mm;
}

@media print {
  .schema-document {
    background: transparent;
  }

  .schema-document__page {
    box-shadow: none;
    margin: 0 auto;
    break-after: page;
  }
}
`;
  }

  render(
    layout: DocumentTemplateLayout,
    context: Record<string, unknown>,
    language: TemplateLanguageKey
  ) {
    const paginated = this.paginateLayout(layout, context, language);
    const pages = paginated.pages
      .map((page) => {
        const boxes = page.boxes
          .filter((box) => box.visible !== false)
          .sort((left, right) => left.zIndex - right.zIndex)
          .map((box) => this.renderBox(box, paginated.context, language))
          .join("");

        return `<section class="schema-document__page">${boxes}</section>`;
      })
      .join("");

    return `<div class="schema-document">${pages}</div>`;
  }

  private paginateLayout(
    layout: DocumentTemplateLayout,
    context: Record<string, unknown>,
    language: TemplateLanguageKey
  ) {
    const flowContext: Record<string, unknown> = { ...context, __flow: {} };
    const pages: RenderablePage[] = [];
    const pageBottom = layout.page.heightMm - layout.page.marginMm.bottom;
    const continuationStartY = layout.page.marginMm.top + 18;
    const contentGap = 4;

    layout.pages.forEach((page, pageIndex) => {
      let currentPage: RenderablePage = { id: `${page.id}-flow-${pages.length + 1}`, boxes: [] };
      pages.push(currentPage);
      let currentY = 0;
      const groups = this.groupBoxesForFlow(page.boxes.filter((box) => box.visible !== false));

      for (const group of groups) {
        const groupFragments = group.boxes.map((box) =>
          this.createFlowFragments(box, flowContext, language, layout, pageIndex)
        );
        const maxFragments = Math.max(...groupFragments.map((fragments) => fragments.length), 0);

        for (let fragmentIndex = 0; fragmentIndex < maxFragments; fragmentIndex += 1) {
          const fragments = groupFragments
            .map((boxFragments) => boxFragments[fragmentIndex])
            .filter((fragment): fragment is FlowFragment => Boolean(fragment));
          if (fragments.length === 0) {
            continue;
          }

          const groupHeight = Math.max(...fragments.map((fragment) => fragment.height));
          const desiredY = fragmentIndex === 0
            ? Math.max(group.y, currentY > 0 ? currentY + contentGap : 0)
            : currentY + contentGap;

          if (
            desiredY + groupHeight > pageBottom &&
            currentPage.boxes.length > 0 &&
            groupHeight <= pageBottom - continuationStartY
          ) {
            currentPage = this.createContinuationPage(layout, context, language, pages.length + 1, pageIndex);
            pages.push(currentPage);
            currentY = continuationStartY;
          }

          const y = currentPage.boxes.length === 0
            ? Math.max(group.y, currentY)
            : Math.max(currentY + contentGap, currentPage.boxes.some((box) => box.id.includes("__continuation-header")) ? currentY : group.y);
          const placedY = y + groupHeight > pageBottom && currentPage.boxes.length > 0
            ? continuationStartY
            : y;

          if (placedY === continuationStartY && y !== placedY) {
            currentPage = this.createContinuationPage(layout, context, language, pages.length + 1, pageIndex);
            pages.push(currentPage);
          }

          fragments.forEach((fragment) => {
            currentPage.boxes.push({
              ...fragment.box,
              page: pages.length - 1,
              y: placedY,
              height: fragment.height
            });
          });
          currentY = placedY + groupHeight;
        }
      }
    });

    return { pages, context: flowContext };
  }

  private groupBoxesForFlow(boxes: TemplateBox[]) {
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

  private createContinuationPage(
    layout: DocumentTemplateLayout,
    context: Record<string, unknown>,
    language: TemplateLanguageKey,
    pageNumber: number,
    originalPageIndex: number
  ): RenderablePage {
    return {
      id: `flow-continuation-${pageNumber}`,
      boxes: [this.createContinuationHeader(layout, context, language, pageNumber, originalPageIndex)]
    };
  }

  private createContinuationHeader(
    layout: DocumentTemplateLayout,
    context: Record<string, unknown>,
    language: TemplateLanguageKey,
    pageNumber: number,
    originalPageIndex: number
  ): TemplateBox {
    const sourcePage = layout.pages[originalPageIndex] ?? layout.pages[0];
    const titleBox = sourcePage?.boxes.find((box) => box.type === "text" && box.id.toLowerCase().includes("title"));
    const metaBox = sourcePage?.boxes.find((box) => box.type === "text" && box.id.toLowerCase().includes("meta"));
    const title = titleBox?.type === "text"
      ? this.interpolatePlain(this.selectLocalizedText(titleBox.content.text, language), context)
      : "Tài liệu";
    const meta = metaBox?.type === "text"
      ? this.interpolatePlain(this.selectLocalizedText(metaBox.content.text, language), context)
      : "";

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

  private createFlowFragments(
    box: TemplateBox,
    flowContext: Record<string, unknown>,
    language: TemplateLanguageKey,
    layout: DocumentTemplateLayout,
    originalPageIndex: number
  ): FlowFragment[] {
    if (box.type === "line_items_table") {
      return this.createLineItemsFragments(box, flowContext, layout, originalPageIndex);
    }
    if (box.type === "text") {
      return this.createTextFragments(box, flowContext, language, layout);
    }
    if (box.type === "key_value_table") {
      return this.createKeyValueFragments(box, flowContext, layout);
    }

    return [{
      box,
      height: Math.min(box.height, this.getMaxContentHeight(layout))
    }];
  }

  private getMaxContentHeight(layout: DocumentTemplateLayout) {
    return layout.page.heightMm - layout.page.marginMm.top - layout.page.marginMm.bottom - 18;
  }

  private createTextFragments(
    box: Extract<TemplateBox, { type: "text" }>,
    flowContext: Record<string, unknown>,
    language: TemplateLanguageKey,
    layout: DocumentTemplateLayout
  ): FlowFragment[] {
    const text = this.interpolatePlain(this.selectLocalizedText(box.content.text, language), flowContext);
    const fontSize = box.style?.fontSize ?? 10;
    const lineHeight = box.style?.lineHeight ?? 1.35;
    const padding = box.style?.padding ?? 0;
    const lineHeightMm = fontSize * 0.3528 * lineHeight;
    const maxChunkHeight = Math.min(Math.max(box.height, 80), this.getMaxContentHeight(layout));
    const maxLinesPerChunk = Math.max(1, Math.floor((maxChunkHeight - padding * 2) / lineHeightMm));
    const lines = this.wrapText(text, box.width, fontSize);
    const chunks = this.chunkArray(lines.length > 0 ? lines : [""], maxLinesPerChunk);

    return chunks.map((chunk, index) => ({
      box: {
        ...box,
        id: index === 0 ? box.id : `${box.id}__flow_text_${index + 1}`,
        content: {
          text: {
            vi: chunk.join("\n")
          }
        }
      },
      height: Math.max(box.height, chunk.length * lineHeightMm + padding * 2)
    }));
  }

  private createKeyValueFragments(
    box: Extract<TemplateBox, { type: "key_value_table" }>,
    flowContext: Record<string, unknown>,
    layout: DocumentTemplateLayout
  ): FlowFragment[] {
    const fontSize = box.style?.fontSize ?? 9.5;
    const lineHeight = box.style?.lineHeight ?? 1.35;
    const padding = box.style?.padding ?? 0;
    const lineHeightMm = fontSize * 0.3528 * lineHeight;
    const maxChunkHeight = Math.min(Math.max(box.height, 80), this.getMaxContentHeight(layout));
    const labelWidth = box.width * ((box.content.labelWidth ?? 30) / 100);
    const valueWidth = box.width - labelWidth - 2;
    const chunks: TemplateKeyValueRow[][] = [];
    let currentRows: TemplateKeyValueRow[] = [];
    let currentHeight = padding * 2;

    box.content.rows.forEach((row) => {
      const labelLines = this.estimateTextLines(row.label.vi, labelWidth, fontSize);
      const value = this.interpolatePlain(row.value, flowContext);
      const valueLines = this.estimateTextLines(value, valueWidth, fontSize);
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
        content: {
          ...box.content,
          rows
        }
      },
      height: Math.max(
        Math.min(box.height, maxChunkHeight),
        rows.reduce((height, row) => {
          const labelLines = this.estimateTextLines(row.label.vi, labelWidth, fontSize);
          const value = this.interpolatePlain(row.value, flowContext);
          const valueLines = this.estimateTextLines(value, valueWidth, fontSize);
          return height + Math.max(labelLines, valueLines, 1) * lineHeightMm + 2;
        }, padding * 2)
      )
    }));
  }

  private createLineItemsFragments(
    box: Extract<TemplateBox, { type: "line_items_table" }>,
    flowContext: Record<string, unknown>,
    layout: DocumentTemplateLayout,
    originalPageIndex: number
  ): FlowFragment[] {
    const sourceRows = getByPath(flowContext, box.content.source);
    const rows = Array.isArray(sourceRows) ? sourceRows : [];
    const rowHeights = this.estimateLineItemsRowHeights(box, rows, flowContext);
    const fontSize = box.style?.fontSize ?? 9;
    const lineHeight = box.style?.lineHeight ?? 1.35;
    const padding = box.style?.padding ?? 2;
    const headerHeight = fontSize * 0.3528 * lineHeight + 3.2;
    const maxChunkHeight = Math.min(Math.max(box.height, 90), this.getMaxContentHeight(layout));
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
      this.setFlowValue(flowContext, sourcePath, chunkRows);

      return {
        box: {
          ...box,
          id: index === 0 ? box.id : `${box.id}__flow_table_${index + 1}`,
          content: {
            ...box.content,
            source: sourcePath
          }
        },
        height: Math.max(box.height, chunkHeights[index] ?? box.height)
      };
    });
  }

  private estimateLineItemsRowHeights(
    box: Extract<TemplateBox, { type: "line_items_table" }>,
    rows: unknown[],
    context?: Record<string, unknown>
  ) {
    const fontSizePt = box.style?.fontSize ?? 9;
    const lineHeight = box.style?.lineHeight ?? 1.35;
    const rowVerticalPaddingMm = 3.2;
    const textLineHeightMm = fontSizePt * 0.3528 * lineHeight;
    const columnPercents = this.getLineItemColumnPercents(box, context);

    return rows.map((row, index) => {
      const rowContext = {
        ...(typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {}),
        index: index + 1
      };
      const maxLines = box.content.columns.reduce((lineCount, column) => {
        const columnIndex = box.content.columns.findIndex((candidate) => candidate.id === column.id);
        const columnWidthMm = box.width * ((columnPercents[columnIndex] ?? 1) / 100);
        const text = this.interpolatePlain(column.value, rowContext);
        return Math.max(lineCount, this.estimateTextLines(text, columnWidthMm, fontSizePt));
      }, 1);

      return maxLines * textLineHeightMm + rowVerticalPaddingMm;
    });
  }

  private wrapText(text: string, boxWidthMm: number, fontSizePt: number) {
    const availableWidthMm = Math.max(8, boxWidthMm - 4);
    const averageCharWidthMm = Math.max(1.1, fontSizePt * 0.3528 * 0.48);
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

  private chunkArray<T>(items: T[], chunkSize: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += chunkSize) {
      chunks.push(items.slice(index, index + chunkSize));
    }

    return chunks;
  }

  private setFlowValue(context: Record<string, unknown>, path: string, value: unknown) {
    const segments = path.split(".");
    let current = context;
    segments.slice(0, -1).forEach((segment) => {
      if (typeof current[segment] !== "object" || current[segment] === null) {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    });
    current[segments[segments.length - 1]] = value;
  }

  private estimateTextLines(text: string, columnWidthMm: number, fontSizePt: number) {
    const availableWidthMm = Math.max(6, columnWidthMm - 3.6);
    const averageCharWidthMm = Math.max(1.1, fontSizePt * 0.3528 * 0.48);
    const charsPerLine = Math.max(4, Math.floor(availableWidthMm / averageCharWidthMm));

    return text
      .split(/\r?\n/)
      .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  }

  private getLineItemColumnPercents(
    box: Extract<TemplateBox, { type: "line_items_table" }>,
    context?: Record<string, unknown>
  ) {
    const roles = box.content.columns.map((column) => this.getLineItemColumnRole(column));
    const roleSet = new Set(roles);
    const isStandardCommercialTable =
      roleSet.has("index") &&
      roleSet.has("name") &&
      roleSet.has("quantity") &&
      roleSet.has("unitPrice") &&
      roleSet.has("total");

    const weightsWithDescription: Record<LineItemColumnRole, number> = {
      index: 6,
      name: 41,
      description: 23,
      quantity: 6,
      unitPrice: 12,
      total: 12,
      other: 8
    };
    const weightsWithoutDescription: Record<LineItemColumnRole, number> = {
      index: 6,
      name: 50,
      description: 0,
      quantity: 7,
      unitPrice: 18,
      total: 19,
      other: 8
    };
    const weights = roleSet.has("description") ? weightsWithDescription : weightsWithoutDescription;
    const quoteOverrides = this.getQuoteTableColumnWidthOverrides(context);
    if (!isStandardCommercialTable && !quoteOverrides) {
      return this.normalizeRawColumnPercents(box);
    }

    const raw = roles.map((role, index) => {
      const column = box.content.columns[index];
      const exactOverride = column ? quoteOverrides?.[column.id] : undefined;
      const roleOverride = quoteOverrides?.[role];
      return exactOverride ?? roleOverride ?? weights[role] ?? weights.other;
    });
    const total = raw.reduce((sum, value) => sum + value, 0) || 1;

    return raw.map((value) => (value / total) * 100);
  }

  private getQuoteTableColumnWidthOverrides(context?: Record<string, unknown>) {
    const raw = (
      context
        ? getByPath(context, "quote.tableColumnWidths") ?? getByPath(context, "tableColumnWidths")
        : undefined
    );

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

  private normalizeRawColumnPercents(box: Extract<TemplateBox, { type: "line_items_table" }>) {
    const raw = box.content.columns.map((column) => Math.max(1, column.width ?? 1));
    const total = raw.reduce((sum, value) => sum + value, 0) || 1;

    return raw.map((value) => (value / total) * 100);
  }

  private getLineItemColumnRole(column: Extract<TemplateBox, { type: "line_items_table" }>["content"]["columns"][number]): LineItemColumnRole {
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

  interpolate(template: string, context: Record<string, unknown>) {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_fullMatch, rawExpression: string) => {
      const [path, ...filters] = rawExpression.split("|").map((part) => part.trim());
      const value = getByPath(context, path);
      return escapeHtml(this.applyFilters(value, filters));
    });
  }

  private interpolatePlain(template: string, context: Record<string, unknown>) {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_fullMatch, rawExpression: string) => {
      const [path, ...filters] = rawExpression.split("|").map((part) => part.trim());
      const value = getByPath(context, path);
      return String(this.applyFilters(value, filters));
    });
  }

  private selectLocalizedText(value: TemplateLocalizedText, language: TemplateLanguageKey) {
    return language === "viEn" ? value.viEn ?? value.vi : value.vi;
  }

  private renderLocalizedText(
    value: TemplateLocalizedText,
    language: TemplateLanguageKey,
    context: Record<string, unknown>
  ) {
    const selected = this.selectLocalizedText(value, language);
    return this.interpolate(selected, context).replaceAll("\n", "<br />");
  }

  private renderBox(
    box: TemplateBox,
    context: Record<string, unknown>,
    language: TemplateLanguageKey
  ) {
    const style = this.buildStyle(box);

    if (box.type === "text") {
      return `<div class="schema-document__box schema-document__text" style="${style}"><div class="schema-document__text-inner" style="text-align:${box.style?.textAlign ?? "left"}">${this.renderLocalizedText(box.content.text, language, context)}</div></div>`;
    }

    if (box.type === "image") {
      const source = this.interpolate(box.content.src, context);
      const fit = box.content.fit === "cover" ? "cover" : "contain";
      const objectPosition = toObjectPosition(box.style?.textAlign, box.style?.verticalAlign);
      return `<div class="schema-document__box schema-document__image" style="${style}">${source ? `<img src="${source}" alt="${escapeHtml(box.content.alt ?? "")}" style="object-fit:${fit};object-position:${objectPosition};" />` : ""}</div>`;
    }

    if (box.type === "key_value_table") {
      const valueAlign = box.style?.textAlign ?? "left";
      const rows = box.content.rows
        .map((row) => this.renderKeyValueRow(row, language, context, valueAlign))
        .join("");
      return `<div class="schema-document__box" style="${style}; --label-width:${box.content.labelWidth ?? 30}%">${rows}</div>`;
    }

    if (box.type === "line_items_table") {
      const rows = getByPath(context, box.content.source);
      const lineItems = Array.isArray(rows) ? rows : [];
      const columnPercents = this.getLineItemColumnPercents(box, context);
      const colgroup = box.content.columns
        .map((_column, index) => `<col style="width:${(columnPercents[index] ?? 1).toFixed(4)}%" />`)
        .join("");
      const header = box.content.columns
        .map(
          (column) =>
            `<th style="text-align:${column.align ?? "left"}">${escapeHtml(language === "viEn" ? column.label.viEn ?? column.label.vi : column.label.vi)}</th>`
        )
        .join("");
      const body = lineItems.length
        ? lineItems
            .map((row, index) => {
              const rowContext = {
                ...(typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {}),
                index: typeof row === "object" && row !== null && "__flowIndex" in row
                  ? (row as Record<string, unknown>).__flowIndex
                  : index + 1
              };
              return `<tr>${box.content.columns
                .map((column) => {
                  const content = this.interpolate(column.value, rowContext);
                  return `<td style="text-align:${column.align ?? "left"}">${content}</td>`;
                })
                .join("")}</tr>`;
            })
            .join("")
        : `<tr><td colspan="${box.content.columns.length}" style="text-align:center">${escapeHtml(
            language === "viEn"
              ? box.content.emptyText?.viEn ?? box.content.emptyText?.vi ?? "No data"
              : box.content.emptyText?.vi ?? "Chưa có dữ liệu"
          )}</td></tr>`;

      // Let rows grow vertically, but keep columns inside the declared box width.
      // Absolute-positioned document boxes cannot reflow following sections, so
      // horizontal expansion is not allowed here; it causes clipped PDFs and
      // severe wrapping that overlaps terms/signature blocks.
      const tableStyle = style
        .replace(/\bheight:[\d.]+mm/, `min-height:${box.height}mm`)
        + ";overflow:visible";
      return `<div class="schema-document__box" style="${tableStyle}"><table class="schema-document__table"><colgroup>${colgroup}</colgroup><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    const leftTitle =
      language === "viEn" ? box.content.leftTitle.viEn ?? box.content.leftTitle.vi : box.content.leftTitle.vi;
    const rightTitle =
      language === "viEn"
        ? box.content.rightTitle.viEn ?? box.content.rightTitle.vi
        : box.content.rightTitle.vi;
    const leftCaption = box.content.leftCaption
      ? language === "viEn"
        ? box.content.leftCaption.viEn ?? box.content.leftCaption.vi
        : box.content.leftCaption.vi
      : "";
    const rightCaption = box.content.rightCaption
      ? language === "viEn"
        ? box.content.rightCaption.viEn ?? box.content.rightCaption.vi
        : box.content.rightCaption.vi
      : "";

    return `<div class="schema-document__box" style="${style}"><div class="schema-document__signature"><div class="schema-document__signature-column"><strong>${escapeHtml(leftTitle)}</strong><span class="schema-document__signature-space"></span><span>${escapeHtml(leftCaption)}</span></div><div class="schema-document__signature-column"><strong>${escapeHtml(rightTitle)}</strong><span class="schema-document__signature-space"></span><span>${escapeHtml(rightCaption)}</span></div></div></div>`;
  }

  private renderKeyValueRow(
    row: TemplateKeyValueRow,
    language: TemplateLanguageKey,
    context: Record<string, unknown>,
    valueAlign: "left" | "center" | "right" | "justify"
  ) {
    const label = language === "viEn" ? row.label.viEn ?? row.label.vi : row.label.vi;
    const value = this.interpolate(row.value, context);

    return `<div class="schema-document__kv-row"><span class="schema-document__kv-label">${escapeHtml(label)}</span><span class="schema-document__kv-value" style="text-align:${valueAlign}">${value}</span></div>`;
  }

  private buildStyle(box: TemplateBox) {
    const style: Record<string, string> = {
      left: `${box.x}mm`,
      top: `${box.y}mm`,
      width: `${box.width}mm`,
      height: `${box.height}mm`,
      zIndex: String(box.zIndex)
    };

    const boxStyle = box.style;
    if (boxStyle) {
      const fontSize = boxStyle.fontSize ? `${boxStyle.fontSize}pt` : undefined;
      const borderWidth = boxStyle.borderWidth ? `${boxStyle.borderWidth}mm` : undefined;
      const borderRadius = boxStyle.borderRadius ? `${boxStyle.borderRadius}mm` : undefined;
      const padding = boxStyle.padding ? `${boxStyle.padding}mm` : undefined;

      const serialized = {
        display: box.type === "text" ? "flex" : undefined,
        flexDirection: box.type === "text" ? "column" : undefined,
        justifyContent: box.type === "text" ? toVerticalJustify(boxStyle.verticalAlign) : undefined,
        fontSize,
        fontWeight: boxStyle.fontWeight ? String(boxStyle.fontWeight) : undefined,
        lineHeight: boxStyle.lineHeight ? String(boxStyle.lineHeight) : undefined,
        textAlign: box.type === "text" || box.type === "key_value_table" ? undefined : boxStyle.textAlign,
        color: boxStyle.color,
        backgroundColor: boxStyle.backgroundColor,
        borderColor: boxStyle.borderColor,
        borderWidth,
        borderStyle: boxStyle.borderWidth ? "solid" : undefined,
        borderRadius,
        padding
      };

      Object.entries(serialized).forEach(([key, value]) => {
        if (value) {
          style[toKebabCase(key)] = value;
        }
      });
    }

    return Object.entries(style)
      .map(([key, value]) => `${key}:${value}`)
      .join(";");
  }

  private applyFilters(value: unknown, filters: string[]) {
    let nextValue = value;

    for (const filter of filters) {
      if (filter === "currency") {
        const numericValue =
          typeof nextValue === "number"
            ? nextValue
            : typeof nextValue === "string"
              ? Number(nextValue)
              : NaN;
        nextValue = Number.isFinite(numericValue) ? formatCurrency(numericValue) : "";
      } else if (filter === "date") {
        nextValue =
          typeof nextValue === "string" || nextValue instanceof Date ? formatDate(nextValue) : "";
      } else if (filter === "number") {
        const numericValue =
          typeof nextValue === "number"
            ? nextValue
            : typeof nextValue === "string"
              ? Number(nextValue)
              : NaN;
        nextValue = Number.isFinite(numericValue)
          ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(numericValue)
          : "";
      } else if (filter === "upper") {
        nextValue = String(nextValue ?? "").toUpperCase();
      } else if (filter === "lower") {
        nextValue = String(nextValue ?? "").toLowerCase();
      }
    }

    if (nextValue === null || nextValue === undefined) {
      return "";
    }

    return nextValue;
  }
}
