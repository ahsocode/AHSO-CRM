# Workflow — Quy tắc tự động "Khi… thì…"

> Đặc tả + prompt giao agent. Tham khảo ý tưởng từ Twenty (workflow theo trigger/action), **không sao chép code** (AGPL).
> Quy tắc dự án: đọc `CLAUDE.md`, `docs/GLOSSARY_VI.md`; UI tiếng Việt, token màu, No-Line Rule.

## 1. Mục tiêu

Người dùng ADMIN/MANAGER tự tạo quy tắc không cần code, ví dụ:
- Báo giá đã gửi 3 ngày chưa phản hồi → tạo việc nhắc sales phụ trách.
- Mốc hợp đồng sắp đến hạn 7 ngày → thông báo PM.
- Dự án chuyển sang "Đàm phán" → thông báo MANAGER.
- Vật tư dưới tồn tối thiểu → thông báo bộ phận mua hàng.

Phạm vi v1: **an toàn và dễ đoán** — chỉ 3 loại hành động, không viết code, không vòng lặp, không tự sửa dữ liệu nghiệp vụ.

## 2. Nền đã có (tái sử dụng, không viết lại)

- `backend/src/domain-events/` — `DomainEventsService.emit(event, payload)`; 17 sự kiện trong `DOMAIN_EVENT_NAMES`; đã được `customers`, `quotes`, `contracts`, `projects`, `agents` gọi.
- `NotificationsService` (thông báo trong app + `@Cron` 8h sáng), `PushService`, `WebhooksEmitter`.
- `Activity` (có `scheduledAt`, `userId`) dùng làm "việc cần làm"; `@nestjs/schedule` và `bullmq` đã có trong `package.json`.

## 3. Mô hình dữ liệu (thêm vào `schema.prisma` + migration mới)

```prisma
enum WorkflowTriggerType { EVENT SCHEDULE }          // EVENT: sự kiện nghiệp vụ; SCHEDULE: điều kiện theo thời gian, quét định kỳ
enum WorkflowRunStatus  { SUCCESS PARTIAL FAILED SKIPPED }

model WorkflowRule {
  id          String              @id @default(cuid())
  name        String
  description String?
  isActive    Boolean             @default(true)
  triggerType WorkflowTriggerType
  // EVENT: tên trong DOMAIN_EVENT_NAMES. SCHEDULE: một trong SCHEDULE_TRIGGERS (xem §4)
  trigger     String
  // Tham số của trigger SCHEDULE, ví dụ { "days": 3 }
  triggerConfig Json?
  // Điều kiện bổ sung, AND giữa các phần tử: [{ "field": "project.status", "op": "eq", "value": "NEGOTIATING" }]
  conditions  Json                @default("[]")
  // Danh sách hành động tuần tự (tối đa 5), xem §5
  actions     Json
  createdById String
  createdBy   User                @relation("WorkflowRuleCreatedBy", fields: [createdById], references: [id])
  deletedAt   DateTime?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  runs        WorkflowRun[]

  @@index([triggerType, trigger, isActive])
  @@index([deletedAt])
}

model WorkflowRun {
  id         String            @id @default(cuid())
  ruleId     String
  rule       WorkflowRule      @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  status     WorkflowRunStatus
  // Khóa chống chạy lặp: "<ruleId>:<entityType>:<entityId>:<mốc>" (xem §6)
  dedupeKey  String            @unique
  subjectType String?          // quote | contract | project | milestone | material | customer
  subjectId  String?
  payload    Json?             // ảnh chụp ngữ cảnh đã dùng (đã cắt bớt, không chứa mật khẩu/token)
  results    Json?             // kết quả từng hành động: [{ type, ok, error? }]
  createdAt  DateTime          @default(now())

  @@index([ruleId, createdAt])
  @@index([subjectType, subjectId])
}
```
Thêm quan hệ ngược `workflowRulesCreated WorkflowRule[] @relation("WorkflowRuleCreatedBy")` vào `User`. Cập nhật `docs/PROJECT_STRUCTURE.md` mục 3.4. Migration chỉ thêm bảng, đặt tên `YYYYMMDDHHMMSS_workflow_rules`.

## 4. Trigger

