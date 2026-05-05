"use client";

import type {
  DocumentTemplateLayout,
  TemplateBox,
  TemplateLocalizedText,
  TemplateValidationIssue
} from "@/lib/types";

export const PX_PER_MM = 3.55;

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

export function getValueByPath(input: unknown, path: string): unknown {
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

export function interpolateTemplateString(template: string, context: Record<string, unknown>) {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_full, rawExpression: string) => {
    const [path, ...filters] = rawExpression.split("|").map((segment) => segment.trim());
    let value = getValueByPath(context, path);

    for (const filter of filters) {
      if (filter === "currency") {
        const numeric = typeof value === "number" ? value : Number(value);
        value = Number.isFinite(numeric) ? formatCurrency(numeric) : "";
      } else if (filter === "date") {
        value =
          typeof value === "string" || value instanceof Date ? formatDate(value) : "";
      } else if (filter === "number") {
        const numeric = typeof value === "number" ? value : Number(value);
        value = Number.isFinite(numeric)
          ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(numeric)
          : "";
      } else if (filter === "upper") {
        value = String(value ?? "").toUpperCase();
      } else if (filter === "lower") {
        value = String(value ?? "").toLowerCase();
      }
    }

    return String(value ?? "");
  });
}

export function getLocalizedText(
  value: TemplateLocalizedText,
  language: "vi" | "viEn",
  context: Record<string, unknown>
) {
  const selected = language === "viEn" ? value.viEn ?? value.vi : value.vi;
  return interpolateTemplateString(selected, context);
}

export function cloneLayout(layout: DocumentTemplateLayout): DocumentTemplateLayout {
  return JSON.parse(JSON.stringify(layout)) as DocumentTemplateLayout;
}

export function snapToGrid(value: number, grid: number) {
  return Math.round(value / grid) * grid;
}

export function clampBoxToPage(layout: DocumentTemplateLayout, box: TemplateBox): TemplateBox {
  const margin = layout.page.marginMm;
  const maxX = layout.page.widthMm - margin.right - box.width;
  const maxY = layout.page.heightMm - margin.bottom - box.height;

  return {
    ...box,
    x: Math.min(Math.max(box.x, margin.left), maxX),
    y: Math.min(Math.max(box.y, margin.top), maxY)
  };
}

export function updateBoxInLayout(
  layout: DocumentTemplateLayout,
  boxId: string,
  updater: (box: TemplateBox) => TemplateBox
) {
  return {
    ...layout,
    pages: layout.pages.map((page) => ({
      ...page,
      boxes: page.boxes.map((box) => (box.id === boxId ? updater(box) : box))
    }))
  };
}

export function removeBoxFromLayout(layout: DocumentTemplateLayout, boxId: string) {
  return {
    ...layout,
    pages: layout.pages.map((page) => ({
      ...page,
      boxes: page.boxes.filter((box) => box.id !== boxId)
    }))
  };
}

export function addBoxToLayout(
  layout: DocumentTemplateLayout,
  box: TemplateBox,
  pageIndex = 0
): DocumentTemplateLayout {
  return {
    ...layout,
    pages: layout.pages.map((page, index) =>
      index === pageIndex
        ? {
            ...page,
            boxes: [...page.boxes, box]
          }
        : page
    )
  };
}

export function createNewBoxId(type: TemplateBox["type"]) {
  return `${type}-${Math.random().toString(36).slice(2, 8)}`;
}

export function computeGeometryIssues(layout: DocumentTemplateLayout): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = [];

  for (const [pageIndex, page] of layout.pages.entries()) {
    const visibleBoxes = page.boxes.filter((box) => box.visible !== false);

    for (const box of visibleBoxes) {
      const withinX =
        box.x >= layout.page.marginMm.left &&
        box.x + box.width <= layout.page.widthMm - layout.page.marginMm.right;
      const withinY =
        box.y >= layout.page.marginMm.top &&
        box.y + box.height <= layout.page.heightMm - layout.page.marginMm.bottom;

      if (!withinX || !withinY) {
        issues.push({
          boxId: box.id,
          code: "out_of_bounds",
          severity: "error",
          message: `Box "${box.id}" đang vượt khỏi vùng in ở trang ${pageIndex + 1}.`
        });
      }
    }

    for (let index = 0; index < visibleBoxes.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < visibleBoxes.length; otherIndex += 1) {
        const left = visibleBoxes[index];
        const right = visibleBoxes[otherIndex];

        const overlap = !(
          left.x + left.width <= right.x ||
          right.x + right.width <= left.x ||
          left.y + left.height <= right.y ||
          right.y + right.height <= left.y
        );

        if (overlap) {
          issues.push({
            boxId: left.id,
            code: "overlap",
            severity: "error",
            message: `Box "${left.id}" đang chồng lấn với "${right.id}".`
          });
        }
      }
    }
  }

  return issues;
}
