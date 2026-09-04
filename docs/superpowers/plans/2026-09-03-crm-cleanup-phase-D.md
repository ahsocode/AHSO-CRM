# CRM Cleanup Phase D — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the code-quality backlog from the 2026-09-03 cleanup review (report section D): shrink god-files, de-duplicate STAFF row-scoping, modernise a handful of lint escapes, archive stale docs, and triage dependency vulnerabilities — with zero behaviour change.

**Architecture:** Every task is a refactor guarded by the existing test suites (`backend`: Jest, 50 suites / 207 tests; `frontend`: Vitest, 8 suites / 29 tests; `mcp-server`: `tsc`). The gate for each task is "same green suite before and after, typecheck clean, lint clean" — not new failing tests. God-file splits move whole methods/components into collaborator files behind the *same public signatures*; no logic is rewritten in the same commit as a move.

**Tech Stack:** NestJS 10 + Prisma 5 (backend), Next.js 14 App Router + Vitest (frontend), TypeScript strict everywhere, ESLint (`backend/.eslintrc.cjs`, `frontend/.eslintrc.json`).

**Spec:** This plan's source is the "D. Refactor / dead-code" section of the cleanup report delivered in the session on 2026-09-03. Reproduced inline under each phase.

## Status (2026-09-03)

- **Phase 1 (D6/D5/D4)** — ✅ done. Commits `02d1321`, `ec524d7`, `27d2a62`.
  - Task 1: 13 docs → `docs/archive/` + `docs/README.md`. `docs/PROJECT_STRUCTURE.md` kept — it has **diverged** from the workspace-root `AHSO-CRM-PROJECT_STRUCTURE.md` (not a duplicate); reconcile-into-one is a **follow-up**.
  - Task 2: roles table stays on its own header — verified genuinely different (no pagination/filters); documented in code.
  - Task 3: no `<img>` converted — traced every site, none is a safe/beneficial `next/image` swap (blob URLs, cross-origin, caller-sized). Every `eslint-disable` comment now states the reason.
- **Phase 2 (D2)** — ✅ done. Commits `f458bba`, `dc0fcd6`, `100abc3`. `scopeCustomerWhereToUser()` in `common/scoping/`, adopted in 6 services. Per user decision, `assignedTo:{isActive:true}` was **unified onto projects + reports** (was bare `assignedToId`) — result-equivalent, now consistent. `calendar.service` left alone (different OR-shape). +4 tests.
- **Phase 3 (D7)** — ✅ done. Commit `e356dca`. `npm audit fix` (no `--force`): mcp 9→0, backend 56→30, frontend 56→42. Residual all major-bump; triaged in `docs/security/2026-09-audit-triage.md` with priority-ordered follow-up tickets.
- **Phase 4 (D1)** — mostly done:
  | File | Before | After | Status |
  |---|--:|--:|---|
  | 4c `document-layout-renderer.service.ts` | 1048 | **730** | ✅ under threshold. CSS + helpers + columns extracted (`7c51e52`, `a720904`). Remaining flow/interpolation clusters optional. |
  | 4d `customers.service.ts` | 1062 | 1045 | ~ mapProjectProgress deduped into `common/utils/project-progress` (`c25f3e6`); has **no unit spec** so deeper splitting deferred. |
  | 4e `reports.service.ts` | 1104 | **892** | ✅ helpers + where-builders extracted (`bb1245e`, `a816196`). |
  | 4f `contracts.service.ts` | 1112 | **923** | ✅ helpers + where-builders (`ce6a05d`). |
  | 4g `quotes.service.ts` | 1116 | **850** | ✅ helpers + where-builders; `syncProjectStatusForQuote` kept in service (`3fbf1ba`). |
  | 4h `projects.service.ts` | 2739 | 2367 | mappers + where-builders extracted (`0401611`). **Still over threshold** — needs a collaborator-service split (ProjectDocumentsService / ProjectMaterialAllocationService / ProjectTimelineService / ProjectPaymentsService); that is a large, status-sync-sensitive job for its own session with the "assert stageChangedAt fires" test written first. |
  | 4a `project-detail-client.tsx` | 2733 | 2006 | constants + file-utils + 10 leaf primitives extracted (`9a752aa`, `b0036c9`). Remaining: 13 panel components (`DocumentsPanel` ~700 LOC). Frontend has **no test coverage** for this file — compiler-only verification; recommend doing the panel moves with a browser click-through available. |
  | 4b `quote-detail-client.tsx` | 1059 | 1059 | not started (frontend, same no-test caveat). |

### Security follow-ups — done ahead of the deferred queue (2026-09-03)

