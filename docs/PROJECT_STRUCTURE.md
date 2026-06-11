# AHSO CRM — Project Structure & AI Coding Guide

> **Dành cho AI/dev:** Đây là tài liệu tham chiếu chính cho cấu trúc hiện tại của AHSO CRM.
> Trước khi sửa code, hãy đọc file này cùng `CLAUDE.md`.
>
> **Design system:** màu, font, spacing, radius, No-Line Rule và token UI nằm trong `CLAUDE.md`
> và Design Spec v2. File này không lặp lại bảng màu để tránh lệch nguồn.

---

## 1. Thông Tin Dự Án

```text
Tên:        AHSO CRM
URL:        crm.ahso.vn
Công ty:    AHSO — Tự động hoá & Phần mềm Doanh nghiệp
Loại:       B2B CRM — quản lý vòng đời bán hàng kỹ thuật công nghiệp + kho vật tư
Team:       4-10 người, self-hosted qua Docker/VPS
```

Luồng nghiệp vụ chính:

```text
Khách hàng/Lead
→ Khảo sát
→ Dự án/Cơ hội
→ Báo giá
→ Đàm phán
→ Hợp đồng
→ Triển khai
→ Nghiệm thu
→ Thu tiền
→ Bàn giao/lưu hồ sơ

Song song: kho vật tư, phiếu nhập/xuất/chuyển/kiểm kê, phân bổ lô FIFO theo dự án.
```

---

## 2. Tech Stack Đã Chốt

| Tầng | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | Next.js 14 App Router | TypeScript strict |
| UI | shadcn/ui + Tailwind CSS | Token qua CSS variables |
| State | Zustand + TanStack Query 5 | Zustand cho auth/global, Query cho server state |
| Forms | React Hook Form + Zod | Validate client + server |
| Drag/drop | @dnd-kit/core | Kanban, sắp xếp item |
| Charts | Recharts + Nivo | Palette chung từ `frontend/lib/constants.ts` |
| Backend | NestJS 10 | TypeScript strict |
| ORM | Prisma 5 | `backend/prisma/schema.prisma` là source of truth |
| Database | PostgreSQL 16 | Docker |
| Cache/Queue | Redis 7 + BullMQ | |
| Realtime | Socket.IO | Notification, session invalidation |
| Auth | JWT access 15m + refresh 7d + bcrypt | IMAP-first login cho email `@ahso.vn` |
| Email | imapflow + @nestjs-modules/mailer | Mailbox tích hợp CRM |
| Push | web-push | Browser push |
| AI | Anthropic/OpenAI/Gemini providers | AI agents, copilot, usage log |
| PDF | HTML template → PDF | Báo giá, hợp đồng, hồ sơ |
| Monitoring | Sentry + Winston | |
| Deploy | Docker Compose | Self-hosted VPS |
| Font | Be Vietnam Pro | Không dùng font khác |

---

## 3. Data Model — Domain Map

Chi tiết field đọc trực tiếp trong `backend/prisma/schema.prisma`. Schema hiện tại lớn hơn nhiều so với bản tài liệu cũ, gồm auth động, CRM core, inventory, mailbox, AI agents, documents, reports, webhooks, push, custom fields và settings.

### 3.1. Auth & Phân Quyền

| Model | Vai trò |
|---|---|
| `User` | Nhân viên; trỏ tới `UserRole` qua `roleId` |
| `UserRole` | Role động; ADMIN/MANAGER/STAFF là system roles |
| `Permission` | Quyền dạng `resource.action`, gắn nhiều-nhiều với role |
| `UserSession` | Refresh token rotation, hash, một session/user |

Quy tắc runtime:

- Không dùng enum role cũ trong Prisma.
- Access/refresh JWT chỉ dùng làm identity payload; không nhúng quyền thật.
- `JwtStrategy.validate()` hydrate `request.user` từ DB/cache 60s qua `AuthUserCache`.
- Khóa user hoặc đổi role có hiệu lực trong tối đa 60s, và có thể invalidate ngay khi `UsersService`/`RolesService` update.
- `PermissionsGuard` đọc permission từ `request.user`; ADMIN bypass.
- STAFF scoping phải áp dụng ở mọi service có dữ liệu khách hàng: customer, project, quote, contract, activity, survey, search, report.
- Login `@ahso.vn` ưu tiên IMAP/iRedMail. Fallback bcrypt chỉ được dùng khi mail server unreachable hoặc user chưa từng có mailbox.

### 3.2. CRM Core

