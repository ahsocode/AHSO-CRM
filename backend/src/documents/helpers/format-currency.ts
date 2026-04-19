import { capitalizeFirst, numberToVietnameseWords } from "./number-to-words";

export type CurrencyMode = "default" | "short" | "words";

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    // Prisma Decimal compatibility
    const converter = (value as { toNumber?: () => number }).toNumber;
    if (typeof converter === "function") return converter.call(value);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDefault(n: number): string {
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0
  }).format(abs);
  return `${n < 0 ? "-" : ""}${formatted} VND`;
}

function formatShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    const value = abs / 1_000_000_000;
    return `${sign}${trimShort(value)} tỷ`;
  }
  if (abs >= 1_000_000) {
    const value = abs / 1_000_000;
    return `${sign}${trimShort(value)} triệu`;
  }
  if (abs >= 1_000) {
    const value = abs / 1_000;
    return `${sign}${trimShort(value)} nghìn`;
  }
  return `${sign}${abs.toFixed(0)}`;
}

function trimShort(n: number): string {
  // Round to 1 decimal, drop trailing zeros, use comma separator (VN).
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return rounded.toString();
  return rounded.toString().replace(".", ",");
}

function formatWords(n: number): string {
  const integer = Math.floor(Math.abs(n));
  const words = numberToVietnameseWords(integer);
  const withCurrency = `${words} đồng`;
  return capitalizeFirst(n < 0 ? `âm ${withCurrency}` : withCurrency);
}

/**
 * Handlebars helper: {{currency amount}} | {{currency amount "short"}} |
 * {{currency amount "words"}}
 */
export function currencyHelper(value: unknown, modeArg?: unknown): string {
  const n = toNumber(value);
  const mode: CurrencyMode =
    typeof modeArg === "string" && (modeArg === "short" || modeArg === "words")
      ? (modeArg as CurrencyMode)
      : "default";

  switch (mode) {
    case "short":
      return formatShort(n);
    case "words":
      return formatWords(n);
    case "default":
    default:
      return formatDefault(n);
  }
}