`nodemailer` 8→9 (`54621c8`), `bcrypt` 5→6 (`d2b4079`), `@tiptap/*` 3.23→3.31 (`e543452`). Backend audit 30→27 (**0 critical**); frontend 42→12 (only devDep `vitest` critical left). See `docs/security/2026-09-audit-triage.md`. Still queued: `@anthropic-ai/sdk`, NestJS 10→12, Next 14→16. **Manual mailbox rich-text editor smoke test still pending** (tiptap major-minor bump).

### Remaining Phase D work

1. **4h collaborator-service split** — the one backend god-file still over threshold; large + status-sync-sensitive.
2. **4a / 4b frontend panel splits** — 13 + N components; no test net, best done with a running app.
3. **4c flow/interpolation clusters** — optional, 4c is already under threshold.
4. Reconcile the two `PROJECT_STRUCTURE.md` files.
5. Security queue: `@anthropic-ai/sdk`, NestJS 10→12, Next 14→16.

### Follow-ups discovered during execution

1. Reconcile `docs/PROJECT_STRUCTURE.md` ↔ root `AHSO-CRM-PROJECT_STRUCTURE.md` into one canonical file.
2. Security tickets from `docs/security/2026-09-audit-triage.md`: nodemailer 8→9, `@tiptap/*` cluster → latest 3.x, bcrypt 5→6, `@anthropic-ai/sdk` bump, NestJS 10→12, Next 14→16 (+ proxy rate-limit on `/_next/image` interim).
3. exFAT drive zeroed `backend/src/common/scoping/customer-scope.ts` during heavy `npm audit fix` I/O (restored from git). Consider moving the working copy off `/Volumes/TRANSCEND` to an APFS location.

## Global Constraints

- **No `any`.** Backend and frontend are `tsc --noEmit` strict. Use `unknown` + narrowing, generated Prisma types (`Prisma.XWhereInput`, `Prisma.DateTimeFilter`), or a named local type.
- **No behaviour change in this plan.** Any task that would change an API response, a query result, or rendered output is out of scope — stop and raise it.
- **UI strings stay Vietnamese;** code identifiers and comments English (per `CLAUDE.md` §5 Text Rule).
- **No new npm dependencies** without explicit approval (`CLAUDE.md` §10).
- **Commit message style:** Conventional Commits, body explains *why*, footer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **Branch:** work on `main` is acceptable for this repo (solo-team convention observed in history), one push per task or per small task-group. Run the full suite before every push.
- **`Project.status` writes** must keep `stageChangedAt = new Date()` (`CLAUDE.md` / PROJECT_STRUCTURE §3.2) — relevant if any move touches `projects.service` status paths.
- **Stock decrement** must stay behind `InventoryBalanceService` — relevant to the material-allocation split.

---

## Phase 1 — Quick wins (D5, D6, D4)

Small, independent, low-risk. Do these first to clear noise.

### Task 1: Archive stale `docs/` files (D6)

**Report item D6:** `docs/` holds 19 files; 16 predate June and are completed plans/reviews. `docs/PROJECT_STRUCTURE.md` overlaps the root `AHSO-CRM-PROJECT_STRUCTURE.md`.

**Files:**
- Create: `docs/archive/` (directory)
- Move into `docs/archive/`: `AGENT_HANDOFF.md`, `BLUEPRINT.md`, `COMPLETION_SUMMARY.md`, `DEPLOYMENT_EXECUTIVE_SUMMARY.md`, `DEPLOYMENT_INDEX.md`, `DEPLOYMENT_READINESS_ASSESSMENT.md`, `DOCUMENT_TEMPLATES_PLAN.md`, `FIXES_AND_TESTING_GUIDE.md`, `PROJECT_REVIEW_REPORT.md`, `PWA_MOBILE_PLAN.md`, `REVIEW_2026-04-24.md`, `admin-panel-verification.md`, `AGENT_BUSINESS_DOCUMENTS_PAGE.md`
- Keep in `docs/`: `PRODUCTION_DEPLOYMENT_CHECKLIST.md`, `PROJECT_STRUCTURE.md`, the `AHSO_STANDARD_CONTRACT_TEMPLATE_VN.*` set, `MASTER_CONTRACT_TEMPLATE_VN.md`, `design/` (screenshots)
- Modify: `docs/PROJECT_STRUCTURE.md` — both files open with the same `# AHSO CRM — Project Structure & AI Coding Guide` heading and are near-duplicates. `diff` them; if ≥80% redundant, replace this file's body with a one-line pointer to the root `AHSO-CRM-PROJECT_STRUCTURE.md`. If they have genuinely diverged, reconcile into the root copy and still leave only a pointer here (single source of truth).