| Model | Vai trò |
|---|---|
| `Customer` / `Contact` | Khách hàng và đầu mối, soft delete, VIP, dedupe |
| `Project` | Cơ hội/dự án; có `stageChangedAt` cho deal rotting |
| `Quote` / `QuoteItem` | Báo giá, versioning, accepted item subset, total tính server-side |
| `Contract` / `ContractItem` / `Milestone` | Hợp đồng 1-1 với project, milestone nghiệm thu |
| `Payment` | Thanh toán theo contract/project, guard không vượt giá trị |
| `Activity` | CALL/EMAIL/MEETING/TASK/NOTE, gắn customer/project |
| `Survey` / `SurveyMedia` / `SurveyNote` | Khảo sát thực địa, ảnh/file, ghi chú |
| `BusinessDocument` / `ProjectHandover` / `Document*` | Hồ sơ nghiệp vụ, template, PDF artifacts |

Luật chuyển trạng thái:

- Quote ACCEPTED → Project WON + sync `estimatedValue`.
- Contract ACTIVE → Project DELIVERING.
- Contract COMPLETED → Project COMPLETED.
- Contract CANCELLED → Project LOST.
- Mọi nơi đổi `Project.status` phải set `stageChangedAt = new Date()`.

### 3.3. Inventory

| Model | Vai trò |
|---|---|
| `Supplier` / `MaterialCategory` / `Material` / `MaterialSupplier` | Danh mục vật tư, nhà cung cấp, giá |
| `Warehouse` / `StockBalance` | Kho và tồn theo `(warehouseId, materialId)` |
| `StockReceipt` / `StockReceiptItem` / `StockLot` | Phiếu nhập và lô FIFO |
| `StockIssue` / `StockIssueItem` | Phiếu xuất, có thể gắn project |
| `StockTransfer` / `StockTransferItem` | Chuyển kho |
| `StockCount` / `StockCountItem` | Kiểm kê, điều chỉnh lệch |
| `ProjectMaterialAllocation` / `ProjectMaterialAllocationItem` | Phân bổ lô vật tư vào dự án |

Luật tồn kho:

- DRAFT → CONFIRMED/CANCELLED; không có reversal tự động sau CONFIRMED.
- `InventoryBalanceService.adjustBalance()` là cổng duy nhất thay đổi `StockBalance`.
- Delta âm dùng conditional decrement `quantity >= |delta|`; throw nếu `updateMany.count !== 1`.
- `ensureSufficientStock()` chỉ là pre-check để báo lỗi đẹp, không phải nguồn bảo vệ cuối.
- Trừ lô FIFO qua `consumeStockLots()` và cũng dùng conditional `updateMany`.
- Nhập kho cập nhật average cost sau khi đã cộng balance.

### 3.4. Hệ Thống Mở Rộng

| Nhóm | Models/module | Vai trò |
|---|---|---|
| Mailbox | `EmailAccount`, `EmailMessage`, `EmailAttachment` | IMAP sync, IDLE watch, password mã hóa 2 chiều |
| AI providers | `AiProviderCredential`, `AiOAuthState`, `AiUsageLog` | Multi-provider, OAuth, usage log |
| AI agents | `Agent`, `AgentRun`, `AgentMessage`, `AgentToolCall`, `AgentAction` | Agent chạy tool theo quyền user |
| Reporting | `ReportTemplate`, dashboard/report services | Builder + KPI + chart |
| Integration | `Webhook`, `WebhookLog` | Outbound events |
| Notification | `Notification`, `PushSubscription` | Realtime + browser push |
| Customization | `CustomField`, `CustomFieldValue`, `Setting`, `Logo`, `PolicyItem` | Field động, cấu hình, điều khoản |
| Ops | `AuditLog`, backup, health | Audit và vận hành |

---

## 4. Repository Layout

```text
AHSO-CRM/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   └── lib/
├── e2e/
├── docs/
├── scripts/
├── docker-compose.yml
└── package.json
```

Backend modules under `backend/src/`:

```text
auth/ users/ roles/ permissions/
customers/ contacts/ projects/ quotes/ contracts/ activities/ surveys/
business-documents/ documents/
suppliers/ materials/ inventory/ stock-receipts/ stock-issues/ stock-transfers/ stock-counts/
mailbox/ email/ sms/ push/
ai/ ai-credentials/ agents/
dashboard/ reports/ search/ calendar/
notifications/ webhooks/ websocket/
settings/ policy-items/ custom-fields/
audit/ backup/ upload/ health/
common/ domain-events/
```

Frontend structure:

```text
frontend/app/(auth)/
frontend/app/(dashboard)/
  dashboard/ customers/ projects/ quotes/ contracts/ activities/ calendar/
  mailbox/ inventory/ materials/ suppliers/ surveys/ documents/ reports/
  notifications/ agents/ users/ admin/
frontend/components/layout/
frontend/components/shared/
frontend/components/ui/
frontend/hooks/
frontend/lib/
```

---

## 5. API & Data Patterns

Response format chuẩn:

```typescript
{ data: {...}, meta: null }
{ data: [...], meta: { total, page, limit, totalPages } }
{ statusCode: 400, message: "...", errors: [...] }
```

Bulk action format:

