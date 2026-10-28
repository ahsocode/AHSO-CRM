import type { I18nBundles } from "../i18n.service";
import type { DocumentLanguage } from "../dto/document-type.enum";
import * as Handlebars from "handlebars";

export interface BilingualOptions {
  bundles: I18nBundles;
}

type HashValue = unknown;

function hashOf(options: unknown): Record<string, HashValue> {
  if (options && typeof options === "object" && "hash" in options) {
    const hash = (options as { hash?: unknown }).hash;
    if (hash && typeof hash === "object") return hash as Record<string, HashValue>;
  }
  return {};
}

function paramText(value: HashValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Handlebars.SafeString) return value.toString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * Replace `{{name}}` in an i18n string with `name=` params passed to the helper (audit E-01).
 * Unknown/missing params become empty so no raw `{{…}}` ever reaches a document.
 */
export function interpolate(template: string, params: Record<string, HashValue>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? paramText(params[name]) : ""
  );
}

/**
 * Build the `{{t "key" name=value}}` Handlebars helper.
 *
 * Reads `language` from the current template context. When "vi-en" it emits
 * `<span class="lang-vi">…</span><span class="lang-en">…</span>` (each part HTML-escaped),
 * otherwise the Vietnamese string, which Handlebars escapes. Falls back to the key when missing.
 */
export function buildBilingualHelper({ bundles }: BilingualOptions) {
  return function tHelper(key: unknown, options: unknown): string | Handlebars.SafeString {
    if (typeof key !== "string") return "";
    const params = hashOf(options);
    const ctxLanguage = resolveLanguage(options);
    const vi = bundles.vi?.[key];
    const en = bundles.en?.[key];

    if (ctxLanguage === "vi-en") {
      const viPart = Handlebars.escapeExpression(interpolate(vi ?? key, params));
      const enPart = Handlebars.escapeExpression(interpolate(en ?? key, params));
      return new Handlebars.SafeString(
        `<span class="lang-vi">${viPart}</span><span class="lang-en">${enPart}</span>`
      );
    }

    return interpolate(vi ?? en ?? key, params);
  };
}

function resolveLanguage(options: unknown): DocumentLanguage {
  if (options && typeof options === "object" && "data" in options) {
    const data = (options as { data?: { root?: { language?: DocumentLanguage } } }).data;
    const lang = data?.root?.language;
    if (lang === "vi-en") return "vi-en";
  }
  return "vi";
}