**EVENT** (v1 chấp nhận): `quote.sent`, `quote.accepted`, `quote.rejected`, `project.status_changed`, `project.created`, `contract.signed`, `contract.completed`, `payment.received`, `customer.created`, `customer.assigned`, `activity.assigned`.

**SCHEDULE** (quét mỗi giờ, cron `"0 * * * *"`, bỏ qua giờ 22h–6h giờ Việt Nam để không tạo việc ban đêm):

| Mã | Ý nghĩa | `triggerConfig` | Đối tượng |
|---|---|---|---|
| `quote.no_response` | Báo giá trạng thái SENT, `sentAt` quá N ngày, chưa ACCEPTED/REJECTED | `{ days: 1..60 }` | quote |
| `milestone.due_soon` | Mốc chưa hoàn thành, đến hạn trong N ngày | `{ days: 1..30 }` | milestone |
| `payment.overdue` | Khoản thanh toán / mốc thu tiền quá hạn N ngày | `{ days: 0..90 }` | contract |
| `project.stale` | Dự án chưa chuyển stage quá N ngày (dùng `stageChangedAt`) | `{ days: 3..90 }` | project |
| `material.low_stock` | Tồn kho tổng < `minStock` | `{}` | material |

Nếu thiếu dữ liệu để dựng trigger nào (ví dụ không có khái niệm quá hạn thanh toán), **bỏ trigger đó và ghi vào báo cáo cuối**, không tự bịa.

## 5. Điều kiện và hành động

**Điều kiện** — toán tử: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`. Trường chỉ được lấy từ **danh sách trắng theo trigger** (ví dụ `project.status`, `project.estimatedValue`, `quote.total`, `customer.isVip`); trường lạ → 400. Đánh giá trên ngữ cảnh do backend dựng, **không** eval chuỗi người dùng nhập.

**Hành động** (`actions[]`, tối đa 5, chạy tuần tự, lỗi một hành động không chặn các hành động sau — ghi `PARTIAL`):
1. `CREATE_TASK` — `{ title, content?, assignee: "OWNER" | "ACTOR" | "<userId>", dueInDays?: number }` → tạo `Activity` (type công việc/nhắc việc theo enum `ActivityType` hiện có), gắn `customerId`/`projectId` nếu có. `OWNER` = người phụ trách khách hàng/dự án; không xác định được → bỏ qua hành động và ghi lý do.
2. `NOTIFY` — `{ title, message, recipients: "OWNER" | "ROLE:ADMIN" | "ROLE:MANAGER" | "<userId>" }` → dùng `NotificationsService` (+ push nếu service đã hỗ trợ).
3. `CALL_WEBHOOK` — `{ webhookId }` chọn **webhook đã đăng ký sẵn** (không cho nhập URL tự do → tránh SSRF); gửi qua `WebhooksEmitter` với ngữ cảnh quy tắc.

Mẫu chuỗi trong `title`/`message`: chỉ thay `{{biến}}` từ danh sách trắng của trigger (ví dụ `{{quote.quoteNo}}`, `{{project.name}}`, `{{customer.name}}`, `{{days}}`). Biến lạ giữ nguyên, không lỗi. Không dùng template engine có thể thực thi mã.

## 6. Chạy, chống lặp, an toàn

- `WorkflowEngine.handleDomainEvent(envelope)` được `DomainEventsService.emit` gọi **sau** các xử lý hiện có, bọc `try/catch` — **workflow lỗi tuyệt đối không làm hỏng thao tác nghiệp vụ gốc** (không throw ra ngoài).
- `WorkflowScheduler` quét SCHEDULE mỗi giờ; mỗi quy tắc xử lý tối đa 200 đối tượng/lần.
- `dedupeKey`: EVENT = `<ruleId>:<event.id>`; SCHEDULE = `<ruleId>:<subjectType>:<subjectId>:<mốc>` với mốc là ngày (YYYY-MM-DD) của lần kích hoạt đầu (nhắc lại hằng ngày thì thêm ngày; v1 chỉ nhắc **một lần** cho mỗi đối tượng). Trùng khóa → bỏ qua (`SKIPPED`), dựa vào unique index, không check-then-insert.
- Giới hạn: tối đa 50 quy tắc đang bật; một sự kiện chỉ kích hoạt tối đa 20 lần chạy; quy tắc có hành động tạo việc không được kích hoạt bởi chính sự kiện `activity.assigned` do nó tạo ra (chống vòng lặp: đánh dấu `payload.workflowRunId` và bỏ qua).
- Quy tắc chạy dưới quyền hệ thống nhưng chỉ ghi vào phạm vi hành động §5; kết quả `WorkflowRun` lưu 90 ngày (dọn bằng cron hằng đêm).

## 7. API (`/api/workflow-rules`, guard `JwtAuthGuard` + `PermissionsGuard`)

| Method | Route | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/workflow-rules` | `settings.view` + ADMIN/MANAGER | danh sách + lần chạy gần nhất |
| GET | `/workflow-rules/meta` | như trên | trả danh sách trigger, trường điều kiện, biến mẫu, loại hành động (để UI dựng form, tránh hard-code 2 nơi) |
| GET | `/workflow-rules/:id` | như trên | kèm 20 lần chạy gần nhất |
| POST | `/workflow-rules` | `settings.edit` + ADMIN/MANAGER | DTO Zod; kiểm tra trigger/trường/hành động trong danh sách trắng, `webhookId` tồn tại |
| PATCH | `/workflow-rules/:id` | như trên | |
| POST | `/workflow-rules/:id/toggle` | như trên | bật/tắt |
| POST | `/workflow-rules/:id/test` | như trên | **chạy thử khô**: trả danh sách đối tượng sẽ khớp và nội dung hành động, **không** ghi gì |
| DELETE | `/workflow-rules/:id` | ADMIN | soft delete |
| GET | `/workflow-rules/:id/runs` | ADMIN/MANAGER | phân trang |

