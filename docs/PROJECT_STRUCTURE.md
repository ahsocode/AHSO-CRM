# AHSO CRM — Current Branch Project Structure

This document describes the **actual structure and implementation direction** of the current branch `feature/backend-services-ai` as of **2026-04-24**. It is intended as the working architecture guide for future coding sessions.

## 1. Product Scope

AHSO CRM manages the B2B technical sales lifecycle:

```text
Lead / Customer
→ Survey / site visit
→ Project opportunity
→ Quote
→ Contract
→ Delivery / milestones
→ Acceptance
→ Payment
→ Project handover / history
```

The branch also includes:
- Admin RBAC
- Document template runtime/editor foundation
- Project 360 knowledge hub
- Notifications + realtime foundation
- Health checks and CI hardening

## 2. Technology Stack

### Frontend
- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zustand
- React Hook Form + Zod

### Backend
- NestJS 10
- Prisma 5
- PostgreSQL 16
- Redis 7
- JWT auth
- Zod request validation
- Puppeteer

### Runtime / delivery
- Docker Compose
- GitHub Actions
- Winston + Sentry hooks

## 3. Core Runtime Conventions

### API shape
- Default API responses are wrapped by `TransformInterceptor`
- Standard JSON shape:

```json
{
  "data": {},
  "meta": null
}
```

- Exception:
  - binary/document download routes may return raw file responses

### Validation
- Backend validation uses **Zod**
- Do not introduce `class-validator` patterns into new modules

### Auth
- Access token is used by the frontend API client
- Refresh token is issued/rotated through **HttpOnly cookie**
- Core protected APIs use `JwtAuthGuard`
- Authorization uses `PermissionsGuard`, with `RolesGuard` retained for backward compatibility

### Health / ops
- Health endpoint: `GET /api/health`
- Docker Compose uses service healthchecks
- CI runs lint, typecheck, test, build, and Playwright smoke

## 4. Repository Layout

```text
AHSO-CRM/
├── backend/
├── frontend/
├── e2e/
├── docs/
├── docker-compose.yml
├── .github/workflows/
└── package.json
```

## 5. Frontend Structure

### App Router

```text
frontend/app/
├── (auth)/
│   ├── login/
│   ├── forgot-password/
│   └── reset-password/
├── (dashboard)/
│   ├── dashboard/
│   ├── customers/
│   ├── projects/
│   ├── quotes/
│   ├── contracts/
│   ├── activities/
│   ├── calendar/
│   ├── reports/
│   ├── users/
│   ├── notifications/
│   └── admin/
│       ├── company-info/
│       ├── policies/
│       ├── roles/
│       ├── custom-fields/
│       └── document-templates/
├── documents/
│   └── preview/
├── layout.tsx
├── page.tsx
└── global-error.tsx
```

### Frontend shared layers

```text
frontend/components/
├── layout/
├── shared/
└── ui/

frontend/hooks/
├── use-auth.ts
├── use-customers.ts
├── use-projects.ts
├── use-quotes.ts
├── use-contracts.ts
├── use-activities.ts
├── use-settings.ts
├── use-roles.ts
├── use-notifications.ts
├── use-websocket.ts
└── ...

frontend/lib/
├── api-client.ts
├── auth.ts
├── constants.ts
├── format.ts
├── types.ts
└── utils.ts
```

### Frontend architecture notes
- Route groups:
  - `(auth)` for guest pages
  - `(dashboard)` for protected workspace pages
- Shared shell concerns live in layout components:
  - sidebar
  - topbar
  - dashboard shell
- Server state should prefer TanStack Query
- Local UI state should stay close to the component unless it is truly global

## 6. Backend Structure

### Current modules under `backend/src`

```text
activities
ai
audit
auth
business-documents
calendar
common
contacts
contracts
custom-fields
customers
dashboard
documents
domain-events
email
health
notifications
permissions
projects
push
quotes
reports
roles
search
settings
sms
surveys
upload
users
webhooks
websocket
```

### Shared backend layers

```text
backend/src/common/
├── decorators/
├── dto/
├── filters/
├── guards/
├── interceptors/
├── logger/
├── pipes/
├── utils/
└── prisma.service.ts
```

### Backend architecture notes
- Pattern:
  - controller
  - service
  - Prisma via `PrismaService`
- Keep orchestration in services, not in controllers
- Preserve Vietnamese business-facing error messages
- Reuse `PermissionsGuard` and `@RequirePermissions(...)` for new protected routes

## 7. Data Layer

### Source of truth
- Prisma schema: `backend/prisma/schema.prisma`

### Current migration state
- Current branch has **9 migrations**
- Do not describe the schema as “14 models / 3 migrations”; that is outdated

### Current domain emphasis
- Core CRM entities
- RBAC entities
- Settings/logo
- Notifications + push subscriptions
- Custom fields
- Report templates
- Document template variants
- Surveys and business documents

## 8. Documents and Templates

### Documents v1
- Runtime-ready document types:
  - `QUOTATION`
  - `CONTRACT`
- Render semantics:
  - render creates a new document version and stores a PDF artifact
  - download by `documentId` fetches an existing artifact only

### Template runtime
- `/admin/document-templates` is the admin surface
- Template runtime is production-ready only for:
  - `QUOTATION`
  - `CONTRACT`
- Other template categories may exist in the registry/editor but remain beta/internal

## 9. Project 360

Project detail is not just a basic CRUD detail page anymore.

Current branch direction:
- Overview
- Timeline
- Surveys
- Business documents
- Handover context
- Links back to related quote/contract/payment state

When extending this area:
- keep project as the central knowledge hub
- do not scatter survey/document/handover logic into unrelated modules without a clear read model

## 10. Release Status by Area

### Stable enough for daily internal use
- Core CRM modules
- Admin settings/roles/permissions/users
- Quote and contract runtime document flows
- Health checks and CI baseline

### Working with caveats / beta
- Report builder and advanced reporting
- Push notifications and SMS integrations
- Non-quotation/non-contract document templates
- Some Project 360 polish surfaces

### Deferred
- Multi-tenant
- Google/Microsoft OAuth
- Offline mutation queue
- Heavy mobile gesture workflows

## 11. Coding Guidance For Future Changes

- Read the current implementation first; do not rely on old handoff assumptions
- Keep docs aligned with the branch after meaningful scope changes
- Do not expand “beta” areas into “production-ready” docs until runtime, tests, and UX all match
- Do not change Prisma schema casually:
  - schema changes require migration review
  - data/backfill implications must be explicit
- Prefer small, reviewable commits by phase

## 12. Companion Documents

- `README.md`
- `docs/COMPLETION_SUMMARY.md`
- `docs/REVIEW_2026-04-24.md`
