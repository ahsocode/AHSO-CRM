# AHSO CRM

Self-hosted B2B sales management system for technical/industrial projects.

**Production:** https://crm.ahso.vn

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, React Hook Form + Zod |
| Backend | NestJS 10, Prisma 5, PostgreSQL 16, Redis 7, JWT auth, Zod validation, Puppeteer |
| Deployment | Docker Compose, GitHub Actions CI/CD, GHCR |

---

## Features

- **Customers** — CRUD, contacts, soft delete, customer stats
- **Projects** — 7-stage kanban (Survey → Proposal → Negotiation → Active → Delivery → Closing → Closed), drag-drop
- **Quotes** — line items, PDF generation, versioning, 5-status workflow (Draft → Sent → Accepted/Rejected/Expired)
- **Contracts** — milestones, payment logging, file attachments, acceptance PDF
- **Activities** — 7 types (Call, Email, Meeting, Survey, Demo, Note, Follow-up), calendar integration
- **Calendar** — week/month views, drag-to-reschedule, date range filters
- **Dashboard** — KPI cards, 6-month revenue chart, pipeline overview, today's tasks
- **Reports** — revenue trends, status breakdowns, top customers
- **Admin** — company info/logo, policies, roles & permissions matrix, user management
- **RBAC** — granular `resource.action` permissions, 3 system roles (ADMIN, MANAGER, STAFF) + custom roles

---

## Local Development

### Prerequisites

- Node.js 20+
- Docker + Docker Compose

### Start with Docker (recommended)

```bash
# 1. Copy env files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# 2. Edit backend/.env — at minimum set POSTGRES_PASSWORD and JWT_SECRET

# 3. Start all services
docker compose up -d --build

# 4. Seed test data
docker compose exec -T backend npm run prisma:seed

# 5. Verify
curl http://localhost:3001/api/health
```

URLs:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- Swagger UI: http://localhost:3001/api/docs (requires `SWAGGER_ENABLED=true` in `backend/.env`)

### Start without Docker

```bash
# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# Apply migrations + seed
cd backend && npm run prisma:deploy && npm run prisma:seed

# Run in separate terminals
cd backend && npm run start:dev   # port 3001
cd frontend && npm run dev         # port 3000
```

### Test Accounts

```
admin@ahso.vn    / AHSO123!
manager@ahso.vn  / AHSO123!
staff@ahso.vn    / AHSO123!
```

---

## Production Deployment

Production uses pre-built Docker images from GHCR via `docker-compose.prod.yml`.

### First-time server setup

```bash
# 1. Copy env templates to server
cp .env.production.example .env.production.local
cp backend/.env.production.example backend/.env.production.local
cp frontend/.env.production.example frontend/.env.production.local

# 2. Fill in real values (see Environment Variables below)

# 3. Pull images and start
docker compose --env-file .env.production.local -f docker-compose.prod.yml pull
docker compose --env-file .env.production.local -f docker-compose.prod.yml up -d
```

Prisma migrations are applied automatically at backend startup via `prisma migrate deploy`.

### CI/CD (GitHub Actions)

Push to `main` triggers:
1. Backend: lint → typecheck → unit tests → build → push Docker image to GHCR
2. Frontend: lint → typecheck → unit tests → build → push Docker image to GHCR
3. Deploy: SSH to VPS → pull new images → `docker compose up -d`

Required GitHub Actions secrets:

| Secret | Description |
|---|---|
| `PROD_HOST` | VPS IP or hostname |
| `PROD_USER` | SSH user |
| `PROD_SSH_KEY` | Private SSH key |
| `PROD_APP_DIR` | App directory on server |
| `PROD_PUBLIC_API_URL` | Backend URL baked into frontend image at build time |

Optional: `SLACK_WEBHOOK_URL` for deploy notifications.

### Nginx reverse proxy

The production compose binds backend to `127.0.0.1:3001` and frontend to `127.0.0.1:3000`. Use Nginx to terminate TLS:

```nginx
server {
    listen 443 ssl;
    server_name crm.ahso.vn;

    location /api     { proxy_pass http://127.0.0.1:3001; }
    location /uploads { proxy_pass http://127.0.0.1:3001; }
    location /        { proxy_pass http://127.0.0.1:3000; }
}
```

---

## Environment Variables

### Root (`.env.production.local`)

