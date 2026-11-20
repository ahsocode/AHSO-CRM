import type { JwtUser } from "../auth/auth.types";
import { removeDiacritics } from "../common/utils/vietnamese";

/**
 * Normalised form of a supplier item name: lowercase, no diacritics,
 * punctuation removed, whitespace collapsed. Used as the alias lookup key.
 */
export function normalizeItemName(input: string | null | undefined): string {
  return removeDiacritics(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Compact code form used to compare item codes ("AB-12 / x" -> "ab12x"). */
export function normalizeItemCode(input: string | null | undefined): string {
  return (input ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Tax code as stored on receipts (spaces removed, same convention as stock-receipts). */
export function cleanTaxCode(input: string | null | undefined): string {
  return (input ?? "").replace(/\s+/g, "");
}

/** True when two tax codes denote the same company (branch suffix "-001" ignored). */
export function isSameTaxCode(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = (a ?? "").replace(/\D/g, "").slice(0, 10);
  const db = (b ?? "").replace(/\D/g, "").slice(0, 10);
  return da.length > 0 && da === db;
}

export function composeInvoiceNo(series: string | null | undefined, number: string): string {
  return series ? `${series}-${number}` : number;
}

/** Parses "C26TAA-0000123" into { series, number }; null when there is no separator. */
export function parseInvoiceRef(ref: string): { series: string; number: string } | null {
  const trimmed = ref.trim();
  const idx = trimmed.lastIndexOf("-");
  if (idx <= 0 || idx === trimmed.length - 1) return null;
  return { series: trimmed.slice(0, idx).trim(), number: trimmed.slice(idx + 1).trim() };
}

/** Name similarity 0..1 on normalised names (token overlap + containment). Capped below 1. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeItemName(a);
  const nb = normalizeItemName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 0.99;
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  let inter = 0;
  for (const token of ta) if (tb.has(token)) inter += 1;
  const union = ta.size + tb.size - inter;
  const jaccard = union === 0 ? 0 : inter / union;
  const containment = inter / Math.min(ta.size, tb.size);
  const substring = na.includes(nb) || nb.includes(na) ? 0.8 : 0;
  return Math.min(0.95, Math.max(jaccard, containment * 0.85, substring));
}

export function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002");
}

/**
 * User id to store in FK "created by" columns. Machine tokens carry sub="service:<id>" (not a User row),
 * so the token owner (ownerUserId) is used instead; audit logs still record the service actor.
 */
export function actorUserId(user: JwtUser): string {
  const owner = (user as JwtUser & { ownerUserId?: string }).ownerUserId;
  return owner ?? user.sub;
}
