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
  border-collapse: collapse;
}

.schema-document__table thead th {
  background: #e2e8f0;
  font-weight: 700;
}

.schema-document__table th,
.schema-document__table td {
  border: 1px solid #cbd5e1;
  padding: 2mm 2.4mm;
  vertical-align: top;
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
    const pages = layout.pages
      .map((page) => {
        const boxes = [...page.boxes]
          .filter((box) => box.visible !== false)
          .sort((left, right) => left.zIndex - right.zIndex)
          .map((box) => this.renderBox(box, context, language))
          .join("");

        return `<section class="schema-document__page">${boxes}</section>`;
      })
      .join("");

    return `<div class="schema-document">${pages}</div>`;
  }

  interpolate(template: string, context: Record<string, unknown>) {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_fullMatch, rawExpression: string) => {
      const [path, ...filters] = rawExpression.split("|").map((part) => part.trim());
      const value = getByPath(context, path);
      return escapeHtml(this.applyFilters(value, filters));
    });
  }

  private renderLocalizedText(
    value: TemplateLocalizedText,
    language: TemplateLanguageKey,
    context: Record<string, unknown>
  ) {
    const selected = language === "viEn" ? value.viEn ?? value.vi : value.vi;
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
      const header = box.content.columns
        .map(
          (column) =>
            `<th style="${column.width ? `width:${column.width}mm;` : ""} text-align:${column.align ?? "left"}">${escapeHtml(language === "viEn" ? column.label.viEn ?? column.label.vi : column.label.vi)}</th>`
        )
        .join("");
      const body = lineItems.length
        ? lineItems
            .map((row, index) => {
              const rowContext = {
                ...(typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {}),
                index: index + 1
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

      return `<div class="schema-document__box" style="${style}"><table class="schema-document__table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
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
