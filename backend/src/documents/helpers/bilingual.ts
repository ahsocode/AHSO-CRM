import type { I18nBundles } from "../i18n.service";
import type { DocumentLanguage } from "../dto/document-type.enum";

export interface BilingualOptions {
  bundles: I18nBundles;
}

/**
 * Build the `{{t "key"}}` Handlebars helper.
 *
 * Reads `language` from the current template context. When "vi-en" it emits
 * `<span class="lang-vi">…</span><span class="lang-en">…</span>`, otherwise
 * it emits the Vietnamese string only. Falls back to the key when missing.
 */
export function buildBilingualHelper({ bundles }: BilingualOptions) {
  return function tHelper(key: unknown, options: unknown): string {
    if (typeof key !== "string") return "";

    const ctxLanguage = resolveLanguage(options);
    const vi = bundles.vi?.[key];
    const en = bundles.en?.[key];

    if (ctxLanguage === "vi-en") {
      const viPart = vi ?? key;
      const enPart = en ?? key;
      return `<span class="lang-vi">${viPart}</span><span class="lang-en">${enPart}</span>`;
    }

    return vi ?? en ?? key;
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
