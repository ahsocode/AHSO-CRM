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
| **AI** | Multi-provider (Anthropic Claude, OpenAI, Gemini) — activity summaries, follow-up suggestions, win probability forecast, AI agents with CRM tool access |
| **Notifications** | WebSocket real-time + in-app DB + Web Push (VAPID) |
| **Email** | iRedMail IMAP/SMTP (self-hosted), AES-256-GCM encrypted credentials, IDLE real-time sync |
| **Integrations** | SMTP transactional email, Twilio SMS, outbound webhooks, Sentry |
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

### Inventory & Warehouse
- **Suppliers** — Supplier catalog with tax code, contacts, preferred supplier per material
- **Materials** — Material catalog with categories, sale price, cost price (moving average), stock alert threshold, supplier pricing per vendor
- **Warehouses** — Multi-warehouse management with manager assignment
- **Stock Receipts** — `PN-YYYY-NNN` numbered inbound receipts, DRAFT → CONFIRMED workflow, increases stock balance and recalculates average cost price on confirm
- **Stock Issues** — `PX-YYYY-NNN` outbound issues linked to projects, stock check on confirm, decreases balance
- **Stock Transfers** — `PCT-YYYY-NNN` inter-warehouse transfers, atomic debit/credit in a single transaction
- **Stock Counts** — `KK-YYYY-NNN` physical inventory counts, adjusts balance by diff (actual − system) on confirm
- **Inventory Dashboard** — Total stock value, low-stock alerts, pending draft documents count

### Documents
- **Template Editor** — Visual layout editor for 16 document types (quotation, proposal, contract, delivery note, acceptance report, warranty, etc.)
- **Template Versioning** — Draft → Review → Production approval workflow for document variants
- **PDF Generation** — Puppeteer/Chromium rendering from Handlebars templates, bilingual (vi/vi-en)
- **Business Documents** — Document filing system for RFQ, PO, signed contracts, invoices, delivery notes with parent/child lineage

### Analytics & Reporting
- **Dashboard** — KPI cards, 6-month revenue chart, pipeline distribution, today's tasks, real-time activity feed
- **Reports** — Revenue trend, status breakdown, top customers, customer journey, activity heatmap, sales funnel, cohort analysis
- **Custom Report Builder** — Dynamic query builder with saved templates and Excel export

### Mailbox
- **iRedMail integration** — Self-hosted email server at `mail.ahso.vn` is the single source of truth for `@ahso.vn` accounts. Logging into CRM with an `@ahso.vn` email authenticates against the IMAP server (port 993 SSL) — no separate CRM password needed. New iRedMail accounts can log in immediately without admin action.
- **Auto account creation** — First successful IMAP login auto-creates the CRM user (STAFF role). Subsequent logins detect iRedMail password changes and update stored credentials automatically.
- **IMAP client** — Each user's mailbox is accessible inside CRM: folder navigation, read/compose/reply, message threading, star and mark-read, IMAP IDLE for real-time new-message notifications.
- **Email ↔ CRM linking** — Incoming emails are automatically linked to matching customers and projects by sender/recipient domain matching.
- **Encrypted credentials** — IMAP passwords are stored with AES-256-GCM encryption (not bcrypt — must be decryptable for IMAP auth). Requires `ENCRYPTION_KEY` env variable.

### Admin
- **RBAC** — Granular `resource.action` permissions (e.g. `quotes.create`, `contracts.edit`), 3 locked system roles (ADMIN, MANAGER, STAFF) + unlimited custom roles
- **User Management** — Create users, assign roles
- **Company Settings** — Name, address, tax ID, logo upload
- **Document Templates** — Full template editor with token catalog and approval workflow
- **Custom Fields** — Add dynamic fields to any resource
- **System Policies** — Password rules, data retention, terms and privacy
- **Backup & Restore** — One-click backup to Google Drive via rclone (database dump + uploads + env config), list and restore any backup from the admin UI. Automated daily backup at 2:00 AM via cron, auto-purge files older than 30 days.

### Platform
- **Real-time** — WebSocket (Socket.io) for live data updates across all clients
- **Notifications** — In-app bell (persistent + real-time), Web Push to mobile
- **Single Active Session** — Each user can be logged in on only one device/browser session at a time. A new login invalidates previous sessions in real time via WebSocket.
- **Webhooks** — Outbound HTTP webhooks on domain events with delivery logs
- **Search** — Global full-text search across customers, projects, quotes, contracts, activities
- **AI Insights** — Customer activity summaries, suggested follow-ups, email drafting, project win probability, pipeline revenue forecast
- **AI Agents** — Configurable agents with scoped CRM tool access (search customers, list projects, look up quotes); run ad-hoc or triggered by workflows
- **AI Credentials** — Multi-provider credential management (Anthropic, OpenAI, Gemini) via API key or OAuth 2.0; token auto-refresh, per-provider usage tracking (7-day request count, error rate, avg latency)
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