**Interfaces:**
- Consumes: nothing
- Produces: `docs/archive/` as the home for completed planning docs; later tasks may drop their own superseded notes there

- [ ] **Step 1: Confirm nothing references the moved paths**

```bash
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM
grep -rn --include='*.md' --include='*.ts' --include='*.tsx' --include='*.yml' \
  -E 'docs/(AGENT_HANDOFF|BLUEPRINT|COMPLETION_SUMMARY|DEPLOYMENT_|DOCUMENT_TEMPLATES_PLAN|FIXES_AND_TESTING_GUIDE|PROJECT_REVIEW_REPORT|PWA_MOBILE_PLAN|REVIEW_2026-04-24|admin-panel-verification|AGENT_BUSINESS_DOCUMENTS_PAGE)' \
  . || echo "no inbound references — safe to move"
```
Expected: `no inbound references — safe to move` (if any hit, update that link in the same task)

- [ ] **Step 2: Create the archive and move files**

```bash
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM/docs
mkdir -p archive
git mv AGENT_HANDOFF.md BLUEPRINT.md COMPLETION_SUMMARY.md \
  DEPLOYMENT_EXECUTIVE_SUMMARY.md DEPLOYMENT_INDEX.md DEPLOYMENT_READINESS_ASSESSMENT.md \
  DOCUMENT_TEMPLATES_PLAN.md FIXES_AND_TESTING_GUIDE.md PROJECT_REVIEW_REPORT.md \
  PWA_MOBILE_PLAN.md REVIEW_2026-04-24.md admin-panel-verification.md \
  AGENT_BUSINESS_DOCUMENTS_PAGE.md archive/
```

- [ ] **Step 3: Add `docs/README.md` index**

```markdown
# AHSO CRM — docs/

Active references:

- `PROJECT_STRUCTURE.md` — module map (see also root `AHSO-CRM-PROJECT_STRUCTURE.md`, `AHSO-CRM-TECH-STACK.md`)
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md` — release runbook
- `MASTER_CONTRACT_TEMPLATE_VN.md`, `AHSO_STANDARD_CONTRACT_TEMPLATE_VN.*` — legal templates
- `design/` — reference screenshots

`archive/` holds completed plans and point-in-time reviews kept for history.
```

- [ ] **Step 4: Verify build/docs tooling unaffected**

```bash
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM/backend && npm run build
```
Expected: EXIT 0 (templates in `src/documents/templates/`, not `docs/`, so this is just a smoke check)

- [ ] **Step 5: Commit**

```bash
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM
git add docs
git commit -m "docs: archive completed plans and reviews under docs/archive/

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Put `admin/roles/role-table.tsx` on the shared `LedgerHeader` (D5)

**Report item D5:** 15 of 16 `*-table.tsx` use `LedgerHeader` (from the Aug-13 "Unify ledger filter toolbars" refactor). Only `frontend/app/(dashboard)/admin/roles/_components/role-table.tsx` still hand-rolls its header.

**Files:**
- Modify: `frontend/app/(dashboard)/admin/roles/_components/role-table.tsx`
- Reference (read first, copy the pattern): `frontend/components/shared/ledger-header.tsx`, plus one adopter e.g. `frontend/app/(dashboard)/suppliers/_components/supplier-table.tsx`
- Test: `frontend/app/(dashboard)/admin/roles/_components/` — add `role-table.test.tsx` only if the component has extractable pure logic; otherwise rely on typecheck + visual parity

**Interfaces:**
- Consumes: `LedgerHeader` props contract as defined in `frontend/components/shared/ledger-header.tsx` (read the file for the exact prop names — do not guess)
- Produces: nothing downstream

- [ ] **Step 1: Read the target and the pattern**

```bash
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM/frontend
sed -n '1,120p' components/shared/ledger-header.tsx
sed -n '1,120p' 'app/(dashboard)/suppliers/_components/supplier-table.tsx'
cat 'app/(dashboard)/admin/roles/_components/role-table.tsx'
```

- [ ] **Step 2: Decide — is this table structurally a "ledger" table?**

If the roles table has a fundamentally different shape (no filter toolbar, admin-only actions), the right answer may be **"leave it"** with a one-line code comment explaining why. Record the decision. If it fits, continue.

- [ ] **Step 3: Swap the hand-rolled header for `LedgerHeader`**

Replace the bespoke header markup with `<LedgerHeader …/>` using the exact props from Step 1. Keep every existing column, action, and string identical.

