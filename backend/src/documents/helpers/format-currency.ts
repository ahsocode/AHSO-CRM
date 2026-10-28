import { capitalizeFirst, numberToVietnameseWords } from "./number-to-words";

export type CurrencyMode = "default" | "short" | "words";

/** Printed for a missing amount: never "0" (audit E-06a, section 3.7). */
export const MISSING_AMOUNT = "—";

/** null / undefined / "" / non-numeric / non-finite => null (missing), never 0. */
export function toAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "bigint") n = Number(value);
  else if (typeof value === "object" && "toNumber" in value) {
    // Prisma Decimal compatibility
    const converter = (value as { toNumber?: () => number }).toNumber;
    if (typeof converter !== "function") return null;
    n = converter.call(value);
  } else n = Number(value);
  return Number.isFinite(n) ? n : null;
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

/**
 * Amount in words, " đồng" appended exactly once. Rounded like the figure printed next to it
 * (Intl rounds half away from zero) so "1.235 VND" never reads "một nghìn hai trăm ba mươi tư".
 * Never throws: an amount outside the supported range prints the missing marker.
 */
export function amountInWords(value: unknown): string {
  const n = toAmount(value);
  if (n === null) return MISSING_AMOUNT;
  const integer = Math.round(Math.abs(n));
  let words: string;
  try {
    words = numberToVietnameseWords(integer);
  } catch {
    return MISSING_AMOUNT;
  }
  if (!words) return MISSING_AMOUNT;
  const withCurrency = `${words} đồng`;
  return capitalizeFirst(n < 0 && integer > 0 ? `âm ${withCurrency}` : withCurrency);
}

/**
 * Handlebars helper: {{currency amount}} | {{currency amount "short"}} |
 * {{currency amount "words"}}
 */
export function currencyHelper(value: unknown, modeArg?: unknown): string {
  const mode: CurrencyMode =
    typeof modeArg === "string" && (modeArg === "short" || modeArg === "words")
      ? (modeArg as CurrencyMode)
      : "default";
  if (mode === "words") return amountInWords(value);
  const n = toAmount(value);
  if (n === null) return MISSING_AMOUNT;
  return mode === "short" ? formatShort(n) : formatDefault(n);
}
