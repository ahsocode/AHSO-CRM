# Agent Handoff

Tài liệu này là snapshot để agent mới có thể tiếp tục công việc trong `AHSO-CRM` mà không phải dò lại toàn bộ lịch sử.

## Snapshot

- Repo: `https://github.com/ahsocode/AHSO-CRM`
- Branch hiện tại: `main`
- Remote HEAD gần nhất đã push: `19422dd` `feat: add contract form and detail actions frontend`
- Workspace local tại thời điểm ghi chú: clean working tree
- Docker stack đang chạy:
  - Frontend: `http://localhost:3000`
  - Backend: `http://localhost:3001`
  - Postgres: `5432`
  - Redis: `6379`

## Tài khoản seed

- Email: `admin@ahso.vn`
- Password: `AHSO123!`

## Recent Commits

- `19422dd` `feat: add contract form and detail actions frontend`
- `d3bbd21` `feat: add contract create and update backend`
- `11ff912` `feat: add quote workflow frontend actions`
- `ddb295c` `feat: add quote workflow backend actions`
- `878a612` `feat: add ahso crm sales and delivery workflows`
- `6fb5805` `feat: add calendar reports and contract workflows`

## Đã Hoàn Thành

### Foundation

- Next.js App Router frontend
- NestJS + Prisma backend
- Docker Compose cho `frontend`, `backend`, `postgres`, `redis`
- JWT auth với login / refresh / logout
- Route protection bằng middleware frontend

### Dashboard

- Dashboard thật đã có API và UI

### Customers

- `customers` list/detail thật
- create / update / soft delete customer
- create / update / delete contacts

### Projects

- list/detail thật
- create / update / soft delete project
- kanban / update status

### Quotes

- list / detail / preview thật
- create quote
- update quote
- duplicate quote version
- update quote status
- route `/quotes/[id]/edit`
- CTA tạo contract từ accepted quote

### Contracts

- list / detail thật
- create contract
- update contract
- route `/contracts/new`
- route `/contracts/[id]/edit`
- create / update milestones
- create payments
- CTA tạo contract từ `projects` và `quotes`

### Calendar / Reports

- `calendar` và `reports` đã có API + UI thật ở mức phase hiện tại

## Chưa Hoàn Thành

- `forgot-password` mới là UI stub, chưa có reset token flow thật
- Chưa có auto tests bài bản cho auth / quotes / contracts
- Chưa có upload file thật cho `contract.fileUrl`, hiện là link text
- Chưa có PDF / acceptance document workflow cho contracts
- Chưa có CI/CD và hardening production

## Trạng Thái Thực Tế So Với README

`README.md` hiện có phần trạng thái module cũ hơn tiến độ thực tế. Khi cần nguồn sự thật cho tiến độ gần nhất, ưu tiên:

1. `docs/AGENT_HANDOFF.md`
2. `git log --oneline`
3. code hiện tại trong `frontend/app/(dashboard)` và `backend/src`

## Entry Points Quan Trọng

### Backend

- Auth: `backend/src/auth`
- Customers: `backend/src/customers`, `backend/src/contacts`
- Projects: `backend/src/projects`
- Quotes: `backend/src/quotes`
- Contracts: `backend/src/contracts`
- Prisma schema + seed: `backend/prisma/schema.prisma`, `backend/prisma/seed.ts`

### Frontend

- Layout shell: `frontend/components/layout`
- Route protection: `frontend/middleware.ts`
- Shared API/types: `frontend/lib/api-client.ts`, `frontend/lib/types.ts`
- Query hooks: `frontend/hooks`
- Quotes UI: `frontend/app/(dashboard)/quotes`
- Contracts UI: `frontend/app/(dashboard)/contracts`
- Projects UI: `frontend/app/(dashboard)/projects`

## Hành Vi Nghiệp Vụ Quan Trọng

### Quotes

- Quote editable khi status là `DRAFT` hoặc `REJECTED`
- Duplicate quote tạo version mới ở `DRAFT`
- Quote `ACCEPTED` có thể đẩy project từ pre-sale sang `WON`
- Nếu project đã có contract thì quote workflow bị khóa phù hợp