- [ ] **Step 4: Typecheck + lint + unit**

```bash
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM/frontend
npm run typecheck && npx next lint && npm run test:unit
```
Expected: all EXIT 0

- [ ] **Step 5: Visual parity check**

```bash
npm run build
```
Expected: EXIT 0. Then eyeball `/admin/roles` in `npm run dev` — header spacing, filter, and actions match the other ledger pages.

- [ ] **Step 6: Commit**

```bash
git add 'app/(dashboard)/admin/roles/_components/role-table.tsx'
git commit -m "refactor(frontend): use shared LedgerHeader in roles table

Last table still hand-rolling its header; align with the 15 others.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Replace `<img>` lint escapes with `next/image` where safe (D4)

**Report item D4:** 6 `// eslint-disable-next-line @next/next/no-img-element`. The 2 `no-extend-native` disables in `app/polyfills.ts` are legitimate and stay.

**Files (each is an independent decision):**
- `frontend/app/(dashboard)/projects/_components/project-detail-client.tsx:2360`
- `frontend/app/(dashboard)/admin/company-info/_components/logo-uploader.tsx:109`
- `frontend/app/(dashboard)/admin/document-templates/_components/template-canvas.tsx:110`
- `frontend/app/(dashboard)/surveys/_components/survey-media-gallery.tsx:117`
- `frontend/components/shared/avatar-initials.tsx:36`
- Test: existing Vitest suites; `components/shared/deleted-records-panel.test.tsx` is the pattern for a shared-component test

**Interfaces:**
- Consumes: `next/image` `<Image>` API (already a transitive dep via `next`, no install)
- Produces: nothing downstream

**Rule for each site:** `next/image` needs known dimensions and an allowed domain (`next.config.js` `images`). Convert **only** when the source is a local/public asset or an already-sized data URL. For user-uploaded blobs of unknown size, a plain `<img>` with the disable comment is the correct call — leave it, but tighten the comment to say why.

- [ ] **Step 1: Read `next.config.mjs` image config + each call site**

```bash
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM/frontend
sed -n '1,60p' next.config.mjs
for f in 'app/(dashboard)/projects/_components/project-detail-client.tsx' \
  'app/(dashboard)/admin/company-info/_components/logo-uploader.tsx' \
  'app/(dashboard)/admin/document-templates/_components/template-canvas.tsx' \
  'app/(dashboard)/surveys/_components/survey-media-gallery.tsx' \
  'components/shared/avatar-initials.tsx'; do echo "=== $f ==="; grep -n -B4 -A6 'no-img-element' "$f"; done
```

- [ ] **Step 2: Convert the safe sites**

Likely convertible: `avatar-initials.tsx` (fixed-size avatar), `logo-uploader.tsx` preview if size is fixed. Likely leave: `template-canvas.tsx` (free-form canvas), `survey-media-gallery.tsx` (arbitrary upload dimensions), the `project-detail-client.tsx` site (inline doc thumbnail). For each converted site use `<Image width={..} height={..} alt=".." />` with the dimensions already in the surrounding CSS.

- [ ] **Step 3: For sites left as `<img>`, upgrade the comment**

```tsx
// Intentional <img>: user-uploaded media of unknown intrinsic size; next/image
// would require width/height we don't have. eslint-disable-next-line @next/next/no-img-element
```

- [ ] **Step 4: Typecheck + lint + build + unit**

```bash
npm run typecheck && npx next lint && npm run test:unit && npm run build
```
Expected: all EXIT 0, lint warning count for `no-img-element` reduced

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(frontend): use next/image for fixed-size images

Convert the avatar and logo-preview <img> tags to next/image; keep plain
<img> (with a clearer reason) only where upload dimensions are unknown.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Phase 2 — Shared STAFF row-scoping helper (D2)

**Report item D2:** STAFF users only see their own customers' data. The rule `where.assignedToId = user.sub; where.assignedTo = { isActive: true }` (and the "project belongs to an accessible customer" variant) is re-implemented in ~7 services. Centralise it.

**Confirmed call sites (from `grep -n 'if (isStaff(user))' backend/src/**/*.service.ts`):**

