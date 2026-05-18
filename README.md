# AHSO CRM

Self-hosted B2B sales CRM for technical and industrial project businesses. Manages the full lifecycle from lead to payment: customers → projects → quotes → contracts → documents → analytics.

**Production:** https://crm.ahso.vn

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query v5, Zustand, React Hook Form + Zod, Recharts, Nivo |
| **Backend** | NestJS 10, Prisma 5, PostgreSQL 16, Redis 7, Socket.io, Puppeteer, Handlebars |
| **Auth** | JWT (15 min access + 7 day refresh HttpOnly cookie), bcrypt, session tracking |
| **AI** | Anthropic Claude (activity summaries, follow-up suggestions, win probability forecast) |
| **Notifications** | WebSocket real-time + in-app DB + Web Push (VAPID) |
| **Integrations** | SMTP email, Twilio SMS, outbound webhooks, Sentry |
| **Deployment** | Docker Compose, GitHub Actions CI/CD, GHCR |

---

## Features

### CRM Core
- **Customers** — Full lifecycle (Lead → Prospect → Active → Inactive), staff assignment, contact management, bulk import/export, merge duplicates, soft delete + recovery, custom fields
- **Projects** — 7-stage pipeline (Survey → Quoting → Negotiating → Won/Lost → Delivering → Completed), 360° overview, project handover documentation
- **Quotes** — Line items with units and descriptions, PDF generation, version control, 5-status workflow (Draft → Sent → Accepted / Rejected / Expired), duplicate and send by email
- **Contracts** — Milestones with payment amounts, payment recording, acceptance report PDF, file attachments
- **Activities** — 7 types (Call, Email, Meeting, Survey, Demo, Note, Follow-up), soft delete + restore, calendar integration
- **Surveys** — Site survey records with typed notes (technical, commercial, constraint, risk, decision), photo/video attachments with area tags

### Documents
- **Template Editor** — Visual layout editor for 16 document types (quotation, proposal, contract, delivery note, acceptance report, warranty, etc.)
- **Template Versioning** — Draft → Review → Production approval workflow for document variants
- **PDF Generation** — Puppeteer/Chromium rendering from Handlebars templates, bilingual (vi/vi-en)
- **Business Documents** — Document filing system for RFQ, PO, signed contracts, invoices, delivery notes with parent/child lineage

### Analytics & Reporting
- **Dashboard** — KPI cards, 6-month revenue chart, pipeline distribution, today's tasks, real-time activity feed
- **Reports** — Revenue trend, status breakdown, top customers, customer journey, activity heatmap, sales funnel, cohort analysis
- **Custom Report Builder** — Dynamic query builder with saved templates and Excel export

### Admin
- **RBAC** — Granular `resource.action` permissions (e.g. `quotes.create`, `contracts.edit`), 3 locked system roles (ADMIN, MANAGER, STAFF) + unlimited custom roles
- **User Management** — Create users, assign roles
- **Company Settings** — Name, address, tax ID, logo upload
- **Document Templates** — Full template editor with token catalog and approval workflow
- **Custom Fields** — Add dynamic fields to any resource
- **System Policies** — Password rules, data retention, terms and privacy

### Platform
- **Real-time** — WebSocket (Socket.io) for live data updates across all clients
- **Notifications** — In-app bell (persistent + real-time), Web Push to mobile
- **Session Management** — View active sessions across devices, revoke individual sessions (target device is logged out in real-time via WebSocket)
- **Webhooks** — Outbound HTTP webhooks on domain events with delivery logs
- **Search** — Global full-text search across customers, projects, quotes, contracts, activities
- **AI Insights** — Customer activity summaries, suggested follow-ups, email drafting, project win probability, pipeline revenue forecast (requires `ANTHROPIC_API_KEY`)
- **Email** — Transactional email via SMTP (password reset, quote delivery)
- **SMS** — Activity alerts via Twilio (optional)

---

## Quick Start (Docker)

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (for running tests locally)

### Run locally

```bash
# 1. Clone and copy env files
git clone https://github.com/ahsocode/AHSO-CRM.git && cd AHSO-CRM
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# 2. Set a strong JWT_SECRET in backend/.env (min 16 chars)

# 3. Start all services (postgres, redis, backend, frontend)
docker compose up -d --build

# 4. Apply migrations and seed test data
docker compose exec -T backend npm run prisma:seed

# 5. Verify
curl http://localhost:3001/api/health
```