Quy tắc leo thang quyền (đã có trong `auth/privilege-escalation.ts`): MANAGER không được cấu hình hành động gán cho `ROLE:ADMIN`… tức `NOTIFY` tới ADMIN thì được, nhưng `CREATE_TASK` gán cho người dùng ngoài phạm vi quản lý của MANAGER thì chặn nếu hệ thống có khái niệm phạm vi; nếu không có thì cho phép.

## 8. UI (frontend)

- Menu **Quản trị → Quy tắc tự động** (`/admin/workflows`), chỉ ADMIN/MANAGER.
- Danh sách: tên, trigger (nhãn tiếng Việt), trạng thái bật/tắt (công tắc), lần chạy gần nhất + kết quả, số lần chạy 7 ngày.
- Trình soạn (`/admin/workflows/[id]`, `/new`): 3 khối dọc — **Khi nào** (chọn trigger + tham số số ngày), **Nếu** (thêm điều kiện, tối đa 5), **Thì** (thêm hành động, tối đa 5, chọn người nhận/webhook bằng select). Mọi danh sách lấy từ `/workflow-rules/meta`. Nút **Chạy thử** hiện bảng "Sẽ khớp N đối tượng" trước khi bật.
- Tab **Lịch sử chạy**: thời gian, đối tượng (link tới bản ghi), trạng thái, lỗi từng hành động.
- Nhãn tiếng Việt cho trigger/hành động/trạng thái đặt trong `frontend/lib/constants.ts`.

## 9. Kiểm thử bắt buộc

- Unit (jest): engine khớp/không khớp điều kiện; từng toán tử; dedupe (chạy hai lần chỉ một `WorkflowRun`); lỗi hành động → `PARTIAL` và **không** throw vào `emit`; trường lạ bị chặn; chống vòng lặp `activity.assigned`; `OWNER` không xác định → bỏ qua có lý do; scheduler chỉ xử lý đối tượng đủ điều kiện và tôn trọng giới hạn 200.
- Bảo mật: STAFF → 403 mọi route; không token → 401; `CALL_WEBHOOK` không nhận URL.
- E2E (`e2e/workflow.spec.ts`, `test.describe("Quy tắc tự động", ...)`): tạo quy tắc "báo giá được chấp nhận → thông báo ADMIN" qua UI, chuyển báo giá sang ACCEPTED qua API, kiểm tra có thông báo và một dòng lịch sử `SUCCESS`; chạy thử khô không ghi dữ liệu; tắt quy tắc thì không chạy.

