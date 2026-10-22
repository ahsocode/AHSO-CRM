#!/usr/bin/env python3
"""
AHSO CRM — static UI QA checks (cheap: no browser, no screenshots).

Each check encodes a bug class that actually reached CI or production:
  english     user-visible English left in JSX text/props            (B2/B9: 200+ strings)
  eyebrow     eyebrow label duplicating the heading right below it    (e2e strict-mode failure)
  e2e         e2e selector no longer in source / duplicated by change (2 CI failures)
  hex         hardcoded hex colors in className (Token Rule)
  money       VND formatted by hand instead of formatVND()
  fsync       file size on disk != readable bytes (exFAT/sandbox desync) and ._* junk

Usage:
  python3 static_checks.py                 # only files changed vs origin/main (fast, default)
  python3 static_checks.py --all           # whole frontend
  python3 static_checks.py --base HEAD~3   # compare against another ref
  python3 static_checks.py --only english,e2e

Exit code: 1 if any ERROR, 0 otherwise (WARN never fails).
Output is intentionally short: one line per finding.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip() or ".")
FRONTEND = ROOT / "frontend"
E2E = ROOT / "e2e"

# Fine in English on the UI (brands, standard tech terms).
KEEP = {
    "AHSO", "AHSO CRM", "AHSO CO.,LTD", "Dashboard", "Email", "Mailbox", "AI Agents", "AI", "Kanban",
    "CSV", "VAT", "MST", "PDF", "Excel", "OAuth", "ID", "URL", "API", "Logo", "Gmail", "Zalo", "SMTP",
    "IMAP", "Webhook", "Webhooks", "Admin", "Production", "Staging", "OK", "PO", "A4", "Esc",
    # font family names in the rich-text editor
    "Courier New", "Times New Roman", "Be Vietnam Pro",
    # company slogan printed under the company name on customer quotes (brand decision)
    "Automation Hub",
}
# English words that must not appear in user-facing text (whole word, case-insensitive).
ENGLISH_WORDS = re.compile(
    r"\b(activity|activities|timeline|ledger|desk|import|export|snapshot|identity|quotation|summary|"
    r"workspace|registry|signal|hub|preview|template|owner|project|customer|quote|contract|stage|lead|"
    r"milestone|delivery|overview|settings|upload|download|status|schema|field|fields|variant|funnel|"
    r"conversion|flow|prefill|route|phase|board|commercial|attachment|follow-up|chart|staff|save|"
    r"cancel|delete|edit|submit|loading|search|filter|details|new|add|back|next|previous)\b",
    re.I,
)
VIET = re.compile(r"[À-ỹĐđ]")
IGNORE_TEXT = {"document-preview", "Project 360 sections"}
TEXT_PROPS = r"eyebrow|label|title|description|placeholder|helper|hint|subtitle|emptyTitle|emptyDescription|aria-label|alt"
RE_PROP = re.compile(rf'\b({TEXT_PROPS})="([^"]+)"')
RE_JSX_TEXT = re.compile(r">\s*([A-Za-z][A-Za-z0-9 ,.&/+'’()-]{2,})\s*<")
# Title-Case multi-word English phrase in a string literal, e.g. {isNew ? "Quote Identity" : "..."}
# (missed by the two patterns above; cost a full QA round to find).
RE_LITERAL_PHRASE = re.compile(r"[\"'`]([A-Z][a-z]+(?: [A-Za-z][a-z]+){1,5})[\"'`]")
# JSX text next to an expression, any language: "{n} milestone</span>", "<p>Owner: {name}",
# "Thêm và điều chỉnh milestone ...". Caught only by the runtime e2e scan before.
RE_JSX_SEGMENT = re.compile(r"(?:>|\})([^<>{}\n`]*[A-Za-zÀ-ỹ][^<>{}\n`]*)(?=<|\{)")
RE_LOOKS_JSX = re.compile(r"</|/>|^\s*<[A-Za-z]|^\s*[^=<>]*\{[^}]*\}[^<>]*</")
# Template literal used as UI text: `${n} milestone còn mở`
RE_TEMPLATE = re.compile(r"`([^`]*)`")
# Vietnamese string literal containing an English word: "Phiên bản ... số quote ..."
RE_VI_LITERAL = re.compile(r"[\"']([^\"'\n]*[À-ỹĐđ][^\"'\n]*)[\"']")
# JSX text alone on its own line between tags:      Import CSV
RE_TEXT_LINE = re.compile(r"^\s*([A-Za-zÀ-ỹĐđ][^<>{}=;\"'`()]*[^\s<>{}=;,])\s*$")
SKIP_LITERAL_LINE = re.compile(
    r"^\s*(import|export type|type |interface |//|\*)|console\.|throw new|logger\.|queryKey|className="
    # bilingual document labels (vi + English) are intentionally English
    r"|\b(viEn|en|english|labelEn|titleEn)\s*:"
)

RE_EYEBROW = re.compile(r'^\s*<p className="[^"]*(?:uppercase|industrial-chip|v2-label)[^"]*">([^<{}]+)</p>\s*$')
RE_HEADING = re.compile(r"^\s*<(?:CardTitle|h[1-3])[^>]*>([^<{}]+)</(?:CardTitle|h[1-3])>\s*$")
RE_PROP_PAIR = re.compile(r'eyebrow="([^"]+)"[\s\S]{0,80}?title="([^"]+)"')

RE_HEX_CLASS = re.compile(r"(?:bg|text|border|ring|fill|stroke|from|to|via)-\[#[0-9A-Fa-f]{3,8}\]")
HEX_ALLOWED = ("app/global-error.tsx", "mailbox/_components/rich-text-editor.tsx", "lib/constants.ts")
RE_MONEY = re.compile(r"toLocaleString\([^)]*\)\s*\}?\s*(?:VND|VNĐ|đ|₫)|toLocaleString\(\)\s*\+\s*['\"]\s*(?:VND|đ)")

RE_E2E_LITERAL = re.compile(r'getBy(?:Text|Label|Placeholder|Title)\(\s*"([^"]+)"')
RE_E2E_NAME = re.compile(r'name:\s*"([^"]+)"')
# Regex selectors: getByText(/.../i), { name: /.../ } — a literal grep cannot see
# "/Export CSV \+ Excel/i", which let a label change break 3 e2e tests.
RE_E2E_REGEX = re.compile(r"(?:getBy(?:Text|Label|Placeholder|Title)\(\s*|name:\s*)/((?:\\/|[^/\n])+)/([a-z]*)")
E2E_NON_UI = {"ahso_refresh_token", "e2e-project-360.pdf"}


def sh(*args: str) -> str:
    return subprocess.run(list(args), capture_output=True, text=True, cwd=ROOT).stdout


def ui_files(only_changed: bool, base: str) -> list[Path]:
    if only_changed:
        names = sh("git", "diff", "--name-only", f"{base}...HEAD", "--", "frontend").split()
        names += sh("git", "diff", "--name-only", "--", "frontend").split()  # uncommitted
        names += sh("git", "ls-files", "--others", "--exclude-standard", "frontend").split()
        files = sorted({ROOT / n for n in names if n.endswith((".tsx", ".ts"))})
    else:
        files = sorted(
            p for p in FRONTEND.rglob("*.ts*")
            if "node_modules" not in p.parts and ".next" not in p.parts and not p.name.startswith("._")
        )
    return [
        f for f in files
        if f.exists() and not f.name.startswith("._") and "/components/ui/" not in str(f) and not f.name.endswith((".test.ts", ".test.tsx", ".d.ts"))
    ]


def rel(p: Path) -> str:
    return str(p.relative_to(FRONTEND)) if FRONTEND in p.parents else str(p.relative_to(ROOT))


def check_english(files: list[Path]) -> list[str]:
    out = []
    for f in files:
        if f.suffix != ".tsx":
            continue
        for i, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            cands = [m.group(2) for m in RE_PROP.finditer(line)] + [m.group(1) for m in RE_JSX_TEXT.finditer(line)]
            if not SKIP_LITERAL_LINE.search(line):
                cands += [m.group(1) for m in RE_LITERAL_PHRASE.finditer(line)]
                # template literals: drop ${...} parts, keep only if it reads like prose
                for m in RE_TEMPLATE.finditer(line):
                    t = re.sub(r"\$\{[^}]*\}", " ", m.group(1)).strip()
                    # prose only: no ids (`milestone-${i}-name`), paths, css selectors or class lists
                    if " " in t and not re.search(r"[/:=#.]|-\s|\s-|\b[a-z]+-[a-z]+\b", t):
                        cands.append(t)
            if not SKIP_LITERAL_LINE.search(line):
                # a "literal" that spans markup/code between two quotes is not UI text
                cands += [m.group(1) for m in RE_VI_LITERAL.finditer(line) if not re.search(r"[<>=]", m.group(1))]
            tl = RE_TEXT_LINE.match(line)
            if tl and f.suffix == ".tsx" and " " in tl.group(1) and not re.search(r"[.:?|\[\]&!]|\bnew\s+[A-Z]|\bthrow\b", tl.group(1)):
                cands.append(tl.group(1))
            if RE_LOOKS_JSX.search(line):
                for m in RE_JSX_SEGMENT.finditer(line):
                    seg = m.group(1).strip()
                    # attribute fragments (`isCompleted=`), call chains (`).format(`), selectors
                    if "=" in seg or seg[:1] in ").,(" or seg.endswith(("(", ",")):
                        continue
                    cands.append(seg)
            for c in cands:
                c = c.strip()
                if c in KEEP or c in IGNORE_TEXT or not ENGLISH_WORDS.search(c):
                    continue
                level = "WARN  loanword" if VIET.search(c) else "ERROR english "
                out.append(f"{level} {rel(f)}:{i}  {c[:90]}")
    return out


def check_eyebrow(files: list[Path]) -> list[str]:
    out = []
    for f in files:
        if f.suffix != ".tsx":
            continue
        src = f.read_text(encoding="utf-8", errors="ignore")
        lines = src.splitlines()
        for i in range(len(lines) - 1):
            e, h = RE_EYEBROW.match(lines[i]), RE_HEADING.match(lines[i + 1])
            if e and h:
                a, b = e.group(1).strip().lower(), h.group(1).strip().lower()
                if b == a or b.startswith(a + " "):
                    out.append(f"ERROR eyebrow  {rel(f)}:{i+1}  '{e.group(1).strip()}' duplicates heading '{h.group(1).strip()}'")
        for m in RE_PROP_PAIR.finditer(src):
            a, b = m.group(1).lower(), m.group(2).lower()
            if b == a or b.startswith(a + " "):
                out.append(f"ERROR eyebrow  {rel(f)}  eyebrow='{m.group(1)}' duplicates title='{m.group(2)}'")
    return out


def e2e_selectors() -> dict[str, list[str]]:
    sel: dict[str, list[str]] = {}
    for f in E2E.rglob("*.ts"):
        if f.name.startswith("._"):
            continue  # macOS AppleDouble junk on exFAT
        for i, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            for m in list(RE_E2E_LITERAL.finditer(line)) + list(RE_E2E_NAME.finditer(line)):
                sel.setdefault(m.group(1), []).append(f"{f.relative_to(ROOT)}:{i}")
    return sel


def count_in(text: str, s: str) -> int:
    return len(re.findall(r"([\"'`>]\s*)" + re.escape(s) + r"(\s*[\"'`<])", text))


def check_e2e(base: str) -> list[str]:
    out = []
    sel = e2e_selectors()
    head_files = {
        p: p.read_text(encoding="utf-8", errors="ignore")
        for p in FRONTEND.rglob("*.tsx")
        if "node_modules" not in p.parts and ".next" not in p.parts and not p.name.startswith("._")
    }
    all_src = "\n".join(head_files.values())
    # approximate rendered text: `${n} dự án` / {n} dự án → "1 dự án"
    src_rendered = re.sub(r"\$\{[^}]*\}|\{[^{}]*\}", "1", all_src)
    for f in E2E.rglob("*.ts"):
        if f.name.startswith("._"):
            continue
        for i, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if re.search(r"toHaveCount\(0\)|\.not\.", line):
                continue  # negative assertion: the text is supposed to be absent
            for m in RE_E2E_REGEX.finditer(line):
                body = m.group(1).replace("\\/", "/")
                core = body.lstrip("^").rstrip("$")
                if not re.search(r"[A-Za-zÀ-ỹ]{3,}", core):
                    continue  # too generic to verify statically
                try:
                    rx = re.compile(core, re.I if "i" in m.group(2) else 0)
                except re.error:
                    continue
                if not rx.search(all_src) and not rx.search(src_rendered):
                    out.append(f"ERROR e2e      regex selector /{body}/ matches nothing in frontend  ({f.relative_to(ROOT)}:{i})")
    for s, locs in sorted(sel.items()):
        if s in E2E_NON_UI:
            continue
        if s not in all_src:
            out.append(f"ERROR e2e      selector '{s}' no longer exists in frontend  ({locs[0]})")
            continue
        # strict-mode risk: the change made the selector appear more often inside one file
        for p, text in head_files.items():
            now = count_in(text, s)
            if now < 2:
                continue
            before_src = sh("git", "show", f"{base}:{p.relative_to(ROOT)}")
            before = count_in(before_src, s) if before_src else 0
            if now > before:
                out.append(f"WARN  e2e      '{s}' now appears {now}x in {rel(p)} (was {before}) — strict-mode risk at {locs[0]}")
    return out


def check_hex(files: list[Path]) -> list[str]:
    out = []
    for f in files:
        if any(str(f).endswith(a) for a in HEX_ALLOWED):
            continue
        for i, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            m = RE_HEX_CLASS.search(line)
            if m:
                out.append(f"WARN  hex      {rel(f)}:{i}  {m.group(0)} → use a token class")
    return out


def check_money(files: list[Path]) -> list[str]:
    out = []
    for f in files:
        for i, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if RE_MONEY.search(line):
                out.append(f"ERROR money    {rel(f)}:{i}  hand-formatted VND → formatVND()/formatVNDShort()")
    return out


def check_fsync() -> list[str]:
    out = []
    for root in ("frontend/app", "frontend/components", "frontend/lib", "frontend/hooks", "backend/src", "backend/prisma", "e2e"):
        for d, _, fs in os.walk(ROOT / root):
            if "node_modules" in d:
                continue
            for name in fs:
                p = Path(d) / name
                if name.startswith("._"):
                    out.append(f"WARN  fsync    macOS junk {p.relative_to(ROOT)} (delete it)")
                    continue
                try:
                    if p.stat().st_size != len(p.read_bytes()):
                        out.append(f"ERROR fsync    {p.relative_to(ROOT)} size on disk != readable bytes — rewrite the file from the Mac side")
                except OSError as e:
                    out.append(f"ERROR fsync    {p.relative_to(ROOT)} unreadable: {e}")
    return out


CHECKS = ("english", "eyebrow", "e2e", "hex", "money", "fsync")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="scan whole frontend instead of changed files")
    ap.add_argument("--base", default="origin/main", help="git ref to diff against (default origin/main)")
    ap.add_argument("--only", default=",".join(CHECKS))
    a = ap.parse_args()
    only = set(a.only.split(","))
    files = ui_files(not a.all, a.base)

    results: list[str] = []
    if "fsync" in only: results += check_fsync()
    if "english" in only: results += check_english(files)
    if "eyebrow" in only: results += check_eyebrow(files)
    if "money" in only: results += check_money(files)
    if "hex" in only: results += check_hex(files)
    if "e2e" in only: results += check_e2e(a.base)

    errors = sum(r.startswith("ERROR") for r in results)
    warns = len(results) - errors
    scope = "all frontend files" if a.all else f"{len(files)} changed file(s) vs {a.base}"
    for r in results:
        print(r)
    print(f"static_checks: {errors} error(s), {warns} warning(s) — scope: {scope}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
