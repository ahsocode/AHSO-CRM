# AHSO CRM

CRM B2B cho vòng đời bán hàng kỹ thuật công nghiệp: `Khách hàng -> Dự án -> Báo giá -> Hợp đồng -> Nghiệm thu -> Thanh toán`.

Repo này là monorepo gồm:
- `backend/`: NestJS + Prisma + PostgreSQL
- `frontend/`: Next.js 14 App Router
- `docker-compose.yml`: stack `postgres + redis + backend + frontend`

Spec gốc và tài liệu tham chiếu:
- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)
- [docs/BLUEPRINT.md](docs/BLUEPRINT.md)
- [docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md)
- [docs/admin-panel-verification.md](docs/admin-panel-verification.md)

## Trạng thái hiện tại

Các module đã có và đang dùng được:
- `Auth`: login, refresh, logout, forgot/reset password
- `Dashboard`: KPI, pipeline, revenue chart, tasks, activity feed
- `Customers`: list, detail, create, edit, soft delete, contacts
- `Projects`: list, detail, create, edit, soft delete, kanban, native drag-drop status
- `Quotes`: list, detail, create, edit, duplicate/versioning, status actions, HTML preview, backend PDF
- `Contracts`: list, detail, create, edit, milestone, payment, attachment upload, acceptance preview, acceptance PDF
- `Activities`: list, detail, create, edit, delete
- `Calendar`: week view, interaction, reschedule
- `Reports`: overview, revenue trend, status breakdown, top customers
- `Users`: admin user management page
- `Admin Panel`: company info, logo upload, policies, roles, permissions, RBAC

Các điểm đã được xác minh gần nhất:
- `backend` build pass
- `frontend` build pass
- `docker compose up -d --build backend frontend` pass
- PDF routes hoạt động:
  - `GET /api/quotes/:id/pdf`
  - `GET /api/contracts/:id/acceptance-pdf`
- Contract attachment upload hoạt động qua `POST /api/upload/file`
- Projects kanban drag-drop hoạt động và persist sau reload
- Admin panel smoke script có tại [scripts/test-admin-panel.sh](scripts/test-admin-panel.sh)

## Kiến trúc

```text
frontend (Next.js 14, port 3000)
  -> REST /api/*
backend (NestJS 10, port 3001)
  -> Prisma ORM
PostgreSQL 16
Redis 7
uploads/ local disk
Puppeteer PDF rendering
```

### Backend
- NestJS 10
- Prisma 5
- PostgreSQL 16
- Redis 7
- JWT access/refresh
- Zod validation pipe
- Transform interceptor với response `{ data, meta }`
- Local file upload tại `backend/uploads/`
- Puppeteer cho PDF quotes/contracts

### Frontend
- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS
- TanStack Query
- Zustand
- React Hook Form + Zod
- Axios client với refresh-token interceptor

## Cấu trúc repo

```text
AHSO-CRM/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── src/
│       ├── auth/
│       ├── common/
│       ├── contacts/
│       ├── customers/
│       ├── dashboard/
│       ├── projects/
│       ├── quotes/
│       ├── contracts/
│       ├── activities/
│       ├── calendar/
│       ├── reports/
│       ├── settings/
│       ├── roles/
│       ├── permissions/
│       ├── upload/
│       └── users/
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   └── (dashboard)/
│   ├── components/
│   ├── hooks/
│   └── lib/
├── docs/
├── scripts/
├── docker-compose.yml
└── docker-compose.dev.yml
```

## Routes chính

### Frontend
- `/login`
- `/forgot-password`
- `/reset-password`
- `/dashboard`
- `/customers`
- `/projects`
- `/quotes`
- `/contracts`
- `/activities`
- `/calendar`
- `/reports`
- `/users`
- `/admin`

### API
- `/api/auth/*`
- `/api/dashboard/*`
- `/api/customers/*`
- `/api/projects/*`
- `/api/quotes/*`
- `/api/contracts/*`
- `/api/activities/*`
- `/api/calendar/*`
- `/api/reports/*`
- `/api/settings/*`
- `/api/roles/*`
- `/api/permissions/*`
- `/api/upload/*`