## 10. Kế hoạch giao việc

| Bước | Việc | Model |
|---|---|---|
| 1 | Schema + migration + `WorkflowEngine` + `WorkflowScheduler` + API + unit test (§3–7, 9) | **Sonnet** |
| 2 | UI quản trị + e2e (§8, 9) — **sau** bước 1 | **Sonnet** |
| 3 | Rà soát chữ Việt/token (chỉ file mới) | **Haiku** |
| 4 | Review bảo mật + full QA + push | **Opus** |

Dán `[KHỐI QUY TẮC CHUNG]` từ `docs/BOM_AGENT_PROMPTS.md` vào mỗi prompt.

### Prompt bước 1 (Sonnet)

```
Bạn là dev backend AHSO CRM (NestJS 10 + Prisma 5 + Zod). Repo: thư mục hiện tại.
[KHỐI QUY TẮC CHUNG]
Đọc docs/WORKFLOW_SPEC.md (chuẩn), CLAUDE.md, backend/src/domain-events/, notifications/,
webhooks/, backend/src/auth/privilege-escalation.ts.
NHIỆM VỤ: cài đặt §3–§7 và §9 phần unit/bảo mật của đặc tả.
- Schema + migration thêm bảng (không đổi bảng cũ). Cập nhật docs/PROJECT_STRUCTURE.md.
- Module backend/src/workflows/ (controller, service, engine, scheduler, dto, constants danh sách trắng,
  *.spec.ts), đăng ký trong app.module.ts. Nối engine vào DomainEventsService.emit SAU các xử lý cũ,
  bọc try/catch, không để lỗi lan ra.
- Mọi route có JwtAuthGuard + PermissionsGuard/Roles; static_checks check guard phải 0 ERROR.
- Trigger nào thiếu dữ liệu nền tảng trong schema thì BỎ và ghi vào báo cáo, không tự thêm bảng/cột ngoài §3.
- Không thêm npm package. Không đụng frontend.
Kiểm tra: tsc backend, jest backend (module mới + domain-events + notifications), static_checks.
Commit: "feat(workflow): rule engine, scheduler and API". Báo cáo ≤ 20 dòng: trigger nào đã làm / bỏ.
```

### Prompt bước 2 (Sonnet)

```
Bạn là dev frontend AHSO CRM (Next.js 14, TS strict, Tailwind token, shadcn/ui, TanStack Query, RHF+Zod).
[KHỐI QUY TẮC CHUNG]
Đọc docs/WORKFLOW_SPEC.md §8–§9, backend/src/workflows/ (API đã xong), một trang admin hiện có để giữ pattern,
và frontend/components/shared/ (dùng lại, không tự tạo lại component).
NHIỆM VỤ: UI quản trị quy tắc tự động + hooks + nhãn tiếng Việt + e2e/workflow.spec.ts theo §8–§9.
- Danh sách trigger/trường/hành động lấy từ GET /workflow-rules/meta, không hard-code lại.
- Chạy thử khô phải hiển thị rõ "chưa ghi gì".
- Dialog đặt ngoài <form>, reset form bằng giá trị cụ thể.
Chạy: npm run qa:prepush -- --e2e-only --grep "Quy tắc tự động".
Commit: "feat(workflow): admin UI and e2e". Báo cáo ≤ 15 dòng.
```

### Prompt bước 3 (Haiku) và 4 (Opus)

```
[Haiku] Rà soát các file mới của 2 commit workflow gần nhất: chữ hiển thị tiếng Việt theo GLOSSARY_VI.md,
không hex, No-Line Rule, tiền dùng formatVND. Không đổi logic. static_checks 0 error. Commit "style(workflow): ...".

[Opus] Review commit workflow: (1) lỗi workflow không làm hỏng emit() gốc; (2) dedupe dựa unique index;
(3) không có đường thực thi mã/URL tự do/SSRF; (4) STAFF không truy cập được; (5) migration khớp schema
(prisma migrate diff rỗng); (6) chạy npm run qa:prepush đầy đủ. Báo cáo theo mức độ và lệnh push.
```
