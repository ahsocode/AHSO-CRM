# AHSO CRM - B2B Sales Management System

A comprehensive Customer Relationship Management system for B2B sales organizations. The current branch is strongest in the core CRM workflow and selected document flows, while a few enterprise/document/reporting areas are still intentionally marked beta or deferred.

**Status**: ✅ Core CRM, auth, admin RBAC, quote/contract workflows and selected document runtime are operational  
**Version**: 1.1  
**Last Updated**: April 2026

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Core Modules](#-core-features)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Architecture](#-architecture)
- [Troubleshooting](#-troubleshooting)
- [Future Roadmap](#-roadmap)

---

## 🎯 Features

### Current Release Readiness

**Production-ready in this branch**
- Core CRM modules: customers, projects, quotes, contracts, activities, calendar, dashboard
- Auth + refresh token flow, RBAC, admin settings/roles/permissions
- Local uploads for logo/files
- Quote PDF and contract acceptance/contract document runtime for end-user flows
- Document template editor runtime for `QUOTATION` and `CONTRACT`
- Email, webhooks, audit logs, realtime notifications foundation

**Beta / internal**
- Document templates other than `QUOTATION` and `CONTRACT`
- Advanced analytics such as customer journey Sankey and report builder outputs still need business validation
- Push notifications and manual Twilio SMS service need environment-level verification before rollout

**Deferred**
- Google / Microsoft OAuth
- Multi-tenant support
- Offline mutation queue / background sync
- Gesture-heavy mobile workflows

**Complete Sales Lifecycle Management**:
- 📊 **Customers** - Lead tracking, contact management, company hierarchy
- 📈 **Projects** - Kanban pipeline with 7 stages, drag-drop workflow
- 📄 **Quotes** - PDF generation, versioning, status tracking
- 📋 **Contracts** - Signature tracking, milestone management, payments
- 📞 **Activities** - Call logs, emails, meetings, follow-ups (7 types)
- 📅 **Calendar** - Google Calendar-style event management
- 📊 **Dashboard** - KPI metrics, revenue trends, pipeline analysis
- 📈 **Reports** - Sales analytics, revenue forecasting, status breakdowns
- 🛡️ **Admin Panel** - Settings, policies, RBAC, user management
- 🤖 **AI Assistant** - Claude-powered summary, follow-up suggestion, email drafting, revenue forecast
- 📬 **Automation** - SMTP email templates, webhook delivery, audit logs, scheduled reminders

---

## 🛠 Tech Stack

### Frontend
- **Next.js 14** (App Router) + TypeScript
- **React 18** + Hooks
- **Tailwind CSS** - Responsive design
- **React Hook Form** + **Zod** - Form validation
- **TanStack Query** - Data fetching & caching
- **Zustand** - State management
- **Recharts** - Data visualization
- **shadcn/ui** - Component library

### Backend
- **NestJS 10** - Node.js framework
- **Prisma** - ORM with migrations
- **PostgreSQL 16** - Database
- **Redis 7** - Caching
- **JWT** - Authentication
- **Zod** - Request validation
- **Puppeteer** - PDF generation
- **Anthropic Claude API** - AI assistant actions
- **Nodemailer / SMTP** - Transactional email
- **Twilio** - Manual SMS service
- **Winston + Sentry** - Logging & error tracking

### Deployment
- **Docker Compose** - Containerization
- **Self-hosted** - Full control

---

## ⚡ Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 16 (or Docker)
- Redis 7 (or Docker)

### Installation

**1. Clone & Install**
```bash
git clone https://github.com/your-org/ahso-crm.git
cd AHSO-CRM

# Root (Playwright)
npm install

# Frontend
cd frontend && npm install && cd ..

# Backend
cd backend && npm install && cd ..
```

**2. Environment Setup**
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit files with your configuration
```

Key backend envs:
- `ANTHROPIC_API_KEY` - Claude API
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`
- `SENTRY_DSN`

**3. Database Setup**
```bash
cd backend
npm run prisma:migrate  # Run migrations
npm run prisma:seed     # Load test data
```

**4. Run Development Servers**
```bash
# Terminal 1: Backend
cd backend && npm run start:dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

**5. Login**
```
Email: admin@ahso.vn
Password: AHSO123!
```

### Docker Compose

```bash
docker compose up -d --build
docker exec ahso-crm-backend npm run prisma:seed
```

---

## 📱 Core Features

### 📊 Customers Module
- List/detail views with search & filtering
- Contact management within customers
- Customer statistics (projects, revenue)
- Soft delete with recovery option

### 📈 Projects Module
- **Kanban Board** - 7 stages with drag-drop
- **Status Transitions** - Workflow validation
- **Timeline** - Activity history & changes
- **Customer Linking** - Full project context

### 📄 Quotes Module
- Full CRUD with status workflow
- **PDF Generation** - Beautiful output
- **Send Quote** - Email báo giá + đính kèm PDF
- **Line Items** - Quantity, pricing, totals
- **Versioning** - Track all versions
- **Duplication** - Create from templates

### 📋 Contracts Module
- Full lifecycle management
- **Milestones** - Delivery tracking
- **Payments** - Payment logging
- **Acceptance PDF** - Signature documents
- **Attachments** - File management
- **Signed Contract Email** - Auto notify when contract becomes active

### 🧾 Documents Module
- `POST /api/documents/:type/:entityId/render` creates a new document version, renders PDF once and stores the PDF under local uploads
- `GET /api/documents/:documentId/download` downloads an existing rendered artifact without creating a new version
- End-user document actions are intentionally limited to `QUOTATION` and `CONTRACT` in this branch
- `/admin/document-templates` shows all template types, but only `QUOTATION` and `CONTRACT` are production runtime targets today

### 📞 Activities Module
7 Activity Types:
- 📞 CALL - Phone conversations
- 📧 EMAIL - Email communications  
- 🤝 MEETING - In-person meetings
- 🔍 SURVEY - Customer surveys
- 📺 DEMO - Product demonstrations
- 📝 NOTE - Internal notes
- 🔗 FOLLOWUP - Follow-up tasks

### 📅 Calendar
- **Week View** - Google Calendar style (7 days max)
- **Month View** - Auto-scale 1-3 columns
- **Drag-to-Reschedule** - Move activities
- **Smart Search** - Jump to dates

### 📊 Dashboard
- KPI cards (revenue, projects, quotes, contracts)
- 6-month revenue trend chart
- Pipeline distribution
- Today's task checklist
- Recent activity feed

### 📈 Reports
- Revenue trends & forecasting
- Status breakdown charts
- Top customers by revenue
- Pipeline value analysis

### 🤖 AI & Automation
- Claude AI endpoints for account summary, next-step suggestion, email draft, weighted revenue forecast
- Webhook delivery with HMAC signing + retry
- Audit log API for POST/PATCH/DELETE + login events
- Daily reminder cron for milestone and payment due items
- Manual Twilio SMS service for future workflow integration only

---

## 🔐 Security & Access Control

### Authentication
- **JWT Tokens** - 15 min access, 7 day refresh
- **bcrypt** - Password hashing
- **Refresh Rotation** - Automatic token refresh
- **Password Reset** - Secure email flow
- **Rate Limit** - Global + endpoint-specific throttling

### Authorization (RBAC)
- **3 System Roles**: ADMIN, MANAGER, STAFF
- **Custom Roles** - Granular permissions
- **Resource × Action** - Fine-grained control
- **Permission Gates** - On all endpoints

### Data Security
- ✅ HTTPS/TLS encryption
- ✅ CORS policy enforcement
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Helmet security headers
- ✅ Structured audit logs
- ✅ Sentry backend error tracking

---

## 📊 API Documentation

**Base URL**: `http://localhost:3001/api`  
**Swagger Docs**: `http://localhost:3001/api/docs`

**Response Format**:
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

**Authentication**:
```
Authorization: Bearer {accessToken}
```

---

## 🧪 Testing

```bash
cd backend

# Run unit tests
npm test

# Coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Specific module
npm test -- customers

# Root Playwright smoke tests
cd ..
npm run test:e2e
```

**Test Accounts**:
- admin@ahso.vn / AHSO123! (ADMIN)
- manager@ahso.vn / AHSO123! (MANAGER)
- staff@ahso.vn / AHSO123! (STAFF)

---

## 🚀 Deployment

### Docker Compose
```bash
docker compose -f docker-compose.yml up -d --build
docker compose logs -f
docker compose down
```

### Environment Variables

**Backend**:
```
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
JWT_SECRET=min-32-characters
NODE_ENV=production
```

**Frontend**:
```
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_NAME=AHSO CRM
```

---

## 📁 Architecture

```
frontend/
├── app/                 # Next.js App Router
│   ├── (auth)/         # Login, password reset
│   └── (dashboard)/    # Protected pages
├── components/         # Reusable components
├── hooks/             # Custom hooks
└── lib/               # Utilities

backend/
├── src/
│   ├── auth/          # Authentication
│   ├── customers/     # Customers module
│   ├── projects/      # Projects module
│   ├── quotes/        # Quotes module
│   ├── contracts/     # Contracts module
│   ├── activities/    # Activities module
│   ├── calendar/      # Calendar module
│   ├── dashboard/     # KPI aggregation
│   ├── reports/       # Analytics
│   ├── admin/         # Admin panel
│   └── common/        # Shared utilities
└── prisma/           # Database schema
```

---

## 🐛 Troubleshooting

**Database Connection**
```bash
docker ps | grep postgres
docker logs ahso-crm-postgres
```

**Port Conflicts**
```bash
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

**Missing Dependencies**
```bash
rm -rf node_modules package-lock.json
npm install
rm -rf frontend/.next
```

---

## 📚 Documentation

- [Complete Feature Documentation](docs/COMPLETION_SUMMARY.md)
- [Project Architecture](docs/PROJECT_STRUCTURE.md)
- [Database Schema](backend/prisma/schema.prisma)
- [API Documentation](http://localhost:3001/api/docs)

---

## 🚀 Future Enhancements

- **Phase 7**: AI features (Claude API integration)
- **Phase 8**: Mobile app (React Native)
- **Phase 9**: Enterprise features (SSO, multi-tenant)

---

## ✅ Quality Assurance

- ✅ 17/17 backend modules implemented
- ✅ 20/20 frontend pages implemented
- ✅ Unit tests for core services
- ✅ Database migrations tested
- ✅ Docker deployment verified
- ✅ Type safety (TypeScript strict)
- ✅ Code formatting (Prettier)
- ✅ Linting (ESLint)

---

**Last Updated**: April 19, 2026  
**Status**: Production Ready ✅
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
