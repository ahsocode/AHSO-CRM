import type { TemplateBox } from "./document-template.types";

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function toKebabCase(styleKey: string) {
  return styleKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function getByPath(input: unknown, path: string): unknown {
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

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDate(value: string | Date) {
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

export function toVerticalJustify(value?: "top" | "center" | "bottom") {
  switch (value) {
    case "center":
      return "center";
    case "bottom":
      return "flex-end";
    default:
      return "flex-start";
  }
}

export function toObjectPosition(
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

export type LineItemColumnRole = "index" | "name" | "description" | "quantity" | "unitPrice" | "total" | "other";

export interface RenderablePage {
  id: string;
  boxes: TemplateBox[];
}

export interface FlowFragment {
  box: TemplateBox;
  height: number;
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
