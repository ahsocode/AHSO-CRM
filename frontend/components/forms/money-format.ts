/**
 * Pure parse/format helpers for MoneyInput / NumberInput.
 * No DOM, no floating-point arithmetic: values are validated as digit strings
 * and only converted with Number() once they are proven <= MAX_SAFE_INTEGER.
 */

export type ParseFailure = "invalid" | "negative" | "overflow" | "too_many_decimals";

export type ParseResult =
  | { ok: true; value: number | undefined; text: string }
  | { ok: false; reason: ParseFailure };

const MAX_SAFE_DIGITS = String(Number.MAX_SAFE_INTEGER); // "9007199254740991"

/** True when a digit string (no sign, no separators) is larger than Number.MAX_SAFE_INTEGER. */
export function exceedsSafeInteger(digits: string): boolean {
  const d = digits.replace(/^0+(?=\d)/, "");
  if (d.length !== MAX_SAFE_DIGITS.length) return d.length > MAX_SAFE_DIGITS.length;
  return d > MAX_SAFE_DIGITS; // same length: lexicographic == numeric
}

/** Groups an unsigned digit string with "." (vi-VN). Does not use Intl (stable across ICU builds). */
function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 1234567 -> "1.234.567". undefined/null/NaN -> "". Non-integers are truncated toward zero. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const int = Math.trunc(value);
  if (int === 0) return "0";
  const body = groupDigits(String(Math.abs(int)));
  return int < 0 ? `-${body}` : body;
}

export interface ParseMoneyOptions {
  allowNegative?: boolean;
  /**
   * Paste mode: a trailing ",dd" / ".dd" (1-2 digits) is treated as a decimal fraction and dropped
   * (VND has no minor unit). NOT used while typing, otherwise Backspace on "1.234" -> "1.23" would
   * be misread as a fraction.
   */
  dropFraction?: boolean;
}

/**
 * Parses what a user typed/pasted into a VND integer.
 * "" -> undefined, "0" -> 0, "1.234.567" / "1,234,567" / "1 234 567 ₫" -> 1234567.
 */
export function parseMoney(raw: string, options: ParseMoneyOptions = {}): ParseResult {
  const { allowNegative = false, dropFraction = false } = options;
  let s = raw.replace(/[\s  ]/g, "").replace(/vnd|[₫đĐ]/gi, "");

  const negative = /^[-−]/.test(s);
  if (negative) {
    if (!allowNegative) return { ok: false, reason: "negative" };
    s = s.slice(1);
  }

  if (dropFraction) {
    const m = s.match(/^(.*\d)[.,]\d{1,2}$/);
    if (m) s = m[1];
  }

  const digits = s.replace(/[.,']/g, "");
  if (!/^\d*$/.test(digits)) return { ok: false, reason: "invalid" };
  if (digits === "") return { ok: true, value: undefined, text: negative ? "-" : "" };
  if (exceedsSafeInteger(digits)) return { ok: false, reason: "overflow" };

  const abs = Number(digits); // exact: proven <= MAX_SAFE_INTEGER
  const value = negative && abs !== 0 ? -abs : abs;
  return { ok: true, value, text: formatMoney(value) };
}

export interface ParseDecimalOptions {
  maxFractionDigits?: number;
  allowNegative?: boolean;
}

/** 1234.5 -> "1234,5" (vi-VN decimal comma, no grouping). */
export function formatDecimal(value: number | null | undefined, maxFractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  let s = String(value);
  if (/e/i.test(s)) {
    s = value.toFixed(Math.max(0, maxFractionDigits));
    if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  }
  return s.replace(".", ",");
}

/**
 * Parses a decimal typed/pasted by the user. Both "," and "." are accepted as the single decimal
 * separator ("2,5" and "2.5" -> 2.5). More than one separator is rejected (ambiguous grouping).
 * "" -> undefined; the returned `text` keeps in-progress input such as "1," or "-".
 */
export function parseDecimal(raw: string, options: ParseDecimalOptions = {}): ParseResult {
  const { maxFractionDigits = 2, allowNegative = false } = options;
  let s = raw.replace(/[\s  ]/g, "");

  const negative = /^[-−]/.test(s);
  if (negative) {
    if (!allowNegative) return { ok: false, reason: "negative" };
    s = s.slice(1);
  }

  const m = s.match(/^(\d*)(?:([.,])(\d*))?$/);
  if (!m) return { ok: false, reason: "invalid" };
  const int = m[1];
  const hasSep = m[2] !== undefined;
  const frac = m[3] ?? "";

  if (hasSep && maxFractionDigits <= 0) return { ok: false, reason: "invalid" };
  if (frac.length > maxFractionDigits) return { ok: false, reason: "too_many_decimals" };
  if (exceedsSafeInteger(int)) return { ok: false, reason: "overflow" };

  const sign = negative ? "-" : "";
  const intText = int.replace(/^0+(?=\d)/, "");
  const text = `${sign}${intText}${hasSep ? `,${frac}` : ""}`;

  if (int === "" && frac === "") return { ok: true, value: undefined, text };

  const abs = Number(`${int === "" ? "0" : int}${frac ? `.${frac}` : ""}`);
  if (!Number.isFinite(abs) || abs > Number.MAX_SAFE_INTEGER) return { ok: false, reason: "overflow" };
  const value = negative && abs !== 0 ? -abs : abs;
  return { ok: true, value, text };
}
