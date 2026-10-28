export type DateMode = "short" | "long" | "long-body" | "long-en" | "iso" | "year";

/** Every printed date is a Vietnamese calendar date, independent of the container TZ (audit E-08). */
export const DOCUMENT_TIME_ZONE = "Asia/Ho_Chi_Minh";

const PARTS_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: DOCUMENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Day / month / year of `d` as seen in Asia/Ho_Chi_Minh (zero padded). */
export function vietnamDateParts(d: Date): { day: string; month: string; year: string } {
  const parts = PARTS_FORMAT.formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: pick("day"), month: pick("month"), year: pick("year") };
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

const MODES: DateMode[] = ["short", "long", "long-body", "long-en", "iso", "year"];

/**
 * Handlebars helper: {{date d}} (dd/MM/yyyy) | {{date d "long"}} (ngày dd tháng MM năm yyyy)
 * | {{date d "long-body"}} (dd tháng MM năm yyyy — for sentences that already say "ngày")
 * | {{date d "long-en"}} | {{date d "iso"}} | {{date d "year"}} (yyyy).
 */
export function dateHelper(value: unknown, modeArg?: unknown): string {
  const d = toDate(value);
  if (!d) return "";
  const mode: DateMode = typeof modeArg === "string" && MODES.includes(modeArg as DateMode) ? (modeArg as DateMode) : "short";
  if (mode === "iso") return d.toISOString();
  const { day, month, year } = vietnamDateParts(d);
  switch (mode) {
    case "long":
      return `ngày ${day} tháng ${month} năm ${year}`;
    case "long-body":
      return `${day} tháng ${month} năm ${year}`;
    case "long-en":
      return `${EN_MONTHS[Number(month) - 1]} ${day}, ${year}`;
    case "year":
      return year;
    case "short":
    default:
      return `${day}/${month}/${year}`;
  }
}