| URL | Description |
|---|---|
| `http://localhost:3000` | Frontend |
| `http://localhost:3001/api` | Backend API |
| `http://localhost:3001/api/docs` | Swagger UI (enable with `SWAGGER_ENABLED=true`) |

### Test accounts

```
admin@ahso.vn   / AHSO123!   ← Full access
manager@ahso.vn / AHSO123!   ← Read all, no delete
staff@ahso.vn   / AHSO123!   ← Assigned records only
```

---

## Development (without Docker)

```bash
# Install all dependencies
cd backend && npm install
cd ../frontend && npm install

# Start PostgreSQL and Redis (Docker only for infra)
docker compose up -d postgres redis

# Apply migrations + seed
cd backend && npm run prisma:deploy && npm run prisma:seed

# Run in separate terminals
cd backend && npm run start:dev   # port 3001
cd frontend && npm run dev         # port 3000
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Required
DATABASE_URL=postgresql://ahso:password@localhost:5432/ahso_crm
REDIS_URL=redis://localhost:6379
JWT_SECRET=<32+ random chars>

# Recommended for production
JWT_RESET_SECRET=<different 32+ random chars>
FRONTEND_URL=https://crm.ahso.vn
CORS_ORIGIN=https://crm.ahso.vn
NODE_ENV=production

# Token TTLs (optional — defaults shown)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_RESET_EXPIRES_IN=15m

# Rate limiting (optional)
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# Optional — enable Swagger UI at /api/docs
SWAGGER_ENABLED=false

# Optional — AI features (gracefully disabled if absent)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Optional — Email (all-or-nothing; required for password reset + quote sending)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=AHSO CRM <noreply@ahso.vn>

# Optional — SMS via Twilio (all-or-nothing)
TWILIO_SID=
TWILIO_TOKEN=
TWILIO_FROM=

# Optional — Web Push (all-or-nothing)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@ahso.vn

# Optional — Error tracking
SENTRY_DSN=

# Optional — dev helpers
DEBUG_RESET=false       # include reset token in forgot-password response
LOG_LEVEL=info          # error | warn | info | debug | verbose
UPLOAD_DIR=./uploads
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=AHSO CRM
```

> **Note:** `NEXT_PUBLIC_API_URL` is baked into the Next.js bundle at build time. In production, pass it as a Docker build arg via the `PROD_PUBLIC_API_URL` GitHub Actions secret.

---

## Production Deployment

Uses pre-built Docker images from GHCR via `docker-compose.prod.yml`.

```bash
# First-time setup
cp .env.production.example .env.production.local
cp backend/.env.production.example backend/.env.production.local

# Pull and start
docker compose --env-file .env.production.local -f docker-compose.prod.yml pull
docker compose --env-file .env.production.local -f docker-compose.prod.yml up -d
```

Prisma migrations run automatically at backend startup via `prisma migrate deploy`.

### Nginx reverse proxy

```nginx
server {
    listen 443 ssl;
    server_name crm.ahso.vn;

    location /api      { proxy_pass http://127.0.0.1:3001; }
    location /uploads  { proxy_pass http://127.0.0.1:3001; }
    location /events   { proxy_pass http://127.0.0.1:3001; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
    location /         { proxy_pass http://127.0.0.1:3000; }
}
```

### CI/CD (GitHub Actions)

Push to `main` triggers:
1. Backend: lint → typecheck → unit tests → Docker build → push to GHCR
2. Frontend: lint → typecheck → unit tests → Docker build → push to GHCR
3. Deploy: SSH to VPS → pull new images → `docker compose up -d`

Required GitHub Actions secrets:

| Secret | Purpose |
|---|---|
| `PROD_HOST` | VPS IP or hostname |
| `PROD_USER` | SSH user |
| `PROD_SSH_KEY` | Private SSH key |
| `PROD_APP_DIR` | App directory on server |
| `PROD_PUBLIC_API_URL` | Backend URL baked into frontend image at build time |

---

## Commands

### Backend

```bash
cd backend
npm run start:dev        # hot-reload dev server (port 3001)
npm run build            # production build
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm test                 # Jest unit tests (sequential, --runInBand)
npm run test:cov         # Jest with coverage report
npm run prisma:generate  # regenerate Prisma client after schema change
npm run prisma:migrate   # create + apply a new dev migration
npm run prisma:deploy    # apply pending migrations (production)
npm run prisma:seed      # seed test accounts and sample data
```

