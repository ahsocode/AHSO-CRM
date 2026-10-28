#!/usr/bin/env node
// VAT correction for existing quotes (AHSO 2026 policy: 8%, software lines KCT).
// Default = DRY-RUN (GET only). See README.md. Node 20+, built-ins only.
//   node scripts/vat-correction/vat-correction.mjs [--apply] [--yes] [--only BG-2026-061,BG-2026-078]
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { planQuote, buildPatchBody, EDITABLE_STATUSES } from "./classify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------- args / env ----------
function parseArgs(argv) {
  const args = { apply: false, yes: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--yes") args.yes = true;
    else if (a === "--only" || a.startsWith("--only=")) {
      const v = a.includes("=") ? a.slice(7) : argv[++i];
      if (!v) fail("--only cần danh sách số báo giá, ví dụ --only BG-2026-061,BG-2026-078");
      args.only = new Set(v.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (a === "--help" || a === "-h") {
      console.log("node scripts/vat-correction/vat-correction.mjs [--apply] [--yes] [--only BG-...,BG-...]");
      process.exit(0);
    } else fail(`Tham số không hợp lệ: ${a}`);
  }
  if (args.yes && !args.apply) fail("--yes chỉ dùng cùng --apply");
  return args;
}

function fail(msg) {
  console.error(`\n[LỖI] ${msg}`);
  process.exit(1);
}

function readEnv() {
  const missing = ["CRM_BASE_URL", "CRM_EMAIL", "CRM_PASSWORD"].filter((k) => !process.env[k]);
  if (missing.length) fail(`Thiếu biến môi trường: ${missing.join(", ")}`);
  let base = process.env.CRM_BASE_URL.replace(/\/+$/, "");
  // mcp-server convention: CRM_BASE_URL is the site root and /api is appended. Accept both forms.
  if (!/\/api$/.test(base)) base = `${base}/api`;
  return { base, email: process.env.CRM_EMAIL, password: process.env.CRM_PASSWORD };
}

// ---------- HTTP ----------
class HttpError extends Error {
  constructor(method, path, status, message) {
    super(`${method} ${path} -> HTTP ${status}: ${message}`);
    this.status = status;
  }
}

function makeClient(env) {
  let token = null;

  async function raw(method, path, body, auth = true) {
    let res;
    try {
      res = await fetch(`${env.base}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(auth && token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new Error(`${method} ${path}: không kết nối được tới CRM (${e.cause?.code ?? e.message})`);
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    if (!res.ok) {
      const msg = json?.message ? [].concat(json.message).join("; ") : text.slice(0, 200) || res.statusText;
      const details = Array.isArray(json?.errors) && json.errors.length ? ` | ${JSON.stringify(json.errors).slice(0, 500)}` : "";
      throw new HttpError(method, path, res.status, msg + details);
    }
    return json;
  }

  async function login() {
    const json = await raw("POST", "/auth/login", { email: env.email, password: env.password }, false).catch((e) => {
      if (e instanceof HttpError && e.status === 401) throw new Error("Đăng nhập thất bại: sai CRM_EMAIL/CRM_PASSWORD");
      throw e;
    });
    token = json?.data?.accessToken;
    if (!token) throw new Error("Đăng nhập: phản hồi không có data.accessToken");
  }

  async function call(method, path, body) {
    if (method === "DELETE") throw new Error("Script này không bao giờ gọi DELETE");
    try {
      return await raw(method, path, body);
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) { // access token 15 min: re-login once
        await login();
        return raw(method, path, body);
      }
      throw e;
    }
  }

  return { login, get: (p) => call("GET", p), patch: (p, b) => call("PATCH", p, b) };
}

// ---------- data ----------
async function listAllQuotes(api) {
  const all = [];
  for (let page = 1; page < 10_000; page++) {
    const json = await api.get(`/quotes?page=${page}&limit=100`);
    const items = Array.isArray(json?.data) ? json.data : [];
    all.push(...items);
    const totalPages = Number(json?.meta?.totalPages ?? 1);
    if (page >= totalPages || items.length === 0) break;
  }
  return all;
}

async function getDetail(api, id) {
  const json = await api.get(`/quotes/${encodeURIComponent(id)}`);
  if (!json?.data?.id) throw new Error(`GET /quotes/${id}: phản hồi không có data`);
  return json.data;
}

const money = (n) => (n === null || n === undefined ? "" : Number(n).toLocaleString("en-US"));
const customerOf = (q) => q.project?.customer?.shortName || q.project?.customer?.name || "";

function buildRow(detail) {
  const plan = planQuote(detail);
  return {
    id: detail.id,
    quoteNo: detail.quoteNo,
    status: detail.status,
    customer: customerOf(detail),
    updatedAt: detail.updatedAt,
    category: plan.category,
    currentTotal: plan.currentTotal,
    newTotal: plan.newTotal,
    delta: plan.delta,
    kctLines: plan.kctLines,
    newRates: plan.newItems.map((i) => i.taxRate)
  };
}

function printTable(rows) {
  const headers = ["quoteNo", "status", "customer", "currentTotal", "newTotal", "delta", "category"];
  const data = rows.map((r) => [r.quoteNo, r.status, r.customer.slice(0, 24), money(r.currentTotal), money(r.newTotal), (r.delta > 0 ? "+" : "") + money(r.delta), r.category]);
  const widths = headers.map((h, i) => Math.max(h.length, ...data.map((d) => String(d[i]).length)));
  const right = new Set([3, 4, 5]);
  const fmt = (cells) => cells.map((c, i) => (right.has(i) ? String(c).padStart(widths[i]) : String(c).padEnd(widths[i]))).join("  ");
  console.log(fmt(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (let i = 0; i < rows.length; i++) {
    console.log(fmt(data[i]));
    for (const l of rows[i].kctLines) {
      console.log(`    KCT: ${l.name} — ${money(l.amount)}${l.alreadyKct ? " (đã là KCT sẵn)" : ""}`);
    }
  }
  const count = (c) => rows.filter((r) => r.category === c).length;
  console.log(`\nTổng: ${rows.length} báo giá | WILL_CHANGE ${count("WILL_CHANGE")} | SKIP_LOCKED ${count("SKIP_LOCKED")} | SKIP_MIXED ${count("SKIP_MIXED")} | NO_CHANGE ${count("NO_CHANGE")}`);
  if (count("SKIP_LOCKED")) console.log("SKIP_LOCKED (SENT/ACCEPTED/EXPIRED) KHÔNG bao giờ bị sửa; newTotal chỉ để Henry tham khảo.");
}

function safeFileName(s) {
  return String(s).replace(/[^A-Za-z0-9._-]/g, "_");
}

// ---------- apply ----------
async function confirm(n) {
  if (!process.stdin.isTTY) fail("Không có terminal tương tác để xác nhận. Chạy trong terminal hoặc thêm --yes.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nSẽ PATCH ${n} báo giá trên CRM thật. Gõ đúng số ${n} để tiếp tục: `);
  rl.close();
  if (answer.trim() !== String(n)) fail("Xác nhận không khớp. Không thay đổi gì.");
}

async function applyOne(api, row) {
  const tag = `[${row.quoteNo}]`;
  // 1) re-GET and check nothing changed since dry-run
  const before = await getDetail(api, row.id);
  if (!EDITABLE_STATUSES.includes(before.status)) {
    console.log(`${tag} BỎ QUA: trạng thái đã đổi thành ${before.status}`);
    return "skipped";
  }
  if (before.updatedAt !== row.updatedAt) {
    console.log(`${tag} BỎ QUA: updatedAt đã đổi (${row.updatedAt} -> ${before.updatedAt}), có người vừa sửa`);
    return "skipped";
  }
  const plan = planQuote(before);
  if (plan.category !== "WILL_CHANGE" || plan.newTotal !== row.newTotal) {
    console.log(`${tag} BỎ QUA: kế hoạch thay đổi so với dry-run (${plan.category}, ${money(plan.newTotal)})`);
    return "skipped";
  }
  // 2) backup
  let backupPath = join(HERE, `backup-${safeFileName(before.quoteNo)}.json`);
  if (existsSync(backupPath)) { // never overwrite an older backup
    backupPath = join(HERE, `backup-${safeFileName(before.quoteNo)}-${Date.now()}.json`);
  }
  writeFileSync(backupPath, JSON.stringify(before, null, 2), { flag: "wx" });
  // 3) PATCH full body
  const body = buildPatchBody(before, plan.newItems);
  await api.patch(`/quotes/${encodeURIComponent(before.id)}`, body);
  // 4) verify
  const after = await getDetail(api, before.id);
  const afterRates = [...after.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((i) => (i.taxRate === null ? null : Number(i.taxRate)));
  const ratesOk = JSON.stringify(afterRates) === JSON.stringify(plan.newItems.map((i) => i.taxRate));
  if (Number(after.total) !== plan.newTotal || !ratesOk || after.items.length !== before.items.length) {
    console.error(`\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
    console.error(`${tag} SAI LỆCH SAU KHI GHI: server total ${money(after.total)} vs tính ${money(plan.newTotal)}; rates ${JSON.stringify(afterRates)}`);
    console.error(`Backup trước khi sửa: ${backupPath}. DỪNG, không xử lý báo giá nào khác.`);
    console.error(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
    process.exit(2);
  }
  console.log(`${tag} OK: ${money(row.currentTotal)} -> ${money(after.total)} (backup ${backupPath.split("/").pop()})`);
  return "changed";
}

// ---------- main ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = readEnv();
  const api = makeClient(env);
  console.log(`Chế độ: ${args.apply ? "APPLY (ghi dữ liệu)" : "DRY-RUN (chỉ đọc)"} | API: ${env.base}`);

  await api.login();
  const list = await listAllQuotes(api);
  const targets = args.only ? list.filter((q) => args.only.has(q.quoteNo)) : list;
  if (args.only) {
    const found = new Set(targets.map((q) => q.quoteNo));
    const missing = [...args.only].filter((n) => !found.has(n));
    if (missing.length) console.log(`Không tìm thấy: ${missing.join(", ")}`);
  }

  const rows = [];
  for (const q of targets) rows.push(buildRow(await getDetail(api, q.id)));
  rows.sort((a, b) => String(a.quoteNo).localeCompare(String(b.quoteNo)));

  printTable(rows);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(HERE, `report-${stamp}.json`);
  writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), mode: args.apply ? "apply" : "dry-run", rows }, null, 2));
  console.log(`Báo cáo: ${reportPath}`);

  if (!args.apply) {
    console.log("\nDRY-RUN: không có gì bị thay đổi. Thêm --apply để ghi.");
    return;
  }

  const toChange = rows.filter((r) => r.category === "WILL_CHANGE");
  if (toChange.length === 0) return console.log("\nKhông có báo giá nào cần sửa.");
  if (!args.yes) await confirm(toChange.length);

  let changed = 0, skipped = 0;
  for (const row of toChange) {
    const result = await applyOne(api, row);
    if (result === "changed") changed++; else skipped++;
  }
  console.log(`\nXong: đã sửa ${changed}, bỏ qua ${skipped}.`);
}

main().catch((e) => fail(e.message));