# Required — AES-256-GCM key for IMAP password encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=

# Optional — iRedMail / Mailbox
IMAP_HOST=mail.ahso.vn                # iRedMail IMAP host for @ahso.vn authentication

# Optional — Backup & Restore (requires rclone configured on server)
POSTGRES_CONTAINER=ahso-crm-postgres-1  # Docker container name for pg_dump/pg_restore

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

## Backup & Restore

Backups are stored on Google Drive via [rclone](https://rclone.org). Each backup is a `.tar.gz` archive containing: a PostgreSQL custom-format dump, the `uploads/` directory, and `.env.production.local`.

### One-time rclone setup (on VPS)

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure Google Drive remote named "AHSO-CRM-Backup"
rclone config
# → New remote → name: AHSO-CRM-Backup → type: drive → follow OAuth flow

# Test connection
rclone lsd AHSO-CRM-Backup:

# Install backup script
curl -o /opt/backup-ahso-crm.sh https://raw.githubusercontent.com/ahsocode/AHSO-CRM/main/scripts/backup.sh
chmod +x /opt/backup-ahso-crm.sh

# Schedule daily at 2:00 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup-ahso-crm.sh >> /var/log/ahso-backup.log 2>&1") | crontab -
```

### Restore from backup

Backups can be restored from the **Admin → Backup & Restore** page in the CRM UI, or manually:

```bash
# Download a specific backup
rclone copy "AHSO-CRM-Backup:AHSO-CRM-Backups/ahso-crm-YYYY-MM-DD_HH-MM.tar.gz" /opt/backups/restore/
cd /opt/backups/restore && tar -xzf ahso-crm-*.tar.gz

# Restore database
cat database.dump | docker exec -i -e PGPASSWORD=<pass> ahso-crm-postgres-1 pg_restore -U ahso -d ahso_crm

# Restore uploads
cp -r uploads/. /opt/AHSO-CRM/backend/uploads/

# Restart services
cd /opt/AHSO-CRM && docker compose -f docker-compose.prod.yml --env-file .env.production.local up -d
```

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
│       ├── ai/                  AI provider abstraction (Anthropic, OpenAI, Gemini)
│       ├── ai-credentials/      Multi-provider credential management + OAuth 2.0 flow
│       ├── agents/              Configurable AI agents with CRM tool access
│       ├── email/               SMTP transactional email
│       ├── sms/                 Twilio SMS
│       ├── webhooks/            Outbound webhooks + delivery logs
│       ├── mailbox/             iRedMail IMAP client (auth, sync, IDLE, send/reply)
│       ├── suppliers/           Supplier catalog
│       ├── materials/           Material catalog + categories
│       ├── inventory/           Warehouse management + stock balances
│       ├── stock-receipts/      Inbound stock receipts (PN)
│       ├── stock-issues/        Outbound stock issues (PX)
│       ├── stock-transfers/     Inter-warehouse transfers (PCT)
│       ├── stock-counts/        Physical inventory counts (KK)
│       ├── backup/              Backup & Restore via rclone → Google Drive
│       ├── audit/               Login audit log
│       ├── websocket/           Socket.io gateway
│       ├── domain-events/       Internal event bus → WS + notifications + webhooks + push
│       └── common/              Guards, pipes, interceptors, filters, Prisma service
├── frontend/
│   ├── app/
│   │   ├── (auth)/              Login, forgot-password, reset-password
│   │   └── (dashboard)/         All CRM pages (customers, projects, quotes,
│   │                            contracts, activities, calendar, documents,
│   │                            reports, notifications, users, admin/*,
│   │                            suppliers, materials, inventory/*, agents)
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
  → invalidates all previous sessions for the same user

On 401:
  apiClient → POST /api/auth/refresh (cookie auto-sent)
  → new accessToken + rotated cookie
  → retry original request

Single-session enforcement:
  Device A is logged in
  → Device B logs in with the same user
  → DB sessions for Device A are deleted
  → WebSocket emits auth:session-invalidated with sessionId
  → Device A receives event, matches its own sessionId, logs out immediately
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
| `suppliers.spec.ts` | Supplier CRUD API smoke flow |
| `inventory.spec.ts` | Receipt confirm → stock balance increase |
| `security.spec.ts` | RBAC enforcement, permission boundaries |

---

## Documentation

- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) — detailed architecture reference
- [CLAUDE.md](CLAUDE.md) — AI assistant coding instructions (for contributors using Claude Code)
