export type DateMode = "short" | "long" | "long-en" | "iso";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatShort(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatLongVi(d: Date): string {
  return `ngày ${pad2(d.getDate())} tháng ${pad2(d.getMonth() + 1)} năm ${d.getFullYear()}`;
}

const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function formatLongEn(d: Date): string {
  return `${EN_MONTHS[d.getMonth()]} ${pad2(d.getDate())}, ${d.getFullYear()}`;
}

/**
 * Handlebars helper: {{date d}} | {{date d "long"}} | {{date d "long-en"}}
 * | {{date d "iso"}}
 */
export function dateHelper(value: unknown, modeArg?: unknown): string {
  const d = toDate(value);
  if (!d) return "";

  const mode: DateMode =
    typeof modeArg === "string" &&
    (modeArg === "long" || modeArg === "long-en" || modeArg === "iso" || modeArg === "short")
      ? (modeArg as DateMode)
      : "short";

  switch (mode) {
    case "long":
      return formatLongVi(d);
    case "long-en":
      return formatLongEn(d);
    case "iso":
      return d.toISOString();
    case "short":
    default:
      return formatShort(d);
  }
}
