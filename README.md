# AHSO CRM

> B2B CRM cho vòng đời bán hàng kỹ thuật công nghiệp: **Khách hàng → Dự án → Báo giá → Hợp đồng → Nghiệm thu → Thanh toán**.

AHSO CRM là hệ thống quản trị quan hệ khách hàng dành cho thị trường B2B (cơ khí — tự động hoá — điện công nghiệp) tại Việt Nam. Dự án được thiết kế theo spec trong [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) với UX tham chiếu từ bộ thiết kế Google Stitch (xem `docs/design/`).

Tiến độ triển khai và handoff mới nhất cho agent tiếp theo: [`docs/AGENT_HANDOFF.md`](docs/AGENT_HANDOFF.md).

<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs" />
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-10-e0234e?logo=nestjs" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" />
  <img alt="TailwindCSS" src="https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ed?logo=docker" />
</p>

---

## Mục lục

- [Tính năng chính](#tính-năng-chính)
- [Kiến trúc & Tech stack](#kiến-trúc--tech-stack)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Khởi động nhanh (Local)](#khởi-động-nhanh-local)
- [Chạy bằng Docker](#chạy-bằng-docker)
- [Biến môi trường](#biến-môi-trường)
- [Database & Prisma](#database--prisma)
- [API Reference](#api-reference)
- [Quy ước code](#quy-ước-code)
- [Roadmap](#roadmap)
- [Tài khoản seed & dữ liệu mẫu](#tài-khoản-seed--dữ-liệu-mẫu)
- [Tham khảo](#tham-khảo)

---

## Tính năng chính

| Module | Mô tả | Trạng thái |
|---|---|---|
| **Authentication** | JWT access + refresh token rotation, bcrypt, rate-limit đăng nhập | ✅ |
| **Dashboard** | KPI (doanh thu, dự án, công nợ), biểu đồ 6 tháng, pipeline, công việc hôm nay | ✅ |
| **Customers** | Danh sách + chi tiết, phân quyền theo role, hệ thống contact & activity | ✅ BE / 🚧 FE |
| **Projects** | Pipeline kiểu Kanban theo stage (SURVEY → COMPLETED), drag-drop status | 🚧 |
| **Quotes** | Tạo báo giá nhiều phiên bản, xuất PDF Puppeteer, chuyển đổi thành Contract | 🚧 |
| **Contracts** | Hợp đồng + Milestone + Payment tracking, số ngày quá hạn | 🚧 |
| **Activities** | Log gọi / email / họp / khảo sát, timeline theo khách hàng & dự án | 🚧 |
| **Calendar** | Lịch công việc, reminder, gán task cho nhân viên | 🚧 |
| **Reports** | Báo cáo doanh thu, pipeline, retention, export | 🚧 |
| **File Upload** | Tài liệu khảo sát, hợp đồng ký, attachments | 🚧 |

**Phân quyền (RBAC):**
- `ADMIN` — toàn quyền, quản lý user
- `MANAGER` — quản lý toàn bộ dự án & khách hàng
- `STAFF` — chỉ thấy khách hàng / dự án được assign

---

## Kiến trúc & Tech stack

```
┌──────────────────┐     HTTP/JSON      ┌──────────────────┐     Prisma      ┌────────────┐
│  Next.js 14      │ ─────────────────▶ │  NestJS 10       │ ───────────────▶│ PostgreSQL │
│  App Router      │  Bearer JWT        │  REST /api/*     │                 │     16     │
│  (frontend:3000) │                    │  (backend:3001)  │                 └────────────┘
└──────────────────┘                    │                  │ ◀─── session ──▶ ┌─────────┐
                                        └──────────────────┘                  │ Redis 7 │
                                                                              └─────────┘
```

### Frontend
- **Next.js 14** App Router, TypeScript strict
- **TanStack Query** (server state) + **Zustand** (auth state)
- **React Hook Form** + **Zod** cho forms + validation
- **shadcn/ui** + **Tailwind CSS** (design tokens khớp Stitch)
- **Recharts** cho dashboard charts
- Axios client với refresh-token interceptor

### Backend
- **NestJS 10** với Prisma ORM
- **PostgreSQL 16** (chính), **Redis 7** (cache/session)
- Auth: `@nestjs/jwt` + `bcrypt` + refresh token rotation (hash trong DB)
- Validation: Zod + `ZodValidationPipe` custom
- Security: `helmet`, `@nestjs/throttler` (rate limiting auth endpoints)
- API docs: **Swagger** tại `/api/docs`
- File upload: local disk (`backend/uploads/`)
- PDF: Puppeteer (cho quotes & contracts)

### DevOps
- Docker Compose (1 VPS đủ chạy cả stack)
- Prisma migrations + seed script
- `.env` per service

---

## Cấu trúc thư mục

```
AHSO-CRM/
├── backend/                       # NestJS API
│   ├── prisma/
│   │   ├── schema.prisma          # 10 models + 8 enums
│   │   ├── migrations/
│   │   └── seed.ts                # Dữ liệu mẫu
│   └── src/
│       ├── main.ts                # Bootstrap + Swagger + CORS + helmet
│       ├── app.module.ts
│       ├── common/                # Filters, interceptors, guards, pipes
│       ├── auth/                  # login / refresh / logout
│       ├── users/
│       ├── customers/
│       ├── contacts/
│       ├── projects/
│       ├── quotes/
│       ├── contracts/
│       ├── activities/
│       ├── calendar/
│       ├── reports/
│       ├── dashboard/
│       └── upload/
├── frontend/                      # Next.js 14
│   ├── app/
│   │   ├── (auth)/                # login, forgot-password
│   │   └── (dashboard)/           # dashboard, customers, projects, quotes, contracts, calendar, reports
│   ├── components/
│   │   ├── ui/                    # shadcn components
│   │   ├── layout/                # sidebar, topbar, dashboard-shell
│   │   └── shared/                # app-icon, module-placeholder, …
│   ├── hooks/                     # use-auth, use-customers, use-projects, …
│   ├── lib/                       # api-client, auth, constants, format, types
│   └── middleware.ts              # Route protection
├── docs/
│   ├── PROJECT_STRUCTURE.md       # Spec chi tiết (nguồn sự thật)
│   ├── BLUEPRINT.md
│   └── design/                    # Screenshots từ Google Stitch
├── docker-compose.yml             # Production stack
├── docker-compose.dev.yml         # Override cho dev (bind mount + watch)
└── .env.example
```

---

## Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu |
|---|---|
| Node.js | 20 LTS |
| npm | 10 |
| Docker + Docker Compose | 24 / v2 |
| PostgreSQL | 16 *(không cần nếu dùng Docker)* |
| Redis | 7 *(không cần nếu dùng Docker)* |

---

## Khởi động nhanh (Local)

### 1. Clone repo

```bash
git clone https://github.com/ahsocode/AHSO-CRM.git
cd AHSO-CRM
```

### 2. Cài dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 3. Chuẩn bị env

```bash
# Root (dùng cho Docker)
cp .env.example .env

# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.local.example frontend/.env.local
```

### 4. Khởi chạy PostgreSQL + Redis (Docker)

```bash
docker compose up -d postgres redis
```

### 5. Migrate + seed database

```bash
cd backend
npm run prisma:migrate          # apply migrations
npm run prisma:seed             # seed dữ liệu demo
```

### 6. Chạy dev servers

```bash
# Terminal 1
cd backend && npm run start:dev   # http://localhost:3001

# Terminal 2
cd frontend && npm run dev        # http://localhost:3000
```

Mở trình duyệt:

- UI: http://localhost:3000
- API docs (Swagger): http://localhost:3001/api/docs
- Health check: http://localhost:3001/api

---

## Chạy bằng Docker

Chạy cả stack (postgres + redis + backend + frontend) trong containers:

```bash
# Production build
docker compose up -d --build

# Dev mode (bind mount + hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Xem logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

---

## Biến môi trường

### `backend/.env`

| Key | Mặc định | Mô tả |
|---|---|---|
| `DATABASE_URL` | `postgresql://ahso:ahso_dev_password@localhost:5432/ahso_crm?schema=public` | Prisma connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis |
| `JWT_SECRET` | — | **BẮT BUỘC ĐỔI ở production** |
| `JWT_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token TTL |
| `UPLOAD_DIR` | `./uploads` | Thư mục lưu file tải lên |
| `PORT` | `3001` | Port backend |
| `NODE_ENV` | `development` | `development` / `production` |
| `CORS_ORIGIN` | `http://localhost:3000` | Có thể là danh sách, ngăn cách bằng dấu phẩy |
| `SWAGGER_ENABLED` | auto | Ép bật Swagger ở production (`true`) |
| `AUTH_THROTTLE_TTL` | `60` | Thời gian window (giây) cho rate limit `/auth/*` |
| `AUTH_THROTTLE_LIMIT` | `10` | Số request tối đa / window / IP |

### `frontend/.env.local`

| Key | Mặc định | Mô tả |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL gốc của backend (prefix `/api` sẽ được tự thêm) |
| `NEXT_PUBLIC_APP_NAME` | `AHSO CRM` | Hiển thị trên UI |

### Root `.env` (cho docker compose)

| Key | Mô tả |
|---|---|
| `POSTGRES_PASSWORD` | Password DB dùng bởi service `postgres` |

---

## Database & Prisma

**Models chính:** `User`, `Customer`, `Contact`, `Project`, `Quote`, `QuoteItem`, `Contract`, `Milestone`, `Payment`, `Activity`.

**Enums:** `Role`, `CustomerStatus`, `ProjectStatus`, `QuoteStatus`, `ContractStatus`, `MilestoneStatus`, `ActivityType`, `Priority`.

Tất cả bảng đều có `deletedAt` (soft delete) và timestamps.

```bash
# Tạo migration mới sau khi sửa schema.prisma
cd backend && npx prisma migrate dev --name <tên_migration>

# Chỉ regen Prisma Client (không chạm DB)
npm run prisma:generate

# Apply migration ở production
npm run prisma:deploy

# Mở Prisma Studio
npx prisma studio
```

---

## API Reference

### Format response chuẩn

Tất cả response đi qua `TransformInterceptor` và có dạng:

```jsonc
// Success — single item
{ "data": { /* ... */ }, "meta": null }

// Success — list có pagination
{
  "data": [ /* ... */ ],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}

// Error
{ "statusCode": 400, "message": "Thông điệp tiếng Việt", "errors": ["field: lỗi"] }
```

### Endpoints (prefix `/api`)

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/auth/login` | — | Đăng nhập (rate-limited) |
| POST | `/api/auth/refresh` | — | Đổi refresh → access mới |
| POST | `/api/auth/logout` | ✅ | Thu hồi refresh token |
| GET | `/api/dashboard/kpis` | ✅ | KPI tổng quan |
| GET | `/api/dashboard/revenue-chart` | ✅ | Doanh thu 6 tháng |
| GET | `/api/dashboard/pipeline` | ✅ | Pipeline theo stage |
| GET | `/api/customers` | ✅ | List + filter + pagination |
| POST | `/api/customers` | ✅ | Tạo khách hàng |
| GET | `/api/customers/:id` | ✅ | Chi tiết + relations |
| PATCH | `/api/customers/:id` | ✅ | Cập nhật |
| DELETE | `/api/customers/:id` | ✅ | Soft delete |
| GET | `/api/projects` | ✅ | Pipeline Kanban |
| … | … | … | Xem đầy đủ ở Swagger |

**Xem interactive docs:** http://localhost:3001/api/docs (Swagger UI, Bearer Auth).

---

## Quy ước code

> Trích từ [`docs/PROJECT_STRUCTURE.md §10`](docs/PROJECT_STRUCTURE.md) — AI Coding Rules.

1. **TypeScript strict** — không `any`, luôn export types từ `lib/types.ts`.
2. **Files kebab-case** (`customer-table.tsx`), **Components PascalCase** (`CustomerTable`), **Enum values UPPER_SNAKE_CASE**.
3. **React Hook Form + Zod** cho mọi form, không dùng state manual.
4. **Error messages tiếng Việt** — hiển thị cho end-user.
5. **Format ngày `dd/MM/yyyy`, tiền `VND` không lẻ** — dùng `lib/format.ts`.
6. **Soft delete** — không DELETE thực, set `deletedAt`.
7. **Response format `{data, meta}`** — không lệch khỏi `TransformInterceptor`.
8. **Service layer purity** — không gọi Prisma từ controller.
9. **Auth: JWT short (15m) + refresh rotation** — không bao giờ lưu plain password / token.
10. **Tailwind tokens** — không hard-code màu, dùng CSS variables từ `tailwind.config.ts`.

---

## Roadmap

- [x] **Week 1** — Setup + Docker + Auth + Layouts
- [ ] **Week 2** — Customers (BE ✅ / FE 🚧)
- [ ] **Week 3** — Projects + Kanban drag-drop
- [ ] **Week 4** — Quotes + Puppeteer PDF
- [ ] **Week 5** — Contracts + Milestones + Payments
- [ ] **Week 6** — Dashboard polish + real-time
- [ ] **Week 7** — Activities + Calendar
- [ ] **Week 8** — Reports + Testing + Deploy

Chi tiết kế hoạch: xem [`docs/PROJECT_STRUCTURE.md §9`](docs/PROJECT_STRUCTURE.md).

---

## Tài khoản seed & dữ liệu mẫu

Sau khi chạy `npm run prisma:seed`:

| Email | Mật khẩu | Role |
|---|---|---|
| `admin@ahso.vn` | `AHSO123!` | ADMIN |
| `manager@ahso.vn` | `AHSO123!` | MANAGER |

**Customers (4):** Vinamilk, Thaco, Bệnh viện Chợ Rẫy, DNP
**Projects (6):** Trải qua cả 6 stage (SURVEY → COMPLETED)
**Plus:** 3 quotes, 2 contracts, 3 milestones, 5 payments, 5 activities.

> ⚠️ `seed.ts` hiện xoá sạch DB trước khi seed — chỉ dùng ở dev.

---

## Tham khảo

- 📘 [Project Structure Spec](docs/PROJECT_STRUCTURE.md) — spec đầy đủ, **single source of truth**
- 📘 [Blueprint](docs/BLUEPRINT.md)
- 🎨 [Design screenshots](docs/design/) — từ Google Stitch
- 🏛️ [NestJS docs](https://docs.nestjs.com/)
- ⚡ [Next.js App Router](https://nextjs.org/docs/app)
- 🔷 [Prisma docs](https://www.prisma.io/docs)

---

## License

Private project — © AHSO Industrial Automation.