| File | Line | Current block |
|---|---|---|
| `customers/customers.service.ts` | 722 | `where.assignedToId = user.sub; where.assignedTo = { isActive: true }` |
| `quotes/quotes.service.ts` | 775 | `customerWhere.assignedToId = user.sub; customerWhere.assignedTo = { isActive: true }` |
| `contracts/contracts.service.ts` | 597 | `customerWhere.assignedToId = user.sub; customerWhere.assignedTo = { isActive: true }` |
| `projects/projects.service.ts` | 2157 | `customerWhere.assignedToId = user.sub` |
| `ai/ai.service.ts` | 560 | `where.assignedToId = user.sub; where.assignedTo = { isActive: true }` |
| `reports/reports.service.ts` | 714, 776 | `where.assignedToId = user.sub` (+ builder variants at 705–775) |
| `calendar/calendar.service.ts` | 125 | bespoke `OR` across `userId` / `customer.assignedToId` — **out of scope**, different shape |

**Files:**
- Create: `backend/src/common/scoping/customer-scope.ts`
- Create: `backend/src/common/scoping/customer-scope.spec.ts`
- Modify: the 6 in-scope service files above (not `calendar`)
- Reference: `backend/src/auth/auth.types.ts` (`isStaff`, `JwtUser`)

**Interfaces:**
- Produces:
  ```typescript
  // backend/src/common/scoping/customer-scope.ts
  import type { Prisma } from "@prisma/client";
  import { JwtUser, isStaff } from "../../auth/auth.types";

  /**
   * Mutates `where` so a STAFF user only matches customers assigned to them
   * (and active). No-op for ADMIN/MANAGER. Returns `where` for chaining.
   */
  export function scopeCustomerWhereToUser(
    where: Prisma.CustomerWhereInput,
    user: JwtUser,
  ): Prisma.CustomerWhereInput;

  /**
   * Same rule expressed against a *nested* customer relation filter, e.g.
   * `projectWhere.customer = scopeAccessibleCustomerRelation(user)`.
   * Returns `undefined` for non-STAFF (caller should skip assignment).
   */
  export function accessibleCustomerRelationFilter(
    user: JwtUser,
  ): Prisma.CustomerWhereInput | undefined;
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/common/scoping/customer-scope.spec.ts
import { scopeCustomerWhereToUser, accessibleCustomerRelationFilter } from "./customer-scope";
import type { JwtUser } from "../../auth/auth.types";

const staff = { sub: "u1", role: "STAFF", permissions: [] } as unknown as JwtUser;
const manager = { sub: "u2", role: "MANAGER", permissions: [] } as unknown as JwtUser;

describe("scopeCustomerWhereToUser", () => {
  it("restricts a STAFF user to their own active customers", () => {
    const where = scopeCustomerWhereToUser({ deletedAt: null }, staff);
    expect(where).toEqual({ deletedAt: null, assignedToId: "u1", assignedTo: { isActive: true } });
  });

  it("is a no-op for MANAGER/ADMIN", () => {
    const where = scopeCustomerWhereToUser({ deletedAt: null }, manager);
    expect(where).toEqual({ deletedAt: null });
  });
});

describe("accessibleCustomerRelationFilter", () => {
  it("returns the assigned+active filter for STAFF", () => {
    expect(accessibleCustomerRelationFilter(staff)).toEqual({ assignedToId: "u1", assignedTo: { isActive: true } });
  });
  it("returns undefined for non-STAFF", () => {
    expect(accessibleCustomerRelationFilter(manager)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

```bash
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM/backend
npx jest --config jest.config.cjs --runInBand src/common/scoping -v
```
Expected: FAIL — `Cannot find module './customer-scope'`

- [ ] **Step 3: Implement the helper**

```typescript
// backend/src/common/scoping/customer-scope.ts
import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../../auth/auth.types";

export function scopeCustomerWhereToUser(
  where: Prisma.CustomerWhereInput,
  user: JwtUser,
): Prisma.CustomerWhereInput {
  if (isStaff(user)) {
    where.assignedToId = user.sub;
    where.assignedTo = { isActive: true };
  }
  return where;
}

