# Route map — changed source → page to look at → e2e spec to run

Use with `git diff --name-only origin/main...HEAD` to decide the **minimum** set of pages
to inspect visually and the `--grep` filter for Playwright. Never QA pages you did not touch.

| Changed path (frontend/…) | Page(s) | e2e spec | `--grep` |
|---|---|---|---|
| `app/(dashboard)/dashboard/**` | `/dashboard` | `dashboard.spec.ts`, `ui-regression.spec.ts` | `Dashboard` |
| `app/(dashboard)/customers/**`, `components/shared/avatar-initials.tsx` | `/customers`, `/customers/[id]` | `customers.spec.ts`, `ui-regression.spec.ts` | `Khách hàng` |
| `app/(dashboard)/projects/_components/project-kanban-board.tsx`, `projects-client.tsx` | `/projects?view=kanban` | `projects.spec.ts`, `ui-regression.spec.ts` | `Kanban` |
| `app/(dashboard)/projects/_components/project-detail*` | `/projects/[id]` | `projects.spec.ts` | `Project 360` |
| `app/(dashboard)/quotes/**` | `/quotes/new`, `/quotes/[id]` | `quotes.spec.ts`, `ui-regression.spec.ts` | `Báo giá` |
| `app/(dashboard)/contracts/**` | `/contracts`, `/contracts/[id]` | `contracts.spec.ts` | `Hợp đồng` |
| `app/(dashboard)/suppliers/**` | `/suppliers`, `/suppliers/[id]` | `suppliers.spec.ts`, `ui-regression.spec.ts` | `Nhà cung cấp` |
| `app/(dashboard)/materials/**`, `inventory/**` | `/materials`, `/inventory` | `inventory.spec.ts` | `Kho` |
| `app/(dashboard)/activities/**`, `calendar/**` | `/activities`, `/calendar` | `activities.spec.ts`, `calendar.spec.ts` | — |
| `components/layout/**`, `app/globals.css`, `lib/format.ts`, `lib/constants.ts` | **all main pages** (shared) | full suite | — |
| `lib/api-client.ts`, `lib/auth.ts`, `components/layout/dashboard-shell.tsx`, `middleware.ts` | login + open-in-new-tab | `auth.spec.ts`, `security.spec.ts`, `ui-regression.spec.ts` | `phiên` |
| `app/(auth)/**` | `/login` | `auth.spec.ts` | — |

Seed accounts (QA stack): `admin@ahso.vn / AHSO123!`, `manager@ahso.vn`, `staff@ahso.vn` (same password).
