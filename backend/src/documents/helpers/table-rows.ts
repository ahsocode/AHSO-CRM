/**
 * Line-item table helpers for Handlebars.
 *
 * - {{#eachWithIndex items}}…{{@index1}}…{{/eachWithIndex}}
 * - {{sum items "fieldName"}}
 * - {{subtotal items}}     → sum of (qty * unitPrice) over items
 * - {{vat amount rate}}    → amount * rate / 100
 * - {{grandTotal items rate}} → subtotal + vat
 */

type HandlebarsInstance = typeof import("handlebars");

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const converter = (value as { toNumber?: () => number }).toNumber;
    if (typeof converter === "function") return converter.call(value);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function registerTableHelpers(handlebars: HandlebarsInstance) {
  handlebars.registerHelper("eachWithIndex", function (
    this: unknown,
    items: unknown,
    options: Handlebars.HelperOptions
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      return options.inverse ? options.inverse(this) : "";
    }
    let out = "";
    for (let i = 0; i < items.length; i++) {
      out += options.fn(items[i], {
        data: options.data
          ? Object.assign({}, options.data, { index: i, index1: i + 1, first: i === 0, last: i === items.length - 1 })
          : undefined
      });
    }
    return out;
  });

  handlebars.registerHelper("sum", (items: unknown, field: unknown) => {
    if (!Array.isArray(items) || typeof field !== "string") return 0;
    return items.reduce((acc, item) => {
      if (!item || typeof item !== "object") return acc;
      return acc + toNumber((item as Record<string, unknown>)[field]);
    }, 0);
  });

  handlebars.registerHelper("subtotal", (items: unknown) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((acc, item) => {
      if (!item || typeof item !== "object") return acc;
      const record = item as Record<string, unknown>;
      const qty = toNumber(record.quantity ?? record.qty);
      const unitPrice = toNumber(record.unitPrice ?? record.unit_price ?? record.price);
      const lineTotal = toNumber(record.total);
      // Prefer explicit total when provided (Prisma rows usually precompute it).
      return acc + (lineTotal > 0 ? lineTotal : qty * unitPrice);
    }, 0);
  });

  handlebars.registerHelper("vat", (amount: unknown, rate: unknown) => {
    return (toNumber(amount) * toNumber(rate)) / 100;
  });

  handlebars.registerHelper("grandTotal", (items: unknown, rate: unknown) => {
    if (!Array.isArray(items)) return 0;
    const sub = items.reduce((acc, item) => {
      if (!item || typeof item !== "object") return acc;
      const record = item as Record<string, unknown>;
      const qty = toNumber(record.quantity ?? record.qty);
      const unitPrice = toNumber(record.unitPrice ?? record.unit_price ?? record.price);
      const lineTotal = toNumber(record.total);
      return acc + (lineTotal > 0 ? lineTotal : qty * unitPrice);
    }, 0);
    const r = toNumber(rate);
    return sub + (sub * r) / 100;
  });

  // Small arithmetic conveniences commonly needed in tables.
  handlebars.registerHelper("add", (a: unknown, b: unknown) => toNumber(a) + toNumber(b));
  handlebars.registerHelper("mul", (a: unknown, b: unknown) => toNumber(a) * toNumber(b));
}
