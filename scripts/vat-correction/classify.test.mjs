import { test } from "node:test";
import assert from "node:assert/strict";
import { isLikelyKct, computeTotals, planQuote, buildPatchBody } from "./classify.mjs";

test("KCT: names starting with Phần mềm / Chương trình or containing (KCT)", () => {
  for (const name of [
    "Phần mềm giám sát thao tác (KCT)",
    "Chương trình điều khiển PLC, HMI",
    "Phần mềm web quản lý, cơ sở dữ liệu",
    "Chương trình PLC/HMI điều khiển và giám sát biến tần",
    "  phần mềm viết thường có khoảng trắng",
    "Thiết bị X (kct)",
    // NFD (decomposed) input must match too
    "Phần mềm giám sát".normalize("NFD")
  ]) {
    assert.equal(isLikelyKct(name), true, name);
  }
});

test("NOT KCT: phần mềm only appears later in the name", () => {
  for (const name of [
    "Máy đếm sản phẩm sử dụng camera và phần mềm AI",
    "Máy chủ label, training mã hàng mới và phần mềm Dashboard",
    "Máy kiểm tra ký tự OCR in trên túi bánh",
    "Nhân công lắp đặt điện",
    "",
    null
  ]) {
    assert.equal(isLikelyKct(name), false, String(name));
  }
});

const L = (amount, taxRate) => ({ quantity: 1, unitPrice: amount, taxRate });

const cases = [
  ["BG-2026-073", [L(46_000_000, 8), L(69_000_000, null), L(180_000_000, 8)], 295_000_000, 313_080_000],
  [
    "BG-2026-058",
    [L(20_160_000, 8), L(8_730_000, 8), L(4_520_000, 8), L(550_000, 8), L(1_140_000, 8), L(25_000_000, null), L(39_000_000, null), L(5_000_000, 8), L(13_900_000, 8)],
    118_000_000,
    122_320_000
  ],
  ["BG-2026-059", [L(1_035_000, 8), L(850_000, 8), L(21_000_000, 8), L(19_000_000, null), L(1_500_000, 8), L(6_000_000, 8)], 49_385_000, 51_815_800],
  ["BG-2026-061", [L(66_550_000, 8)], 66_550_000, 71_874_000],
  ["BG-2026-078", [L(186_000_000, 8)], 186_000_000, 200_880_000]
];

for (const [quoteNo, lines, subtotal, total] of cases) {
  test(`computeTotals ${quoteNo}`, () => {
    const t = computeTotals(lines);
    assert.equal(t.subtotal, subtotal);
    assert.equal(t.total, total);
  });
}

test("computeTotals: tax rounded per group (half-up), 8 and '8.00' same group, qty*price rounded", () => {
  const t = computeTotals([
    { quantity: 1, unitPrice: 1_000_006, taxRate: 8 },
    { quantity: 1, unitPrice: 1, taxRate: "8.00" },
    { quantity: 0.5, unitPrice: 3, taxRate: 10 } // round(1.5) = 2
  ]);
  assert.equal(t.breakdown.length, 2);
  assert.equal(t.breakdown[0].rate, 10);
  assert.equal(t.breakdown[1].tax, 80001); // 1_000_007 * 8% = 80000.56 -> 80001
  assert.equal(t.subtotal, 1_000_009);
  assert.equal(t.total, 1_000_009 + 80001 + 0);
});

test("computeTotals: 0% is not KCT but both have zero tax", () => {
  const t = computeTotals([L(100, 0), L(100, null)]);
  assert.deepEqual(t.breakdown.map((g) => g.rate), [0, null]);
  assert.equal(t.total, 200);
});

const quote = (status, rates, extra = {}) => ({
  id: "q",
  quoteNo: "BG-X",
  status,
  taxRate: 10,
  total: 0,
  project: { id: "p1" },
  items: rates.map((taxRate, i) => ({ id: `i${i}`, order: i, name: i === 1 ? "Phần mềm A" : "Máy B", quantity: 1, unitPrice: 1_000_000, taxRate })),
  ...extra
});

test("planQuote categories", () => {
  assert.equal(planQuote(quote("DRAFT", [10, 10])).category, "WILL_CHANGE");
  assert.equal(planQuote(quote("REJECTED", [10, 10])).category, "WILL_CHANGE");
  for (const s of ["SENT", "ACCEPTED", "EXPIRED", "SOMETHING_NEW"]) {
    assert.equal(planQuote(quote(s, [10, 10])).category, "SKIP_LOCKED", s);
  }
  assert.equal(planQuote(quote("DRAFT", [10, 5])).category, "SKIP_MIXED");
  assert.equal(planQuote(quote("DRAFT", [8, null], { taxRate: 8, total: 2_080_000 })).category, "NO_CHANGE");
});

test("planQuote: new rates and totals; existing KCT line is kept KCT", () => {
  const p = planQuote(quote("DRAFT", [10, 10, null], { total: 2_200_000 }));
  assert.deepEqual(p.newItems.map((i) => i.taxRate), [8, null, null]);
  assert.equal(p.newTotal, 3_080_000);
  assert.equal(p.kctLines.length, 2);
});

test("buildPatchBody keeps item order/fields and omits nulls", () => {
  const q = quote("REJECTED", [10, 10], { validUntil: null, terms: "T", internalNote: null, tableColumnWidths: { index: 5 } });
  q.items[0].description = "d";
  q.items[0].bomId = "b1";
  q.items[1].unit = null;
  const p = planQuote(q);
  const body = buildPatchBody(q, p.newItems);
  assert.equal(body.status, "REJECTED");
  assert.equal(body.taxRate, 8);
  assert.equal(body.projectId, "p1");
  assert.equal("validUntil" in body, false);
  assert.equal("internalNote" in body, false);
  assert.equal(body.terms, "T");
  assert.deepEqual(body.tableColumnWidths, { index: 5 });
  assert.deepEqual(body.items[0], { name: "Máy B", quantity: 1, unitPrice: 1_000_000, taxRate: 8, description: "d", bomId: "b1" });
  assert.deepEqual(body.items[1], { name: "Phần mềm A", quantity: 1, unitPrice: 1_000_000, taxRate: null });
});