```env
POSTGRES_DB=ahso_crm
POSTGRES_USER=ahso
POSTGRES_PASSWORD=<strong-password>
BACKEND_IMAGE=ghcr.io/ahsocode/ahso-crm-backend:latest
FRONTEND_IMAGE=ghcr.io/ahsocode/ahso-crm-frontend:latest
BACKEND_BIND=127.0.0.1:3001
FRONTEND_BIND=127.0.0.1:3000
UPLOADS_DIR=./backend/uploads
```

### Backend (`backend/.env.production.local`)

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<32+ random chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_RESET_SECRET=<different 32+ random chars>
FRONTEND_URL=https://crm.ahso.vn
CORS_ORIGIN=https://crm.ahso.vn
SWAGGER_ENABLED=false
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# Optional — AI suggestions
ANTHROPIC_API_KEY=

# Optional — Email (required for password reset and quote sending)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=AHSO CRM <noreply@ahso.vn>
```

### Frontend (`frontend/.env.production.local`)

```env
NEXT_PUBLIC_API_URL=https://crm.ahso.vn
NEXT_PUBLIC_APP_NAME=AHSO CRM
```

> `NEXT_PUBLIC_API_URL` is baked into the Next.js bundle at **image build time** via the `PROD_PUBLIC_API_URL` GitHub Actions secret.

---

## Useful Commands

### Backend

```bash
cd backend
npm run start:dev        # dev server with hot reload (port 3001)
npm run build            # production build
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm test                 # Jest unit tests (--runInBand)
npm run prisma:generate  # regenerate Prisma client after schema change
npm run prisma:migrate   # create + apply new dev migration
npm run prisma:deploy    # apply pending migrations (production)
npm run prisma:seed      # seed test accounts and sample data
```

### Frontend

```bash
cd frontend
npm run dev              # dev server (port 3000)
npm run build            # production build
npm run typecheck        # tsc --noEmit
npm run lint             # next lint
npm run test:unit        # Vitest
```

### E2E (root)

```bash
npm run test:e2e         # Playwright (requires full stack running with seeded DB)
```

---

## Repo Layout

```
AHSO-CRM/
├── backend/                 NestJS API + Prisma
│   ├── prisma/              Schema, migrations, seed
│   ├── src/
│   │   ├── auth/            JWT auth, refresh tokens, password reset
│   │   ├── users/           User CRUD + role assignment
│   │   ├── customers/       Customer + contact management
│   │   ├── projects/        Project kanban + timeline
│   │   ├── quotes/          Quote workflow + PDF
│   │   ├── contracts/       Contract + milestones + payments + PDF
│   │   ├── activities/      Activity log + calendar
│   │   ├── dashboard/       KPI aggregation
│   │   ├── reports/         Revenue analytics
│   │   ├── calendar/        Calendar event queries
│   │   ├── settings/        Company info + policies
│   │   ├── roles/           Role CRUD
│   │   ├── permissions/     Permission matrix
│   │   ├── upload/          File + logo upload
│   │   ├── documents/       PDF template runtime
│   │   ├── notifications/   In-app notifications
│   │   └── common/          Guards, pipes, interceptors, filters
│   └── uploads/             Uploaded files — persisted via Docker volume
├── frontend/                Next.js 14 App Router
│   ├── app/
│   │   ├── (auth)/          Login, forgot-password, reset-password
│   │   └── (dashboard)/     All CRM pages
│   ├── components/          Shared UI components
│   ├── hooks/               TanStack Query hooks (use-*.ts)
│   └── lib/                 API client, types, utils, formatters
├── e2e/                     Playwright smoke tests
├── docs/                    Architecture reference
├── scripts/                 Deploy and utility scripts
├── docker-compose.yml       Local development stack
├── docker-compose.prod.yml  Production stack (pre-built images from GHCR)
└── .github/workflows/       CI + deploy pipelines
```

---

## Auth Flow

1. `POST /api/auth/login` → returns `accessToken` (JWT, 15 min) + sets `ahso_refresh_token` **HttpOnly cookie** (7 days)
2. Frontend stores `accessToken` in `sessionStorage`; Zustand hydrates user profile from `localStorage`
3. On 401, `apiClient` auto-calls `POST /api/auth/refresh` via the HttpOnly cookie, retries the original request
4. `POST /api/auth/logout` → deletes session from DB + clears cookie

---

## Documentation

- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) — detailed architecture reference
- [CHANGELOG.md](CHANGELOG.md) — version history
- [CLAUDE.md](CLAUDE.md) — AI assistant coding instructions