```typescript
{
  processedCount: number;
  failedCount: number;
  errors: Array<{ id?: string; name?: string; message: string }>;
}
```

Quy tắc bắt buộc:

```typescript
// Mọi API call frontend qua apiClient.
// Ngoại lệ duy nhất: logout trong lib/auth.ts, đã có comment giải thích.
import { apiClient } from "@/lib/api-client";

// Tiền VND luôn dùng helper.
import { formatVND, formatVNDShort } from "@/lib/format";

// Chart/SVG dùng palette tập trung, không hardcode hex trong component.
import { CHART_COLORS, CHART_STAGE_SERIES } from "@/lib/constants";

// Filter list ghi nhớ bằng hook chung; search input không cần persist.
import { usePersistentState } from "@/hooks/use-persistent-state";
```

UX/component pattern đã có sẵn:

| Pattern | Component |
|---|---|
| Quick-create customer trong form | `components/shared/customer-quick-create-dialog.tsx` |
| Ghi nhanh hoạt động | `components/shared/quick-activity-log.tsx` |
| Command palette | `components/shared/command-palette.tsx` |
| Keyboard shortcuts | `components/shared/global-shortcuts.tsx` |
| KPI sparkline | `components/shared/sparkline.tsx` |
| Empty state có CTA | `components/shared/empty-state.tsx` |
| Quote template MVP | `quotes/_components/quote-template-controls.tsx` |
| Activity icon/token config | `frontend/lib/constants.ts` → `ACTIVITY_TYPE_CONFIG` |

---

## 6. Naming Conventions

```text
Files/folders:      kebab-case
React components:   PascalCase
Functions/vars:     camelCase
Constants:          UPPER_SNAKE_CASE
Types/interfaces:   PascalCase
Prisma models:      PascalCase
API endpoints:      kebab-case plural
Enum values:        UPPER_SNAKE_CASE
```

---

## 7. Docker & Environment

```bash
docker-compose up -d
cd backend && npm run start:dev
cd frontend && npm run dev
```

Prisma:

```bash
npx prisma migrate dev --name <name>
npx prisma generate
npm run seed
```

Backend env quan trọng:

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
JWT_REFRESH_SECRET
JWT_RESET_SECRET
ENCRYPTION_KEY
FRONTEND_URL
SWAGGER_ENABLED
SENTRY_DSN
VAPID_*
AHSO_IMAP_HOST
```

`ENCRYPTION_KEY` dùng mã hóa mailbox password, không commit và phải có quy trình rotate/backup riêng.

Migration hiện có trong plan 11/06/2026:

```text
20260611080000_add_project_stage_changed_at
```

Sau khi đổi schema phải chạy migration và `prisma generate`.

---

## 8. Workflow Khi Nhận Task

### UI/UX

1. Đọc `CLAUDE.md` và Design Spec v2.
2. Kiểm tra component tương tự trước khi tạo mới.
3. Dùng token CSS, AppIcon, semantic constants.
4. Không dùng emoji icon cho UI nghiệp vụ.

### Frontend

1. Dùng `apiClient`.
2. Dùng TanStack Query cho server state.
3. Dùng React Hook Form + Zod cho form.
4. Không dùng `any`.
5. UI text cho người dùng cuối bằng tiếng Việt.

### Backend

1. Đọc `backend/prisma/schema.prisma` trước khi sửa model.
2. Schema đổi thì tạo migration và cập nhật mục domain trong file này.
3. DTO validate bằng Zod.
4. Controller chỉ orchestration mỏng; business logic trong service.
5. Route protected dùng `JwtAuthGuard` + `PermissionsGuard` + `@RequirePermissions`.
6. Nghiệp vụ đổi `Project.status` phải set `stageChangedAt`.

---

## 9. Không Bao Giờ Làm

```text
Không thêm npm package mới khi chưa có lý do rõ.
Không sửa trực tiếp source shadcn trong components/ui nếu có thể wrap ở shared.
Không đổi Prisma schema mà quên migration và docs.
Không fetch trực tiếp thay apiClient, trừ logout.
Không dùng any.
Không hardcode hex trong component UI.
Không dùng font khác ngoài Be Vietnam Pro.
Không dùng tiếng Anh cho user-facing copy trừ technical labels.
Không đổi Project.status mà quên stageChangedAt.
Không trừ tồn kho ngoài InventoryBalanceService.
Không bỏ qua partial failure trong bulk action.
```

---

## 10. Verification Baseline

Trước khi coi một thay đổi là xong:

```bash
cd backend && npm run typecheck && npm run lint && npm test
cd frontend && npm run typecheck && npm run lint && npm run test:unit
```

Nếu chỉ sửa một module hẹp, vẫn chạy ít nhất typecheck + test/lint liên quan và ghi rõ phần chưa chạy.

---

*Cập nhật: 11/06/2026 — v2.0, đồng bộ theo code thực tế và kế hoạch fix 2026-06-11.*
