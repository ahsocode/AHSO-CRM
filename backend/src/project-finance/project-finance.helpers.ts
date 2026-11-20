import { BadRequestException } from "@nestjs/common";
import type { CostGroup } from "@prisma/client";

/** Lowercase, strip Vietnamese diacritics and punctuation, collapse spaces. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COST_GROUPS: readonly CostGroup[] = [
  "MECHANICAL", "ELECTRICAL", "VISION", "SOFTWARE", "LABOR", "OUTSOURCE", "SHIPPING", "TRAVEL", "OTHER"
];

// Order matters: first match wins (travel/shipping before the generic "dien" keyword).
const CATEGORY_KEYWORDS: ReadonlyArray<readonly [CostGroup, readonly string[]]> = [
  ["TRAVEL", ["di lai", "cong tac", "grab", "taxi", "xang", "xang dau", "ve may bay", "ve tau", "khach san", "luu tru", "an uong", "nha hang", "travel", "gui xe", "parking", "phi cau duong", "cong tac phi"]],
  ["SHIPPING", ["van chuyen", "giao hang", "ship", "shipping", "freight", "logistics", "chuyen phat", "cuoc van chuyen"]],
  ["LABOR", ["nhan cong", "luong", "labor", "labour", "thue nhan cong"]],
  ["OUTSOURCE", ["thue ngoai", "gia cong", "outsource", "dich vu thue ngoai"]],
  ["SOFTWARE", ["phan mem", "software", "license", "ban quyen"]],
  ["VISION", ["vision", "camera", "thi giac"]],
  ["ELECTRICAL", ["dien", "dieu khien", "electrical", "plc", "tu dien"]],
  ["MECHANICAL", ["co khi", "mechanical", "khung", "gia cong co khi"]]
];

/** Maps a free-text category (Vietnamese or English) to a CostGroup; unknown values become OTHER. */
export function mapCostCategory(category: string | null | undefined): CostGroup {
  if (!category) return "OTHER";
  const upper = category.trim().toUpperCase();
  const exact = COST_GROUPS.find((group) => group === upper);
  if (exact) return exact;
  const hay = ` ${normalizeText(category)} `;
  for (const [group, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => hay.includes(` ${keyword} `))) return group;
  }
  return "OTHER";
}

const WEIGHT_SCALE = 1_000_000n;

function toScaledWeight(weight: number): bigint {
  if (!Number.isFinite(weight) || weight < 0) {
    throw new BadRequestException("Tỷ trọng phân bổ phải là số không âm");
  }
  return Number.isInteger(weight) ? BigInt(weight) * WEIGHT_SCALE : BigInt(Math.round(weight * 1e6));
}

/**
 * Splits an integer VND total by weights using the largest-remainder method (exact BigInt arithmetic),
 * so the parts always sum EXACTLY to `total`. Ties on remainder go to the earlier index.
 */
export function allocateLargestRemainder(total: number, weights: number[]): number[] {
  if (!Number.isInteger(total) || total < 0) {
    throw new BadRequestException("Tổng tiền phân bổ phải là số nguyên không âm");
  }
  const scaled = weights.map(toScaledWeight);
  const sum = scaled.reduce((acc, w) => acc + w, 0n);
  if (sum <= 0n) {
    throw new BadRequestException("Không có cơ sở phân bổ (tổng tỷ trọng bằng 0)");
  }
  const totalBig = BigInt(total);
  const floors = scaled.map((w) => (totalBig * w) / sum);
  const remainders = scaled.map((w) => (totalBig * w) % sum);
  let leftover = Number(totalBig - floors.reduce((acc, v) => acc + v, 0n));
  const order = scaled
    .map((_, index) => index)
    .filter((index) => scaled[index] > 0n)
    .sort((a, b) => (remainders[b] === remainders[a] ? a - b : remainders[b] > remainders[a] ? 1 : -1));
  const result = floors.map((v) => Number(v));
  for (let i = 0; leftover > 0; i = (i + 1) % order.length) {
    result[order[i]] += 1;
    leftover -= 1;
  }
  return result;
}

/** Share of each weight as a fraction rounded to 6 decimals (for display/storage). */
export function weightShares(weights: number[]): number[] {
  const scaled = weights.map(toScaledWeight);
  const sum = scaled.reduce((acc, w) => acc + w, 0n);
  if (sum <= 0n) return weights.map(() => 0);
  return scaled.map((w) => Number((w * 1_000_000n) / sum) / 1e6);
}

export function paginate(page?: number, limit?: number) {
  const p = Math.max(1, page ?? 1);
  const l = Math.min(200, Math.max(1, limit ?? 20));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function pageMeta(total: number, page: number, limit: number) {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function isUniqueViolation(error: unknown): boolean {
  return Boolean(error) && typeof error === "object" && (error as { code?: string }).code === "P2002";
}

export function dayAfter(date: Date): Date {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
