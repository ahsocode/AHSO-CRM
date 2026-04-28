# AHSO CRM

AHSO CRM is a self-hosted B2B sales management system for technical/industrial projects. This README reflects the **current branch state** on `feature/backend-services-ai` as of **2026-04-24**, not an aspirational end-state.

## Current Branch Status

### Production-ready in this branch
- Core CRM flow: customers, projects, quotes, contracts, activities, dashboard, calendar
- Authentication with access token + **HttpOnly refresh cookie**
- Admin RBAC: roles, permissions, settings, users
- Local upload flows for logo, files, survey media, and business documents
- Documents v1 runtime for `QUOTATION` and `CONTRACT`
- Project 360 v1: overview, timeline, surveys, documents, handover
- Search, notifications, realtime foundation, health endpoint
- Docker Compose runtime with service healthchecks

### Beta / internal
- Document template editor outside `QUOTATION` and `CONTRACT`
- Report builder and advanced analytics still need business validation
- Push notifications, AI endpoints, and Twilio SMS require real environment verification before rollout
- Custom fields and some Project 360 polish are functional but still evolving

### Deferred
- Google / Microsoft OAuth
- Multi-tenant support
- Offline mutation queue / background sync
- Gesture-heavy mobile workflows

### Release posture
- **Good for internal staging/demo**
- **Not yet ideal for internet-exposed production** without more hardening and broader automated coverage
- See [docs/REVIEW_2026-04-24.md](docs/REVIEW_2026-04-24.md) for the current review baseline

## Tech Stack

### Frontend
- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS + shadcn/ui
- TanStack Query
- Zustand
- React Hook Form + Zod
- Recharts + selected Nivo charts

### Backend
- NestJS 10
- Prisma 5
- PostgreSQL 16
- Redis 7
- JWT auth
- Zod validation
- Puppeteer for document/PDF rendering

### Ops
- Docker Compose
- GitHub Actions CI/CD
- Winston logging
- Sentry hooks

## Repo Layout

```text
AHSO-CRM/
├── backend/                  NestJS API + Prisma
├── frontend/                 Next.js App Router UI
├── e2e/                      Playwright smoke tests
├── docs/                     Current branch documentation
├── docker-compose.yml        Local/staging stack
├── .github/workflows/        CI + deploy workflows
└── package.json              Root Playwright runner
```

## Main Functional Areas

### CRM lifecycle
- Customers
- Projects with kanban and Project 360
- Quotes with preview/PDF/send flow
- Contracts with milestones, payments, and acceptance PDF
- Activities and calendar scheduling

### Admin and governance
- Company info and policies
- Roles and permissions
- Internal user management
- Document template administration

### Documents and knowledge
- Business document registry for uploaded/received files
- Documents v1 render/download pipeline for quotation + contract
- Surveys and survey media linked into Project 360

## Authentication and Security Notes

- Access token is used by the frontend API client
- Refresh token is rotated through a **backend-set HttpOnly cookie**
- Core CRM and admin endpoints now use permission enforcement
- Public settings exposure is reduced to safe branding data only
- Health endpoint is available at `GET /api/health`

Current caveats:
- Backend and Playwright coverage are still below a mature production target
- Some enterprise/reporting surfaces remain beta

## Environment Files

Copy all three:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

### Important backend envs
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_EXPIRES_IN`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `THROTTLE_TTL`
- `THROTTLE_LIMIT`
- `ANTHROPIC_API_KEY`
- `SMTP_*`
- `TWILIO_*`
- `SENTRY_DSN`

### Important frontend envs
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_NAME`

## Local Development

### Install

```bash
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### Run with Docker

```bash
docker compose up -d --build
docker compose exec -T backend npm run prisma:seed
docker compose ps
curl http://127.0.0.1:3001/api/health
```

Default local URLs:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/api/docs`

### Run without Docker

```bash
cd backend && npm run prisma:deploy && npm run prisma:seed
cd backend && npm run start:dev
cd frontend && npm run dev
```

## Test Accounts

```text
admin@ahso.vn    / AHSO123!
manager@ahso.vn  / AHSO123!
staff@ahso.vn    / AHSO123!
```

## Useful Commands

### Root

```bash
npm run test:e2e
```

### Backend

```bash
cd backend
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build
npm run prisma:deploy
npm run prisma:seed
```

### Frontend

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

## Documents v1 Semantics

Documents v1 is intentionally narrow in this branch.

- Runtime document generation is enabled for:
  - `QUOTATION`
  - `CONTRACT`
- `POST /api/documents/:type/:entityId/render`
  - creates a new document version
  - renders PDF once
  - stores the artifact under local uploads
- `GET /api/documents/:documentId/download`
  - downloads an existing rendered artifact
  - does **not** create a new version
- End-user document creation flows should not expose template types outside the two runtime-ready types above

## Deployment Notes

- CI now runs:
  - backend lint
  - backend typecheck
  - backend tests
  - backend build
  - frontend lint
  - frontend typecheck
  - frontend build
  - Playwright smoke tests

### Production Docker Compose

Production deploys should use `docker-compose.prod.yml`, not the local development compose file. The production compose file pulls immutable backend/frontend images and keeps Postgres/Redis internal to the Docker network.

Prepare server-side env files:

```bash
cp .env.production.example .env.production.local
cp backend/.env.production.example backend/.env.production.local
cp frontend/.env.production.example frontend/.env.production.local
```

Then edit the `*.production.local` files with real secrets/domains and run:

```bash
./scripts/check-deploy-readiness.sh
docker compose --env-file .env.production.local -f docker-compose.prod.yml pull
docker compose --env-file .env.production.local -f docker-compose.prod.yml up -d
```

Important deploy notes:
- `NEXT_PUBLIC_API_URL` is baked into the Next.js browser bundle at image build time.
- GitHub Actions therefore requires `PROD_PUBLIC_API_URL` to build the frontend image correctly.
- Deploy health probes use `GET /api/health` and `GET /login`.
- Uploaded files and generated PDFs should be persisted through `UPLOADS_DIR`.

Required deploy secrets for GitHub Actions:
- `PROD_HOST`
- `PROD_USER`
- `PROD_SSH_KEY`
- `PROD_APP_DIR`
- `PROD_PUBLIC_API_URL`

Optional deploy secrets:
- `PROD_GHCR_USERNAME`
- `PROD_GHCR_TOKEN`
- `SLACK_WEBHOOK_URL`

## Recommended Reading

- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)
- [docs/COMPLETION_SUMMARY.md](docs/COMPLETION_SUMMARY.md)
- [docs/REVIEW_2026-04-24.md](docs/REVIEW_2026-04-24.md)
