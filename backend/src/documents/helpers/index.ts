import type { I18nBundles } from "../i18n.service";
import { buildBilingualHelper } from "./bilingual";
import { currencyHelper } from "./format-currency";
import { dateHelper } from "./format-date";
import { registerTableHelpers } from "./table-rows";

type HandlebarsInstance = typeof import("handlebars");

/**
 * Register every Handlebars helper the document templates rely on.
 *
 * Call once per Handlebars instance (idempotent — later registrations
 * overwrite earlier ones).
 */
export function registerHelpers(handlebars: HandlebarsInstance, bundles: I18nBundles): void {
  handlebars.registerHelper("currency", currencyHelper);
  handlebars.registerHelper("date", dateHelper);
  handlebars.registerHelper("t", buildBilingualHelper({ bundles }));

  // Polarity helpers — small utilities partials often need.
  handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
  handlebars.registerHelper("neq", (a: unknown, b: unknown) => a !== b);
  handlebars.registerHelper("not", (a: unknown) => !a);
  handlebars.registerHelper("coalesce", (...args: unknown[]) => {
    // Last arg is the Handlebars options object — drop it.
    const values = args.slice(0, -1);
    return values.find((v) => v !== null && v !== undefined && v !== "") ?? "";
  });

  registerTableHelpers(handlebars);
}

export { currencyHelper, dateHelper };