### Contracts

- `POST /api/contracts` tự sinh `contractNo` dạng `HD-YYYY-XXX`
- 1 project chỉ có 1 contract
- Có thể tạo contract từ project + accepted quote
- Khi tạo/update contract:
  - `ACTIVE` hoặc `SUSPENDED` => project chuyển `DELIVERING`
  - `COMPLETED` => project chuyển `COMPLETED`
  - `CANCELLED` => project hiện quay về `WON`

## Routes Đã Có

### Frontend

- `/login`
- `/forgot-password`
- `/dashboard`
- `/customers`
- `/customers/new`
- `/customers/[id]`
- `/customers/[id]/edit`
- `/projects`
- `/projects/new`
- `/projects/[id]`
- `/projects/[id]/edit`
- `/quotes`
- `/quotes/new`
- `/quotes/[id]`
- `/quotes/[id]/edit`
- `/quotes/[id]/preview`
- `/contracts`
- `/contracts/new`
- `/contracts/[id]`
- `/contracts/[id]/edit`
- `/calendar`
- `/reports`

### Backend

- Auth:
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
- Users:
  - `GET /api/users`
  - `PATCH /api/users/:id`
- Customers / Contacts:
  - `GET/POST /api/customers`
  - `GET/PATCH/DELETE /api/customers/:id`
  - `GET /api/customers/:id/stats`
  - `GET/POST /api/customers/:customerId/contacts`
  - `PATCH/DELETE /api/contacts/:id`
- Projects:
  - `GET/POST /api/projects`
  - `GET/PATCH/DELETE /api/projects/:id`
  - `PATCH /api/projects/:id/status`
- Quotes:
  - `GET/POST /api/quotes`
  - `GET/PATCH /api/quotes/:id`
  - `POST /api/quotes/:id/duplicate`
  - `PATCH /api/quotes/:id/status`
- Contracts:
  - `GET/POST /api/contracts`
  - `GET/PATCH /api/contracts/:id`
  - `POST /api/contracts/:id/milestones`
  - `PATCH /api/contracts/milestones/:id`
  - `POST /api/contracts/:id/payments`
- Calendar:
  - `GET /api/calendar/events`
- Reports:
  - `GET /api/reports/overview`
  - `GET /api/reports/revenue-trend`
  - `GET /api/reports/status-breakdown`
  - `GET /api/reports/top-customers`

## Runbook Nhanh

### Chạy stack

```bash
docker compose up -d --build
docker compose ps
```

### Kiểm tra cơ bản

```bash
node -e "fetch('http://127.0.0.1:3000/login').then(r=>console.log(r.status))"
node -e "fetch('http://127.0.0.1:3001/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@ahso.vn',password:'AHSO123!'})}).then(r=>console.log(r.status))"
```

### Build sạch trong container nếu local bị nhiễu

Frontend local từng gặp lỗi `next/dist/compiled/semver/package.json` bị corrupt trong `node_modules`. Nếu local build lỗi kiểu này, ưu tiên:

1. rebuild bằng Docker
2. hoặc xóa `frontend/node_modules` rồi cài lại

### Mẫu xác minh route protected

```bash
node -e "fetch('http://127.0.0.1:3000/contracts/new',{headers:{cookie:'ahso_access_token=test; ahso_refresh_token=test'},redirect:'manual'}).then(r=>console.log(r.status))"
```

## Bước Tiếp Theo Đề Xuất

Ưu tiên hợp lý nhất:

1. `forgot-password` backend
   - tạo reset token
   - invalidate token
   - đổi mật khẩu thật
2. `forgot-password` frontend
   - gửi email/reset request UI thật
   - màn hình đặt lại mật khẩu
3. test coverage tối thiểu
   - auth smoke
   - quote workflow
   - contract workflow

## Ghi Chú Cho Agent Tiếp Theo

- Giữ nhịp commit nhỏ, tách backend trước rồi frontend sau là đang hiệu quả và dễ review.
- Khi cần xác minh build, Docker là nguồn xác minh ổn định hơn local install hiện tại.
- Đừng suy ra tiến độ từ README status table cũ; kiểm tra code hiện tại trước.