export function accessibleCustomerRelationFilter(
  user: JwtUser,
): Prisma.CustomerWhereInput | undefined {
  if (!isStaff(user)) {
    return undefined;
  }
  return { assignedToId: user.sub, assignedTo: { isActive: true } };
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx jest --config jest.config.cjs --runInBand src/common/scoping -v
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit the helper alone**

```bash
git add src/common/scoping
git commit -m "feat(backend): add shared customer row-scoping helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Adopt in `customers.service.ts`**

At line ~722 replace:
```typescript
if (isStaff(user)) {
  where.assignedToId = user.sub;
  where.assignedTo = { isActive: true };
}
```
with:
```typescript
scopeCustomerWhereToUser(where, user);
```
Add the import. Remove the now-unused `isStaff` import **only if** no other use remains in the file (grep first).

- [ ] **Step 7: Run the customers suite**

```bash
npx jest --config jest.config.cjs --runInBand src/customers -v
```
Expected: PASS, unchanged count

- [ ] **Step 8: Adopt in `quotes`, `contracts`, `projects`, `ai`, `reports` — one service per commit**

For each: swap the block, fix imports, run that service's suite (`npx jest … src/<svc>`), commit:
```bash
git commit -m "refactor(backend): use scopeCustomerWhereToUser in <svc> service

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
For `quotes`/`contracts`/`projects` the variable is `customerWhere` and some sites want `accessibleCustomerRelationFilter(user)` assigned onto a nested `customer:` relation — read each site and pick the matching helper. For `reports` the builder methods (`buildCustomerWhere`, `buildProjectWhere`, …) at 705–775 each get the one-line swap.

- [ ] **Step 9: Full backend gate + push**

```bash
npm run typecheck && npm run lint && npm test
```
Expected: typecheck 0, lint 0, 211 tests pass (207 + 4 new). Then `git push origin main`.

---

## Phase 3 — Dependency vulnerability triage (D7)

**Report item D7:** `npm audit` — backend 56 findings (2 critical), frontend 56 (1 critical). This phase **triages and patches only what is safe**; it does not force major upgrades.

**Files:**
- Modify: `backend/package.json`, `backend/package-lock.json`, `frontend/package.json`, `frontend/package-lock.json`
- Create: `docs/security/2026-09-audit-triage.md`

**Interfaces:** none (dependency-only)

- [ ] **Step 1: Capture the current audit as JSON**

```bash
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM/backend && npm audit --json > /tmp/audit-backend.json; \
cd ../frontend && npm audit --json > /tmp/audit-frontend.json
cd .. && npx --yes npm-audit-resolver@ nonexistent 2>/dev/null || true   # do NOT install; just note tools exist
```

- [ ] **Step 2: Classify each advisory**

Write `docs/security/2026-09-audit-triage.md` with a table: advisory, package, path, severity, **runtime-reachable? (prod dep vs devDep vs transitive build-only)**, fix available (patch/minor/major/none), decision. Critical + prod-runtime first.

- [ ] **Step 3: Apply non-breaking fixes**

```bash
cd backend && npm audit fix && npm run typecheck && npm test
cd ../frontend && npm audit fix && npm run typecheck && npm run test:unit && npm run build
```
`npm audit fix` **without** `--force`. If a fix bumps a direct dep's minor version, verify that dep's changelog for breaking notes before keeping it.

- [ ] **Step 4: Record what's left**

For every advisory not fixed, the triage doc states why (devDep only, no patch available, major-version breaking change deferred to its own ticket). Nothing is silently ignored.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM
git add backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json docs/security
git commit -m "chore(deps): apply non-breaking npm audit fixes, triage the rest

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: (Optional, separate approval) major-version security bumps**

Any advisory that only a major bump fixes gets its own follow-up plan — not this one.

---

## Phase 4 — God-file splits (D1)

**Report item D1:** eight files over ~1000 LOC. Each split is an independent unit of work with its own risk profile. **Each file below becomes its own detailed plan** (`docs/superpowers/plans/2026-XX-XX-split-<file>.md`) written just before execution, because the method-by-method move list must be verified against the file's then-current state. This section fixes the *approach, order, and seams* so those sub-plans are quick to write.

### Shared methodology (applies to every split task)

1. **Never move + edit in one commit.** Commit 1 = pure move (cut method, paste into new file, re-export, fix imports). Commit 2+ (optional, later) = any cleanup.
2. **Keep the public class/signature.** Consumers (`*.controller.ts`, other services) must not change. A god `FooService` keeps its methods; the body delegates to an injected collaborator (`FooDocumentsService`, …) registered in the same `*.module.ts`.
3. **Gate:** `npm run typecheck && npm run lint && npx jest … src/<module>` green before *and* after every commit; full `npm test` green before push.
4. **Move private helpers with their only caller.** If two collaborators need one helper, it goes to a `*/<module>.helpers.ts` module-scoped file.
5. **Frontend:** each `*Panel` / sub-component moves to its own file under `_components/`; the page component keeps its name and props.

### Order (lowest risk → highest)

| # | File | LOC | Seams (verified 2026-09-03) | Risk |
|---|---|---|---|---|
| 4a | `frontend/.../projects/_components/project-detail-client.tsx` | 2733 | Already 20+ standalone `*Panel`/card fns in one file: `OverviewPanel`, `AiForecastCard`, `ProjectStageStepper`, `TimelinePanel`, `SurveysPanel`, `DocumentsPanel`, `QuotesPanel`, `ContractsPanel`, `DeliveryPanel`, `PaymentsPanel`, `MaterialsPanel`, `HandoverPanel` + small presentational (`MetricCard`, `MiniPanel`, …). Move each to `_components/panels/<kebab>.tsx`; shared bits to `_components/panels/shared.tsx`. Pure import churn. | Low (thin FE tests — do a manual click-through of every tab) |
| 4b | `frontend/.../quotes/_components/quote-detail-client.tsx` | 1059 | Same pattern as 4a. | Low |
| 4c | `backend/src/documents/document-layout-renderer.service.ts` | 1048 | Renderer with template-type branches; split per document family or extract the layout primitives to `document-layout/*.ts`. Strong existing test coverage (`*.spec.ts` ×7 in `src/documents`). | Low-Med |
| 4d | `backend/src/customers/customers.service.ts` | 1066 | Public seam: core CRUD (`findAll/findOne/create/update/remove/restore/findDeleted/bulk`) vs **dedupe/merge** (`findDuplicates`, `merge`, `getQuarterStart`) vs **stats** (`getStats`, `mapProjectProgress`). → `CustomersService` + `CustomerDedupeService` + `CustomerStatsService`. | Med |
| 4e | `backend/src/reports/reports.service.ts` | 1107 | 13 `getX` report methods + 8 `buildXWhere` builders + aggregation helpers. → keep `ReportsService` as facade; extract `ReportWhereBuilders` (the `buildXWhere` set, post-Phase-2) and group report methods (`OverviewReports`, `JourneyReports`, `FunnelCohortReports`). | Med |
| 4f | `backend/src/contracts/contracts.service.ts` | 1118 | CRUD vs **milestones** (`createMilestone`, `updateMilestone`, `resolveMilestoneCompletedAt`, `mapMilestone`) vs **payments** (`createPayment`) vs **quote-item mapping** (`resolveSelectedQuoteItems`, `calculateContractValueFromQuoteItems`, `mapContractItem`). → `ContractsService` + `MilestonesService` + `ContractItemsService`. Watch the Contract→Project status sync (`syncProjectStatusForContract`). | Med-High |
| 4g | `backend/src/quotes/quotes.service.ts` | 1124 | CRUD vs **lifecycle** (`send`, `duplicate`, `updateStatus`, `resolveQuoteStatusPayload`, `calculateAcceptedQuoteTotal`) vs **totals/layout** (`buildQuoteTotals`, `normalizeQuoteTableColumnWidths`, `buildTableColumnWidthsPayload`, `buildQuoteItemsCreateInput`). → `QuotesService` + `QuoteLifecycleService` + `QuoteCalcService`. Watch Quote→Project status sync (`syncProjectStatusForQuote`) and `acceptedItemIds`. | High |
| 4h | `backend/src/projects/projects.service.ts` | 2739 | Verified method map: **core** (`findAll/create/findOne/update/updateStatus/remove/restore/findDeleted/bulk` + `buildWhere/buildDeletedWhere/mapProjectListItem/resolveNextCompletedAt/buildCompletedAtUpdate`); **timeline** (`getTimeline`); **documents** (`getDocuments`, `updateDocumentPlan`, `generateDocumentPlan`, `mapBusinessDocument*`, `resolveProjectDocumentSource`); **surveys** (`getSurveys`); **handover** (`createHandover`, `mapHandover`); **payments** (`createPayment`, `assertPaymentLimit`); **material allocation** (`getEligibleStockLots`, `getMaterialAllocation`, `upsertMaterialAllocation`, `confirmMaterialAllocation`, `materialAllocationInclude`, `mapStockLot`, `mapMaterialAllocation`, `generateNextIssueNo`). → `ProjectsService` facade + `ProjectDocumentsService` + `ProjectMaterialAllocationService` + `ProjectTimelineService` + `ProjectPaymentsService`. **Critical:** every `Project.status` write keeps `stageChangedAt`; allocation stays behind `InventoryBalanceService`; `updateStatus` is called by `quotes.service` & `contracts.service` sync paths — signature must not move. | High |

### Task 4a (fully specced — template for the rest)

**Files:**
- Create: `frontend/app/(dashboard)/projects/_components/panels/overview-panel.tsx`, `.../timeline-panel.tsx`, `.../surveys-panel.tsx`, `.../documents-panel.tsx`, `.../quotes-panel.tsx`, `.../contracts-panel.tsx`, `.../delivery-panel.tsx`, `.../payments-panel.tsx`, `.../materials-panel.tsx`, `.../handover-panel.tsx`, `.../ai-forecast-card.tsx`, `.../project-stage-stepper.tsx`, `.../shared.tsx` (for `MetricCard`, `MiniPanel`, `MiniInfo`, `DocumentStat`, `ActionSignal`, `TimelineItemLink`, `FileActionButtons`, `GeneratedDocumentRow`, `DocumentRow`, `SurveyMediaCard`)
- Modify: `frontend/app/(dashboard)/projects/_components/project-detail-client.tsx` (drops to the `ProjectDetailClient` shell + its imports)
- Test: `frontend/app/(dashboard)/projects/_components/panels/` — no new unit tests (these are view components); the gate is typecheck + build + manual tab click-through

**Interfaces:**
- Consumes: `useProject` hook return type (already imported), `ProjectStatus`, `SurveyMedia`, `GeneratedProjectDocument` types from wherever the file currently imports them
- Produces: one named export per file, e.g. `export function OverviewPanel(props: { … })` with **the exact prop shape the function has today** — copy it verbatim, do not redesign

- [ ] **Step 1: Baseline green**

```bash
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM/frontend
npm run typecheck && npm run test:unit && npm run build
```
Expected: all EXIT 0. Record the build's route size for `/projects/[id]`.

- [ ] **Step 2: Move the leaf presentational components first**

Cut `MetricCard`, `MiniPanel`, `MiniInfo`, `DocumentStat`, `MiniInfo`, `SurveyMediaCard`, `FileActionButtons`, `GeneratedDocumentRow`, `DocumentRow`, `TimelineItemLink`, `ActionSignal` into `panels/shared.tsx`, each `export`ed. Add `import { … } from "./panels/shared"` to the main file.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: EXIT 0 (fix import paths until clean)

- [ ] **Step 4: Commit the leaf move**

```bash
git add 'app/(dashboard)/projects/_components/'
git commit -m "refactor(frontend): extract project-detail leaf components to panels/shared

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Move one panel, typecheck, commit — repeat per panel**

For each of `OverviewPanel` → … → `HandoverPanel`: cut to its own file, `export function`, import back into `project-detail-client.tsx`, `npm run typecheck`, then:
```bash
git commit -m "refactor(frontend): extract <Name> from project-detail-client

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Final gate**

```bash
npm run typecheck && npx next lint && npm run test:unit && npm run build
```
Expected: all EXIT 0; `/projects/[id]` route size within ~2 kB of the Step 1 baseline (code-split may even shrink first load).

- [ ] **Step 7: Manual verification**

`npm run dev`, open a project with quotes + contract + survey + material allocation, click every tab, confirm no runtime error and identical rendering.

- [ ] **Step 8: Push**

```bash
git push origin main
```

### Tasks 4b–4h

Each gets its own plan document written at pickup time, following the Task 4a shape and the methodology above, using the seam table. Do **not** batch them — one file split per plan, per review cycle. Backend splits (4c–4h) additionally:
- register every new collaborator service in the module's `providers` and (if consumed elsewhere) `exports`
- run `npx jest … src/<module>` after every commit and full `npm test` before push
- for 4f/4g/4h: add an explicit test asserting the status-sync side effect still fires (`stageChangedAt` set, `syncProjectStatusFor*` reached) **before** starting the move

---

## Self-Review

**1. Spec coverage:**
- D1 → Phase 4 (4a fully specced; 4b–4h seam-identified, sub-plans at pickup) ✓
- D2 → Phase 2 ✓
- D3 → already done (commit `1e5dad1`), not in this plan ✓
- D4 → Task 3 ✓
- D5 → Task 2 ✓
- D6 → Task 1 ✓
- D7 → Phase 3 ✓

**2. Placeholder scan:** Phase 4b–4h intentionally defer method-level detail to per-file sub-plans (justified: the move list must be re-verified against live line numbers). Everything executable now (Phases 1–3, Task 4a) has concrete code/commands. No "add error handling"-style placeholders.

**3. Type consistency:** `scopeCustomerWhereToUser(where, user)` and `accessibleCustomerRelationFilter(user)` names used identically in the interface block, the test, the implementation, and Phase 2 Steps 6–8. `Prisma.CustomerWhereInput` / `Prisma.DateTimeFilter` are generated types, not invented.

**4. Ordering:** Phase 2 (scoping helper) precedes Phase 4e (reports split) so the reports `buildXWhere` methods are already one-liners when they move. Phase 1 is independent and first.

---

## Execution Handoff

Recommended: do **Phases 1–3 inline** (small, mechanical, well-tested), then **one god-file split per session** for Phase 4 with a fresh review between each.