Swagger:
- `http://localhost:3001/api/docs`

## Chạy bằng Docker

Yêu cầu:
- Docker Desktop / Docker Compose v2

### 1. Chuẩn bị env

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

### 2. Khởi động stack

```bash
docker compose up -d --build backend frontend
```

Services:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

### 3. Kiểm tra nhanh

```bash
docker ps
docker logs ahso-crm-backend-1 --tail 50
docker exec ahso-crm-backend-1 npx prisma migrate status
```

## Chạy local không dùng full Docker

### Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Lưu ý:
- Nếu chạy PDF ngoài Docker, máy local cần có Chrome/Chromium để Puppeteer render PDF.

## Biến môi trường

### Root

```env
POSTGRES_PASSWORD="ahso_dev_password"
```

### Backend

Các biến mẫu nằm trong [backend/.env.example](backend/.env.example), gồm:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_EXPIRES_IN`
- `JWT_RESET_SECRET`
- `UPLOAD_DIR`
- `PORT`
- `CORS_ORIGIN`
- `SWAGGER_ENABLED`

### Frontend

Các biến mẫu nằm trong [frontend/.env.local.example](frontend/.env.local.example):
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_NAME`

## Tài khoản seed

```text
ADMIN   admin@ahso.vn    / AHSO123!
MANAGER manager@ahso.vn  / AHSO123!
STAFF   staff@ahso.vn    / AHSO123!
```

## Commands hay dùng

### Build

```bash
cd backend && npm run build
cd frontend && npm run build
```

### Seed lại dữ liệu dev

```bash
cd backend && npm run prisma:seed
```

### Rebuild app containers

```bash
docker compose up -d --build backend frontend
```

### Smoke test admin panel

```bash
./scripts/test-admin-panel.sh
```

## Kiểm thử hiện có

Backend unit tests:
- `auth.service.spec.ts`
- `quotes.service.spec.ts`
- `contracts.service.spec.ts`

Chạy:

```bash
cd backend
npm test
```

## File quan trọng cho phase gần nhất

- Quotes PDF:
  - [backend/src/quotes/quotes-pdf.service.ts](backend/src/quotes/quotes-pdf.service.ts)
  - [frontend/app/(dashboard)/quotes/_components/quote-preview-client.tsx](frontend/app/(dashboard)/quotes/_components/quote-preview-client.tsx)
- Contracts acceptance PDF:
  - [backend/src/contracts/contracts-pdf.service.ts](backend/src/contracts/contracts-pdf.service.ts)
  - [frontend/app/(dashboard)/contracts/_components/contract-acceptance-preview-client.tsx](frontend/app/(dashboard)/contracts/_components/contract-acceptance-preview-client.tsx)
- Projects drag-drop:
  - [frontend/app/(dashboard)/projects/_components/project-kanban-board.tsx](frontend/app/(dashboard)/projects/_components/project-kanban-board.tsx)
  - [frontend/hooks/use-projects.ts](frontend/hooks/use-projects.ts)
- Contract attachment upload:
  - [frontend/app/(dashboard)/contracts/_components/contract-file-uploader.tsx](frontend/app/(dashboard)/contracts/_components/contract-file-uploader.tsx)
  - [backend/src/upload/upload.service.ts](backend/src/upload/upload.service.ts)

## Phần còn mở

Những phần chưa khóa hoàn toàn ở thời điểm hiện tại:
- frontend automated tests
- CI/CD pipeline
- hardening production deploy
- một số polish UI giữa các module cũ/mới

## Ghi chú

- `docs/AGENT_HANDOFF.md` hữu ích cho handoff, nhưng source of truth vẫn là code hiện tại trong repo.
- Nếu Docker báo `no space left on device`, dọn build cache:

```bash
docker builder prune -af
```
