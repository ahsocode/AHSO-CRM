/**
 * Vietnamese number-to-words converter.
 *
 * Covers integers from 0 up to 999,999,999,999
 * (nine hundred ninety nine billion, i.e. 999 tỷ).
 *
 * Examples:
 *   0                 → "không"
 *   1                 → "một"
 *   15                → "mười lăm"
 *   21                → "hai mươi mốt"
 *   101               → "một trăm linh một"
 *   1_050_000         → "một triệu không trăm năm mươi nghìn"
 *   1_234_567         → "một triệu hai trăm ba mươi bốn nghìn năm trăm sáu mươi bảy"
 *   999_999_999_999   → "chín trăm chín mươi chín tỷ chín trăm chín mươi chín triệu..."
 */

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

/**
 * Read a 3-digit chunk (000-999).
 * When `isLeading` is false (i.e. not the first chunk), leading zeros are
 * spoken as "không trăm ..." to avoid losing scale information.
 */
function readChunk(n: number, isLeading: boolean): string {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;

  const parts: string[] = [];

  if (hundreds > 0) {
    parts.push(`${DIGITS[hundreds]} trăm`);
  } else if (!isLeading && (tens > 0 || ones > 0)) {
    // Mid-chunk: preserve the scale with "không trăm"
    parts.push("không trăm");
  }

  if (tens === 0) {
    if (ones > 0) {
      if (hundreds > 0 || !isLeading) {
        parts.push(`linh ${DIGITS[ones]}`);
      } else {
        parts.push(DIGITS[ones]);
      }
    }
  } else if (tens === 1) {
    parts.push("mười");
    if (ones === 5) {
      parts.push("lăm");
    } else if (ones > 0) {
      parts.push(DIGITS[ones]);
    }
  } else {
    parts.push(`${DIGITS[tens]} mươi`);
    if (ones === 1) {
      parts.push("mốt");
    } else if (ones === 5) {
      parts.push("lăm");
    } else if (ones === 4) {
      // 24 reads "hai mươi tư" conventionally; "bốn" is also accepted.
      // Use "tư" for the traditional reading.
      parts.push("tư");
    } else if (ones > 0) {
      parts.push(DIGITS[ones]);
    }
  }

  return parts.join(" ").trim();
}

export function numberToVietnameseWords(input: number): string {
  if (!Number.isFinite(input)) {
    return "";
  }

  let n = Math.floor(Math.abs(input));
  const isNegative = input < 0;

  if (n === 0) {
    return "không";
  }

  if (n > 999_999_999_999) {
    // Out of supported range
    throw new RangeError("Số vượt quá phạm vi hỗ trợ (999.999.999.999)");
  }

  // Break into [tỷ, triệu, nghìn, đơn vị] chunks of 3 digits each.
  const billions = Math.floor(n / 1_000_000_000);
  n -= billions * 1_000_000_000;
  const millions = Math.floor(n / 1_000_000);
  n -= millions * 1_000_000;
  const thousands = Math.floor(n / 1_000);
  const units = n - thousands * 1_000;

  const scales: Array<{ value: number; label: string }> = [
    { value: billions, label: "tỷ" },
    { value: millions, label: "triệu" },
    { value: thousands, label: "nghìn" },
    { value: units, label: "" }
  ];

  const parts: string[] = [];
  let hasSeenNonZero = false;
  for (const { value, label } of scales) {
    if (value === 0) {
      if (hasSeenNonZero) {
        // A zero chunk in the middle is spoken implicitly through readChunk's
        // "không trăm" mechanism only when the NEXT chunk has data. Skip.
        continue;
      }
      continue;
    }

    const chunk = readChunk(value, !hasSeenNonZero);
    parts.push(label ? `${chunk} ${label}` : chunk);
    hasSeenNonZero = true;
  }

  const result = parts.join(" ").replace(/\s+/g, " ").trim();
  return isNegative ? `âm ${result}` : result;
}

/**
 * Capitalize the first character (Vietnamese-safe: only Latin first letters
 * exist in the generator output, so String toUpperCase is fine).
 */
export function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
