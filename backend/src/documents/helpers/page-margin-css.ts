import type { DocumentLanguage } from "../dto/document-type.enum";

/**
 * Per-document @page margin boxes for the Handlebars documents (audit E-13):
 *   bottom-left  = company name · document number (when one has been issued)
 *   bottom-right = "Trang x / y" (vi) | "Trang / Page x / y" (vi-en)
 * Values come from settings / the number service, so they are escaped as CSS strings
 * (quotes, backslashes, newlines and "<" cannot break out of the string or the <style> tag).
 */
export function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\3C ")
    .replace(/>/g, "\\3E ")
    .replace(/\r?\n|\r|\f/g, " ");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildPageMarginCss(context: Record<string, unknown>, language: DocumentLanguage): string {
  const company = (context.company ?? {}) as Record<string, unknown>;
  const left = [text(company.name), text(context.docNumber)].filter(Boolean).join(" · ");
  const pageLabel = language === "vi-en" ? "Trang / Page " : "Trang ";
  const box = 'font-family: "Noto Sans", "DejaVu Sans", Arial, sans-serif; font-size: 8.5pt; color: #4b5563;';
  return `
@page {
  @bottom-left {
    content: "${escapeCssString(left)}";
    ${box}
  }
  @bottom-right {
    content: "${escapeCssString(pageLabel)}" counter(page) " / " counter(pages);
    ${box}
  }
}
`;
}
