# Agent Handoff

Tài liệu này phản ánh trạng thái thực tế của branch `feature/backend-services-ai` sau đợt fix pack cho `documents`, `reports` và release readiness. Khi có xung đột giữa tài liệu cũ và code hiện tại, ưu tiên:

1. `git status` / `git log`
2. code hiện tại trong `backend/src` và `frontend/app`
3. tài liệu này

## Snapshot hiện tại

- Repo: `AHSO-CRM`
- Branch: `feature/backend-services-ai`
- Frontend dev URL: `http://localhost:3000`
- Backend API URL: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/api/docs`
- Tài khoản seed:
  - `admin@ahso.vn / AHSO123!`
  - `manager@ahso.vn / AHSO123!`
  - `staff@ahso.vn / AHSO123!`

## Những phần production-ready

- Auth JWT + refresh token + middleware bảo vệ route
- RBAC admin panel: settings, roles, permissions, logo upload
- Customers / Projects / Quotes / Contracts / Activities / Calendar / Dashboard
- Local file uploads qua `/uploads/*`
- Quotes PDF backend
- Contracts acceptance PDF backend
- Document runtime và drag-drop editor cho:
  - `QUOTATION`
  - `CONTRACT`
- Notifications realtime foundation, email service, webhooks, audit logs

## Những phần beta / internal

- Tất cả document templates ngoài:
  - `QUOTATION`
  - `CONTRACT`
- Một số `DocumentDataLoaderService` beta template vẫn chứa dữ liệu mẫu ở các section chưa map đủ schema
- Advanced reports vẫn cần business validation thêm, nhất là các chart phân tích cao cấp
- Push notifications và SMS mới ở mức cần verify bằng môi trường thật trước khi rollout

## Những phần deferred

- Google OAuth / Microsoft OAuth
- Multi-tenant
- Offline mutation queue / background sync
- Gesture-heavy mobile interactions

## Semantics documents đã chốt

### Render / Download

- `POST /api/documents/:type/:entityId/render`
  - tạo **một version tài liệu mới**
  - render PDF một lần
  - lưu PDF thật vào local uploads
  - tạo đúng một bản ghi `Document`
  - trả về:
    - `documentId`
    - `number`
    - `downloadUrl`
    - `renderedAt`

- `GET /api/documents/:documentId/download`
  - tải lại artifact đã render
  - **không** tạo số tài liệu mới
  - **không** insert `Document` mới

- `GET /api/documents/:type/:entityId/download`
  - chỉ để backward-compatible
  - tải document mới nhất đã tồn tại theo `type + entityId + language`
  - nếu chưa render thì trả lỗi rõ ràng, không render ngầm

### Preview HTML

- Frontend dùng route protected:
  - `/documents/preview?type=...&entityId=...&lang=...`
- Route này fetch preview HTML qua `apiClient` để giữ auth cùng origin frontend

### Template readiness

- `QUOTATION`
  - `runtimeStatus = production`
  - `endUserEnabled = true`
- `CONTRACT`
  - `runtimeStatus = production`
  - `endUserEnabled = true`
- Tất cả loại khác
  - `runtimeStatus = beta`
  - `endUserEnabled = false`

Kết quả:
- `DocumentActions` chỉ hiển thị `QUOTATION` và `CONTRACT`
- `/admin/document-templates` vẫn hiển thị toàn bộ template với badge `Production` / `Beta`

## Entry points quan trọng

### Backend

- Documents:
  - `backend/src/documents/documents.service.ts`
  - `backend/src/documents/documents.controller.ts`
  - `backend/src/documents/document-template-variants.service.ts`
  - `backend/src/documents/document-data-loader.service.ts`
  - `backend/src/documents/template-registry.ts`
- Reports:
  - `backend/src/reports/reports.service.ts`
- Upload:
  - `backend/src/upload/upload.service.ts`
- Prisma:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations`

### Frontend

- Document actions:
  - `frontend/components/shared/document-actions.tsx`
  - `frontend/hooks/use-documents.ts`
  - `frontend/app/documents/preview/page.tsx`
- Admin template editor:
  - `frontend/app/(dashboard)/admin/document-templates`
- Reports UI:
  - `frontend/app/(dashboard)/reports/_components/reports-client.tsx`
- Route protection:
  - `frontend/middleware.ts`

## Regression coverage hiện có / đang cần ưu tiên

### Đã có

- Backend unit tests cho:
  - auth
  - quotes
  - contracts
  - activities
  - dashboard
  - reports
  - AI
  - email
  - webhooks
  - documents lifecycle
  - document template variants
- Playwright smoke cho:
  - auth
  - dashboard
  - customers
  - projects
  - quotes
  - contracts
  - admin
  - calendar

### Cần theo dõi thêm

- Document template editor interactions sâu hơn:
  - drag/drop nhiều box
  - approval / set active cạnh tranh
- Realtime / notification edge cases
- Push notifications trên môi trường browser thật
- Business validation cho advanced reports

## Lưu ý cho agent tiếp theo

- Không over-claim documents: end-user runtime hiện chỉ mở cho `QUOTATION` và `CONTRACT`.
- Nếu cần sửa thêm document template runtime, luôn kiểm tra:
  - active variant
  - fallback HBS
  - preview frontend route
  - render/download semantics
- Nếu cần rollout thêm template production, phải làm đủ 3 lớp:
  - data loader thật
  - runtimeStatus/endUserEnabled trong registry
  - smoke test preview + PDF