### Frontend

```bash
cd frontend
npm run dev              # Next.js dev server (port 3000)
npm run build            # production build
npm run typecheck        # tsc --noEmit
npm run lint             # next lint
npm run test:unit        # Vitest
```

### E2E

```bash
# from repo root — requires full stack running with seeded DB
npm run test:e2e
```

---

## Repo Layout

```
AHSO-CRM/
├── backend/
│   ├── prisma/                  Schema, migrations, seed
│   └── src/
│       ├── auth/                JWT auth, sessions, password reset
│       ├── users/               User CRUD + role assignment
│       ├── roles/               Role CRUD (system roles read-only)
│       ├── permissions/         Permission catalog
│       ├── customers/           CRM customers (bulk import/export/merge)
│       ├── contacts/            Customer contacts
│       ├── projects/            Project pipeline + 360° view
│       ├── quotes/              Quote workflow + PDF
│       ├── contracts/           Contract + milestones + payments + PDF
│       ├── activities/          Activity log + soft delete
│       ├── surveys/             Site surveys with media
│       ├── calendar/            Calendar event queries
│       ├── dashboard/           KPI aggregation
│       ├── reports/             Analytics + custom report builder
│       ├── search/              Global full-text search
│       ├── documents/           Template editor + PDF rendering (16 types)
│       ├── business-documents/  Document filing with lineage
│       ├── notifications/       In-app notification persistence
│       ├── push/                Web push (VAPID)
│       ├── settings/            Company info + system policies
│       ├── custom-fields/       Dynamic fields per resource
│       ├── upload/              File + avatar + logo uploads
│       ├── ai/                  Anthropic Claude integrations
│       ├── email/               SMTP transactional email
│       ├── sms/                 Twilio SMS
│       ├── webhooks/            Outbound webhooks + delivery logs
│       ├── audit/               Login audit log
│       ├── websocket/           Socket.io gateway
│       ├── domain-events/       Internal event bus → WS + notifications + webhooks + push
│       └── common/              Guards, pipes, interceptors, filters, Prisma service
├── frontend/
│   ├── app/
│   │   ├── (auth)/              Login, forgot-password, reset-password
│   │   └── (dashboard)/         All CRM pages (customers, projects, quotes,
│   │                            contracts, activities, calendar, documents,
│   │                            reports, notifications, users, admin/*)
│   ├── components/              Shared UI components
│   ├── hooks/                   TanStack Query + Zustand hooks (use-*.ts)
│   └── lib/                     API client, types, formatters, constants
├── e2e/                         Playwright smoke tests
├── docs/                        Architecture reference
├── scripts/                     Deploy and utility scripts
├── docker-compose.yml           Local development stack
├── docker-compose.prod.yml      Production stack (GHCR images)
└── .github/workflows/           CI + deploy pipelines
```

---

## Auth Flow

```
POST /api/auth/login
  → accessToken (JWT, 15 min) stored in sessionStorage
  → ahso_refresh_token (7 day) stored as HttpOnly cookie

On 401:
  apiClient → POST /api/auth/refresh (cookie auto-sent)
  → new accessToken + rotated cookie
  → retry original request

Remote session revocation:
  Device A calls DELETE /api/auth/sessions/:id
  → DB session deleted
  → WebSocket emits auth:session-invalidated with sessionId
  → Device B receives event, matches its own sessionId, logs out immediately
```

---

## E2E Test Coverage

| Spec | Scenarios |
|---|---|
| `auth.spec.ts` | Login, logout, password reset, session refresh |
| `customers.spec.ts` | List, bulk export, soft delete, restore |
| `projects.spec.ts` | List, kanban, 360 view, business documents, search |
| `quotes.spec.ts` | List, PDF preview, export |
| `contracts.spec.ts` | Create, milestones |
| `calendar.spec.ts` | Date range, view switching |
| `activities.spec.ts` | Create, filter |
| `dashboard.spec.ts` | KPI cards, charts |
| `admin.spec.ts` | Admin panel, roles, document templates |
| `security.spec.ts` | RBAC enforcement, permission boundaries |

---

## Documentation

- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) — detailed architecture reference
- [CLAUDE.md](CLAUDE.md) — AI assistant coding instructions (for contributors using Claude Code)
