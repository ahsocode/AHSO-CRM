// Pure helpers for the VAT correction script. No I/O here: everything is unit-tested.
// Policy (AHSO 2026): default VAT 8%; software lines are KCT (null) and excluded from the VAT base.

export const NEW_DEFAULT_RATE = 8;
export const OLD_BACKFILL_RATE = 10;
export const EDITABLE_STATUSES = ["DRAFT", "REJECTED"];

const KCT_PREFIXES = ["phần mềm", "chương trình"].map((p) => p.normalize("NFC"));

function normalizeName(name) {
  return String(name ?? "").normalize("NFC").trim().toLocaleLowerCase("vi");
}

/** Guess KCT iff the name STARTS WITH "Phần mềm"/"Chương trình", or contains "(KCT)". */
export function isLikelyKct(name) {
  const n = normalizeName(name);
  if (n.includes("(kct)")) return true;
  return KCT_PREFIXES.some((prefix) => n.startsWith(prefix));
}

function normalizeRate(rate) {
  if (rate === null || rate === undefined) return null;
  const n = Number(rate);
  if (!Number.isFinite(n)) throw new Error(`Thuế suất không hợp lệ: ${rate}`);
  return n;
}

function lineTotal(line) {
  return Math.round(Number(line.quantity) * Number(line.unitPrice));
}

// round(base * rate / 100), half-up, in BigInt so huge bases cannot lose precision.
function groupTax(base, rate) {
  if (rate === null) return 0;
  const rateHundredths = BigInt(Math.round(rate * 100)); // rate has at most 2 decimals
  const numerator = BigInt(base) * rateHundredths; // base * rate * 100
  const denominator = 10000n;
  const q = numerator / denominator;
  const r = numerator % denominator;
  const rounded = r * 2n >= denominator ? q + 1n : q;
  return Number(rounded);
}

/**
 * Replicates backend buildQuoteTotals: lineTotal = round(qty*price), group by rate
 * (null = KCT), tax rounded once per group, KCT tax 0.
 * lines: [{ quantity, unitPrice, taxRate }]
 */
export function computeTotals(lines) {
  const groups = new Map();
  for (const line of lines) {
    const rate = normalizeRate(line.taxRate);
    groups.set(rate, (groups.get(rate) ?? 0) + lineTotal(line));
  }
  const breakdown = [...groups.entries()]
    .map(([rate, base]) => ({ rate, base, tax: groupTax(base, rate) }))
    .sort((a, b) => (a.rate === null ? 1 : b.rate === null ? -1 : b.rate - a.rate));
  const subtotal = breakdown.reduce((s, g) => s + g.base, 0);
  const taxAmount = breakdown.reduce((s, g) => s + g.tax, 0);
  return { subtotal, taxAmount, total: subtotal + taxAmount, breakdown };
}

/** New rate for one line: existing KCT stays KCT, guessed software -> KCT, everything else -> 8. */
export function targetRateFor(item) {
  if (normalizeRate(item.taxRate) === null) return null;
  return isLikelyKct(item.name) ? null : NEW_DEFAULT_RATE;
}

/**
 * Classify one quote detail (shape of GET /quotes/:id data).
 * Returns { category, currentTotal, newTotal, delta, kctLines, newItems }.
 */
export function planQuote(quote) {
  const items = [...(quote.items ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const currentTotal = Number(quote.total);
  const newItems = items.map((item) => ({ ...item, taxRate: targetRateFor(item) }));
  const newTotal = computeTotals(newItems).total;
  const rates = items.map((item) => normalizeRate(item.taxRate));
  const kctLines = newItems
    .map((item, i) => ({ name: item.name, amount: lineTotal(item), alreadyKct: rates[i] === null, kct: item.taxRate === null }))
    .filter((line) => line.kct)
    .map(({ kct, ...line }) => line);
  const unchanged =
    Number(quote.taxRate) === NEW_DEFAULT_RATE &&
    rates.every((rate, i) => rate === newItems[i].taxRate) &&
    newTotal === currentTotal;
  const mixed = rates.some((rate) => rate !== null && rate !== OLD_BACKFILL_RATE);

  let category;
  if (!EDITABLE_STATUSES.includes(quote.status)) category = "SKIP_LOCKED";
  else if (unchanged) category = "NO_CHANGE";
  else if (mixed) category = "SKIP_MIXED";
  else category = "WILL_CHANGE";

  return { category, currentTotal, newTotal, delta: newTotal - currentTotal, kctLines, newItems };
}

const optionalText = (v) => (typeof v === "string" && v.trim().length > 0 ? v : undefined);

/**
 * Full PATCH body for updateQuoteSchema (= createQuoteSchema). Null optional fields are
 * OMITTED (not sent as null): the schema rejects null strings, and a null validUntil would
 * be coerced to 1970-01-01. Omitted = Prisma leaves the stored value unchanged.
 */
export function buildPatchBody(quote, newItems) {
  const body = {
    projectId: quote.project?.id ?? quote.projectId,
    taxRate: NEW_DEFAULT_RATE,
    status: quote.status,
    items: newItems.map((item) => {
      const out = {
        name: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: item.taxRate
      };
      if (optionalText(item.description) !== undefined) out.description = item.description;
      if (optionalText(item.unit) !== undefined) out.unit = item.unit;
      if (optionalText(item.bomId) !== undefined) out.bomId = item.bomId;
      return out;
    })
  };
  if (!body.projectId) throw new Error(`Báo giá ${quote.quoteNo}: thiếu projectId`);
  if (quote.validUntil) body.validUntil = quote.validUntil;
  if (quote.tableColumnWidths && typeof quote.tableColumnWidths === "object") body.tableColumnWidths = quote.tableColumnWidths;
  for (const key of ["terms", "deliveryTerms", "internalNote"]) {
    if (optionalText(quote[key]) !== undefined) body[key] = quote[key];
  }
  return body;
}
