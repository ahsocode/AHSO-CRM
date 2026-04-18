# AHSO CRM — Project Structure & AI Coding Guide

> **Dành cho AI:** Đây là tài liệu tham chiếu chính cho toàn bộ dự án AHSO CRM.
> Trước khi viết bất kỳ dòng code nào, hãy đọc toàn bộ file này.
> Mọi quyết định về cấu trúc, naming, pattern đều phải tuân theo tài liệu này.

---

## 1. THÔNG TIN DỰ ÁN

```
Tên:        AHSO CRM
Công ty:    AHSO — Tự động hoá & Phần mềm Doanh nghiệp
Loại:       B2B CRM — quản lý vòng đời bán hàng kỹ thuật công nghiệp
Team:       4–10 người, self-hosted
Phương án:  Solo vibe code, AI-assisted
```

### Luồng nghiệp vụ chính (theo thứ tự)
```
Khách hàng (Lead) → Khảo sát → Báo giá → Đàm phán → Hợp đồng → Triển khai → Nghiệm thu → Thu tiền
```

---

## 2. TECH STACK (ĐÃ CHỐT — KHÔNG THAY ĐỔI)

| Tầng | Công nghệ | Phiên bản | Ghi chú |
|---|---|---|---|
| Frontend | Next.js | 14.x (App Router) | TypeScript strict |
| UI Components | shadcn/ui + Tailwind CSS | latest | Không dùng MUI, Ant Design |
| State | Zustand | 4.x | Chỉ cho global state |
| Data Fetching | TanStack Query | 5.x | Mọi API call |
| Forms | React Hook Form + Zod | latest | Validate cả client + server |
| Backend | NestJS | 10.x | TypeScript strict |
| ORM | Prisma | 5.x | Source of truth cho DB schema |
| Database | PostgreSQL | 16 | Docker image |
| Cache | Redis | 7 | Session, rate limit |
| Auth | JWT (access + refresh token) | — | bcrypt cho password |
| PDF | Puppeteer | latest | HTML template → PDF |
| Charts | Recharts | 2.x | Dashboard charts |
| Deploy | Docker Compose | — | Single server / VPS |
| Font | Be Vietnam Pro | — | Vietnamese-friendly |

---

## 3. DESIGN SYSTEM (THEO STITCH DESIGN ĐÃ CHỐT)

### Color Tokens
```css
/* Brand */
--color-primary:        #1A5276;   /* xanh đậm — sidebar, header buttons */
--color-primary-light:  #2E86C1;   /* xanh vừa — links, icons active */
--color-primary-hover:  #154360;   /* hover state cho primary */
--color-accent:         #E67E22;   /* cam — active nav, CTA phụ, badge urgent */

/* Backgrounds */
--color-bg-page:        #F4F6F8;   /* nền tổng thể */
--color-bg-card:        #FFFFFF;   /* card, panel, modal */
--color-bg-sidebar:     #1A5276;   /* sidebar background */
--color-bg-input:       #FFFFFF;
--color-bg-hover:       #EBF5FB;   /* row hover, item hover */

/* Text */
--color-text-primary:   #1C2833;   /* heading, label */
--color-text-secondary: #5D6D7E;   /* body, description */
--color-text-muted:     #ABB2B9;   /* placeholder, disabled */
--color-text-sidebar:   #FFFFFF;   /* text trong sidebar */

/* Status */
--color-success:        #1E8449;
--color-success-bg:     #D5F5E3;
--color-warning:        #B7950B;
--color-warning-bg:     #FDEBD0;
--color-danger:         #C0392B;
--color-danger-bg:      #FADBD8;
--color-info:           #2E86C1;
--color-info-bg:        #D6EAF8;

/* Borders */
--color-border:         #D5D8DC;
--color-border-focus:   #2E86C1;

/* Pipeline stage colors */
--color-stage-survey:      #95A5A6;   /* Khảo sát — gray */
--color-stage-quoting:     #2E86C1;   /* Báo giá — blue */
--color-stage-negotiating: #E67E22;   /* Đàm phán — orange */
--color-stage-delivering:  #17A589;   /* Triển khai — teal */
--color-stage-completed:   #1E8449;   /* Hoàn thành — green */
```

### Typography
```css
font-family: 'Be Vietnam Pro', Inter, sans-serif;

/* Scale */
--text-xs:   12px;
--text-sm:   13px;
--text-base: 14px;
--text-md:   16px;
--text-lg:   18px;
--text-xl:   24px;
--text-2xl:  28px;
--text-3xl:  32px;

/* Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold) */
/* Page titles: 28px / 700 / --color-text-primary */
/* Section headings: 16px / 600 / --color-text-primary */
/* Body: 14px / 400 / --color-text-secondary */
/* Numbers/values: tabular-nums, 700 */
```

### Spacing & Layout
```
Base unit: 4px
Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px

Sidebar width:      240px (fixed)
Topbar height:      64px (fixed)
Content padding:    24px all sides
Card padding:       20px
Border radius:      6px (default), 4px (badge/input), 20px (pill)
Shadow sm:          0 1px 4px rgba(0,0,0,0.08)
Shadow md:          0 4px 12px rgba(0,0,0,0.12)
Min viewport:       1280px
```

### Component Patterns (shadcn/ui base)
```
Button variants:    primary (#1A5276), outline, ghost, destructive
Badge variants:     success, warning, danger, info, gray (dùng cho status)
Input:              border #D5D8DC, focus ring #2E86C1
Table:              hover row bg #EBF5FB, header bg #F4F6F8
Card:               white bg, shadow-sm, radius-md
```

---

## 4. CẤU TRÚC THƯ MỤC

```
ahso-crm/
│
├── 📄 docker-compose.yml              # Chạy toàn bộ hệ thống
├── 📄 docker-compose.dev.yml          # Dev overrides
├── 📄 .env.example                    # Template biến môi trường
├── 📄 PROJECT_STRUCTURE.md           # File này — đọc trước khi code
│
├── 📁 frontend/                       # Next.js 14 App Router
│   ├── 📄 package.json
│   ├── 📄 next.config.ts
│   ├── 📄 tailwind.config.ts          # Extend với design tokens AHSO
│   ├── 📄 tsconfig.json
│   │
│   ├── 📁 app/                        # App Router — mỗi folder = 1 route
│   │   ├── 📄 layout.tsx              # Root layout: font, providers
│   │   ├── 📄 globals.css             # CSS variables + base styles
│   │   │
│   │   ├── 📁 (auth)/                 # Route group — không có sidebar
│   │   │   ├── 📄 layout.tsx          # Auth layout: centered, no nav
│   │   │   ├── 📁 login/
│   │   │   │   └── 📄 page.tsx        # Trang đăng nhập
│   │   │   └── 📁 forgot-password/
│   │   │       └── 📄 page.tsx
│   │   │
│   │   ├── 📁 (dashboard)/            # Route group — có sidebar + topbar
│   │   │   ├── 📄 layout.tsx          # Dashboard layout: sidebar + topbar + content
│   │   │   │
│   │   │   ├── 📁 dashboard/          # /dashboard
│   │   │   │   ├── 📄 page.tsx        # Tổng quan hoạt động
│   │   │   │   └── 📁 _components/
│   │   │   │       ├── 📄 kpi-cards.tsx          # 4 KPI cards
│   │   │   │       ├── 📄 revenue-chart.tsx       # Recharts bar chart
│   │   │   │       ├── 📄 project-donut.tsx       # Donut chart cơ cấu
│   │   │   │       ├── 📄 pipeline-preview.tsx    # Mini kanban preview
│   │   │   │       ├── 📄 task-checklist.tsx      # Việc cần làm hôm nay
│   │   │   │       └── 📄 activity-feed.tsx       # Hoạt động gần đây
│   │   │   │
│   │   │   ├── 📁 customers/          # /customers
│   │   │   │   ├── 📄 page.tsx        # Danh sách khách hàng
│   │   │   │   ├── 📁 [id]/
│   │   │   │   │   └── 📄 page.tsx    # Chi tiết khách hàng
│   │   │   │   └── 📁 _components/
│   │   │   │       ├── 📄 customer-table.tsx      # Bảng danh sách
│   │   │   │       ├── 📄 customer-filters.tsx    # Filter + search bar
│   │   │   │       ├── 📄 customer-header.tsx     # Header chi tiết KH (VPC logo, stats)
│   │   │   │       ├── 📄 customer-tabs.tsx       # Tab navigation
│   │   │   │       ├── 📄 customer-info-card.tsx  # Thông tin cơ bản 2 cột
│   │   │   │       ├── 📄 customer-projects.tsx   # Dự án gần đây với progress bar
│   │   │   │       ├── 📄 activity-timeline.tsx   # Nhật ký hoạt động (dùng chung)
│   │   │   │       ├── 📄 quick-note-input.tsx    # Ô thêm ghi chú nhanh
│   │   │   │       ├── 📄 customer-form.tsx       # Form tạo/sửa khách hàng
│   │   │   │       └── 📄 stats-panel.tsx         # Panel doanh thu quý, KH mới
│   │   │   │
│   │   │   ├── 📁 projects/           # /projects
│   │   │   │   ├── 📄 page.tsx        # Pipeline kanban view
│   │   │   │   ├── 📁 [id]/
│   │   │   │   │   └── 📄 page.tsx    # Chi tiết dự án
│   │   │   │   └── 📁 _components/
│   │   │   │       ├── 📄 kanban-board.tsx        # Board container + horizontal scroll
│   │   │   │       ├── 📄 kanban-column.tsx       # Cột stage: header + cards + add btn
│   │   │   │       ├── 📄 project-card.tsx        # Card dự án: left-border, value, days
│   │   │   │       ├── 📄 project-list-view.tsx   # Alternate list view
│   │   │   │       ├── 📄 project-form.tsx        # Form tạo/sửa dự án
│   │   │   │       └── 📄 view-toggle.tsx         # Kanban / Danh sách toggle
│   │   │   │
│   │   │   ├── 📁 quotes/             # /quotes
│   │   │   │   ├── 📄 page.tsx        # Danh sách báo giá
│   │   │   │   ├── 📁 new/
│   │   │   │   │   └── 📄 page.tsx    # Tạo báo giá mới
│   │   │   │   ├── 📁 [id]/
│   │   │   │   │   ├── 📄 page.tsx    # Chi tiết / sửa báo giá
│   │   │   │   │   └── 📁 preview/
│   │   │   │   │       └── 📄 page.tsx # Preview PDF trong modal
│   │   │   │   └── 📁 _components/
│   │   │   │       ├── 📄 quote-form.tsx           # Form chính tạo báo giá
│   │   │   │       ├── 📄 quote-progress-bar.tsx   # 3-step: Nháp → Gửi → Chấp nhận
│   │   │   │       ├── 📄 quote-items-table.tsx    # Bảng hạng mục inline editable
│   │   │   │       ├── 📄 quote-item-row.tsx       # Mỗi hàng: drag handle, inputs
│   │   │   │       ├── 📄 quote-summary-panel.tsx  # Panel sticky: subtotal, VAT, total
│   │   │   │       ├── 📄 quote-terms.tsx          # Điều khoản & điều kiện
│   │   │   │       ├── 📄 quote-action-bar.tsx     # Sticky bottom: Lưu/PDF/Gửi
│   │   │   │       ├── 📄 quote-pdf-preview.tsx    # Modal preview A4
│   │   │   │       └── 📄 quote-table.tsx          # Danh sách báo giá
│   │   │   │
│   │   │   ├── 📁 contracts/          # /contracts
│   │   │   │   ├── 📄 page.tsx        # Danh sách hợp đồng
│   │   │   │   ├── 📁 [id]/
│   │   │   │   │   └── 📄 page.tsx    # Chi tiết hợp đồng
│   │   │   │   └── 📁 _components/
│   │   │   │       ├── 📄 contract-form.tsx
│   │   │   │       ├── 📄 milestone-tracker.tsx   # Cột mốc + progress
│   │   │   │       ├── 📄 payment-log.tsx          # Lịch sử thanh toán
│   │   │   │       └── 📄 acceptance-form.tsx     # Biên bản nghiệm thu
│   │   │   │
│   │   │   ├── 📁 calendar/           # /calendar
│   │   │   │   └── 📄 page.tsx        # Lịch & công việc
│   │   │   │
│   │   │   └── 📁 reports/            # /reports
│   │   │       └── 📄 page.tsx        # Báo cáo doanh số
│   │   │
│   │   └── 📁 api/                    # Next.js API routes (minimal — chỉ proxy)
│   │       └── 📁 auth/
│   │           └── 📄 [...nextauth]/route.ts
│   │
│   ├── 📁 components/                 # Shared UI components
│   │   ├── 📁 ui/                     # shadcn/ui components (auto-generated)
│   │   │   ├── 📄 button.tsx
│   │   │   ├── 📄 input.tsx
│   │   │   ├── 📄 badge.tsx
│   │   │   ├── 📄 card.tsx
│   │   │   ├── 📄 dialog.tsx
│   │   │   ├── 📄 dropdown-menu.tsx
│   │   │   ├── 📄 select.tsx
│   │   │   ├── 📄 table.tsx
│   │   │   ├── 📄 tabs.tsx
│   │   │   ├── 📄 toast.tsx
│   │   │   └── 📄 ...                 # Thêm khi cần, không tạo thủ công
│   │   │
│   │   ├── 📁 layout/                 # Layout components
│   │   │   ├── 📄 sidebar.tsx         # Sidebar với nav items, logo AHSO
│   │   │   ├── 📄 topbar.tsx          # Search bar + notification + add button
│   │   │   ├── 📄 page-header.tsx     # Title + breadcrumb + action buttons
│   │   │   └── 📄 content-area.tsx    # Scrollable content wrapper
│   │   │
│   │   └── 📁 shared/                 # Business components dùng nhiều nơi
│   │       ├── 📄 status-badge.tsx    # Badge màu theo CustomerStatus/ProjectStatus
│   │       ├── 📄 currency-display.tsx # Format VND: 1.245.000.000 ₫
│   │       ├── 📄 avatar-initials.tsx  # Avatar chữ viết tắt (VPC, ABC...)
│   │       ├── 📄 empty-state.tsx      # Màn hình trống
│   │       ├── 📄 loading-skeleton.tsx # Skeleton loading
│   │       ├── 📄 confirm-dialog.tsx   # Dialog xác nhận xoá
│   │       ├── 📄 date-picker-vn.tsx   # Date picker locale tiếng Việt
│   │       └── 📄 pdf-modal.tsx        # Modal xem trước PDF (dùng chung)
│   │
│   ├── 📁 lib/                        # Utilities & config
│   │   ├── 📄 api-client.ts           # Axios instance với interceptors
│   │   ├── 📄 auth.ts                 # Token storage, refresh logic
│   │   ├── 📄 format.ts               # formatCurrency, formatDate, formatVND
│   │   ├── 📄 utils.ts                # cn() và helpers nhỏ
│   │   └── 📄 constants.ts            # API_URL, STAGES, STATUS_LABELS...
│   │
│   └── 📁 hooks/                      # Custom React hooks
│       ├── 📄 use-auth.ts             # useAuth() — user, login, logout
│       ├── 📄 use-customers.ts        # TanStack Query hooks cho customers
│       ├── 📄 use-projects.ts
│       ├── 📄 use-quotes.ts
│       └── 📄 use-debounce.ts         # Debounce search input
│
│
├── 📁 backend/                        # NestJS 10
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   │
│   ├── 📁 prisma/
│   │   ├── 📄 schema.prisma           # ⭐ SOURCE OF TRUTH — xem Mục 5
│   │   ├── 📄 seed.ts                 # Dữ liệu mẫu cho dev
│   │   └── 📁 migrations/             # Auto-generated, không sửa tay
│   │
│   └── 📁 src/
│       ├── 📄 main.ts                 # Bootstrap, Swagger, CORS
│       ├── 📄 app.module.ts           # Root module
│       │
│       ├── 📁 common/                 # Shared across modules
│       │   ├── 📁 decorators/
│       │   │   ├── 📄 current-user.decorator.ts
│       │   │   └── 📄 roles.decorator.ts
│       │   ├── 📁 guards/
│       │   │   ├── 📄 jwt-auth.guard.ts
│       │   │   └── 📄 roles.guard.ts
│       │   ├── 📁 filters/
│       │   │   └── 📄 http-exception.filter.ts
│       │   ├── 📁 interceptors/
│       │   │   └── 📄 transform.interceptor.ts   # Wrap response: {data, meta}
│       │   ├── 📁 pipes/
│       │   │   └── 📄 zod-validation.pipe.ts
│       │   └── 📁 dto/
│       │       └── 📄 pagination.dto.ts           # page, limit, search, sortBy
│       │
│       ├── 📁 auth/
│       │   ├── 📄 auth.module.ts
│       │   ├── 📄 auth.controller.ts   # POST /auth/login, /auth/refresh, /auth/logout
│       │   ├── 📄 auth.service.ts
│       │   ├── 📄 jwt.strategy.ts
│       │   └── 📁 dto/
│       │       ├── 📄 login.dto.ts
│       │       └── 📄 refresh-token.dto.ts
│       │
│       ├── 📁 users/
│       │   ├── 📄 users.module.ts
│       │   ├── 📄 users.controller.ts  # GET /users, PATCH /users/:id
│       │   ├── 📄 users.service.ts
│       │   └── 📁 dto/
│       │       └── 📄 update-user.dto.ts
│       │
│       ├── 📁 customers/
│       │   ├── 📄 customers.module.ts
│       │   ├── 📄 customers.controller.ts
│       │   │   # GET    /customers          (list, filter, search, paginate)
│       │   │   # POST   /customers          (tạo mới)
│       │   │   # GET    /customers/:id      (chi tiết + contacts + projects)
│       │   │   # PATCH  /customers/:id      (cập nhật)
│       │   │   # DELETE /customers/:id      (soft delete)
│       │   │   # GET    /customers/:id/stats (tổng giá trị HĐ, số dự án)
│       │   ├── 📄 customers.service.ts
│       │   └── 📁 dto/
│       │       ├── 📄 create-customer.dto.ts
│       │       ├── 📄 update-customer.dto.ts
│       │       └── 📄 customer-filter.dto.ts
│       │
│       ├── 📁 contacts/
│       │   ├── 📄 contacts.module.ts
│       │   ├── 📄 contacts.controller.ts
│       │   │   # GET    /customers/:customerId/contacts
│       │   │   # POST   /customers/:customerId/contacts
│       │   │   # PATCH  /contacts/:id
│       │   │   # DELETE /contacts/:id
│       │   ├── 📄 contacts.service.ts
│       │   └── 📁 dto/
│       │       └── 📄 create-contact.dto.ts
│       │
│       ├── 📁 projects/
│       │   ├── 📄 projects.module.ts
│       │   ├── 📄 projects.controller.ts
│       │   │   # GET    /projects              (kanban — grouped by status)
│       │   │   # GET    /projects?view=list    (list view)
│       │   │   # POST   /projects
│       │   │   # GET    /projects/:id
│       │   │   # PATCH  /projects/:id
│       │   │   # PATCH  /projects/:id/status  (drag-drop stage change)
│       │   │   # DELETE /projects/:id
│       │   ├── 📄 projects.service.ts
│       │   └── 📁 dto/
│       │       ├── 📄 create-project.dto.ts
│       │       ├── 📄 update-project.dto.ts
│       │       └── 📄 update-status.dto.ts
│       │
│       ├── 📁 quotes/
│       │   ├── 📄 quotes.module.ts
│       │   ├── 📄 quotes.controller.ts
│       │   │   # GET    /quotes
│       │   │   # POST   /quotes
│       │   │   # GET    /quotes/:id
│       │   │   # PATCH  /quotes/:id
│       │   │   # POST   /quotes/:id/send      (đổi status → SENT)
│       │   │   # POST   /quotes/:id/duplicate (tạo version mới)
│       │   │   # GET    /quotes/:id/pdf       (xuất PDF binary)
│       │   ├── 📄 quotes.service.ts
│       │   ├── 📄 quotes-pdf.service.ts       # Puppeteer PDF generation
│       │   └── 📁 dto/
│       │       ├── 📄 create-quote.dto.ts
│       │       ├── 📄 update-quote.dto.ts
│       │       └── 📄 quote-item.dto.ts
│       │
│       ├── 📁 contracts/
│       │   ├── 📄 contracts.module.ts
│       │   ├── 📄 contracts.controller.ts
│       │   │   # GET    /contracts
│       │   │   # POST   /contracts
│       │   │   # GET    /contracts/:id
│       │   │   # PATCH  /contracts/:id
│       │   │   # POST   /contracts/:id/milestones
│       │   │   # PATCH  /milestones/:id
│       │   │   # POST   /contracts/:id/payments
│       │   │   # GET    /contracts/:id/acceptance-pdf
│       │   ├── 📄 contracts.service.ts
│       │   ├── 📄 contracts-pdf.service.ts
│       │   └── 📁 dto/
│       │       ├── 📄 create-contract.dto.ts
│       │       ├── 📄 create-milestone.dto.ts
│       │       └── 📄 create-payment.dto.ts
│       │
│       ├── 📁 activities/
│       │   ├── 📄 activities.module.ts
│       │   ├── 📄 activities.controller.ts
│       │   │   # GET    /activities?customerId=&projectId=
│       │   │   # POST   /activities
│       │   │   # PATCH  /activities/:id
│       │   │   # DELETE /activities/:id
│       │   ├── 📄 activities.service.ts
│       │   └── 📁 dto/
│       │       └── 📄 create-activity.dto.ts
│       │
│       ├── 📁 dashboard/
│       │   ├── 📄 dashboard.module.ts
│       │   ├── 📄 dashboard.controller.ts
│       │   │   # GET /dashboard/kpis          (4 KPI cards)
│       │   │   # GET /dashboard/revenue-chart (6 tháng qua)
│       │   │   # GET /dashboard/pipeline      (projects grouped by stage)
│       │   │   # GET /dashboard/tasks-today   (activities scheduled today)
│       │   │   # GET /dashboard/recent-activity
│       │   └── 📄 dashboard.service.ts
│       │
│       └── 📁 upload/                 # File upload (hợp đồng scan)
│           ├── 📄 upload.module.ts
│           ├── 📄 upload.controller.ts # POST /upload → trả về fileUrl
│           └── 📄 upload.service.ts    # Lưu vào /uploads hoặc S3
│
│
└── 📁 docs/                           # Tài liệu dự án
    ├── 📄 PROJECT_STRUCTURE.md        # File này
    ├── 📄 BLUEPRINT.md                # Tài liệu nghiệp vụ đầy đủ
    └── 📁 design/                     # Screenshots từ Stitch
        ├── 📄 01-dashboard.png
        ├── 📄 02-customer-list.png
        ├── 📄 03-customer-detail.png
        ├── 📄 04-kanban-pipeline.png
        ├── 📄 05-create-quote.png
        └── 📄 06-pdf-preview.png
```

---

## 5. PRISMA SCHEMA (SOURCE OF TRUTH)

```prisma
// prisma/schema.prisma
// ⚠️ AI: Đây là schema chính thức. Không thêm/xoá field mà không cập nhật file này.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────
// USERS — Nhân viên AHSO
// ─────────────────────────────────────────
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String
  password     String    // bcrypt hashed
  role         Role      @default(STAFF)
  avatarUrl    String?
  refreshToken String?   // hashed refresh token
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  // Relations
  assignedCustomers Customer[]  @relation("AssignedTo")
  createdQuotes     Quote[]
  activities        Activity[]
}

enum Role {
  ADMIN    // Toàn quyền
  MANAGER  // Xem tất cả, sửa không xoá
  STAFF    // Chỉ xem/sửa data của mình
}

// ─────────────────────────────────────────
// CUSTOMERS — Công ty khách hàng
// ─────────────────────────────────────────
model Customer {
  id           String         @id @default(cuid())
  name         String
  shortName    String?        // Viết tắt: VPC, ABC (dùng cho avatar)
  taxCode      String?        @unique
  industry     String?        // Ngành nghề
  address      String?
  website      String?
  phone        String?
  email        String?
  source       String?        // referral, website, exhibition, cold-call
  notes        String?
  status       CustomerStatus @default(LEAD)
  isVip        Boolean        @default(false)
  deletedAt    DateTime?      // soft delete

  assignedTo   User    @relation("AssignedTo", fields: [assignedToId], references: [id])
  assignedToId String

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  contacts     Contact[]
  projects     Project[]
  activities   Activity[]
}

enum CustomerStatus {
  LEAD        // Mới tiếp cận
  PROSPECT    // Đang quan tâm / tiềm năng
  ACTIVE      // Đang có hợp đồng
  INACTIVE    // Không còn giao dịch
}

// ─────────────────────────────────────────
// CONTACTS — Đầu mối liên hệ trong KH
// ─────────────────────────────────────────
model Contact {
  id         String   @id @default(cuid())
  name       String
  title      String?  // Giám đốc kỹ thuật, Trưởng phòng mua hàng...
  email      String?
  phone      String?
  isPrimary  Boolean  @default(false)
  notes      String?

  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  customerId String

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// ─────────────────────────────────────────
// PROJECTS — Dự án / Cơ hội kinh doanh
// ─────────────────────────────────────────
model Project {
  id           String        @id @default(cuid())
  code         String        @unique @default(cuid()) // AHSO-294
  name         String
  description  String?
  status       ProjectStatus @default(SURVEY)
  priority     Priority      @default(NORMAL)
  estimatedValue Decimal?    @db.Decimal(15,0)
  startDate    DateTime?
  expectedEndDate DateTime?
  notes        String?
  deletedAt    DateTime?

  customer     Customer @relation(fields: [customerId], references: [id])
  customerId   String

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  quotes       Quote[]
  contract     Contract?
  activities   Activity[]
  milestones   Milestone[]
}

enum ProjectStatus {
  SURVEY       // Khảo sát
  QUOTING      // Báo giá
  NEGOTIATING  // Đàm phán
  WON          // Đã ký hợp đồng
  LOST         // Không thành
  DELIVERING   // Đang triển khai
  COMPLETED    // Hoàn thành
}

enum Priority {
  LOW
  NORMAL
  HIGH     // Badge "Gấp" màu đỏ
}

// ─────────────────────────────────────────
// QUOTES — Báo giá
// ─────────────────────────────────────────
model Quote {
  id          String      @id @default(cuid())
  quoteNo     String      @unique  // BG-2025-001
  version     Int         @default(1)
  status      QuoteStatus @default(DRAFT)
  validUntil  DateTime?
  subtotal    Decimal     @default(0) @db.Decimal(15,0)
  taxRate     Decimal     @default(10) @db.Decimal(5,2)  // % VAT
  taxAmount   Decimal     @default(0) @db.Decimal(15,0)
  total       Decimal     @default(0) @db.Decimal(15,0)
  terms       String?     // Điều khoản thanh toán
  deliveryTerms String?   // Thời gian giao hàng
  internalNote String?    // Ghi chú nội bộ — không in ra PDF
  sentAt      DateTime?
  acceptedAt  DateTime?

  project     Project  @relation(fields: [projectId], references: [id])
  projectId   String

  createdBy   User     @relation(fields: [createdById], references: [id])
  createdById String

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  items       QuoteItem[]
}

model QuoteItem {
  id          String   @id @default(cuid())
  order       Int      // Thứ tự hiển thị (drag-drop sẽ cập nhật field này)
  name        String   // Tên hạng mục
  description String?  // Mô tả chi tiết
  unit        String?  // ĐVT: Bộ, Cái, m, giờ...
  quantity    Decimal  @db.Decimal(10,2)
  unitPrice   Decimal  @db.Decimal(15,0)
  total       Decimal  @db.Decimal(15,0)  // = quantity * unitPrice

  quote       Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  quoteId     String

  @@index([quoteId, order])
}

enum QuoteStatus {
  DRAFT      // Bản nháp
  SENT       // Đã gửi khách
  ACCEPTED   // Khách chấp nhận
  REJECTED   // Khách từ chối
  EXPIRED    // Hết hiệu lực
}

// ─────────────────────────────────────────
// CONTRACTS — Hợp đồng
// ─────────────────────────────────────────
model Contract {
  id           String         @id @default(cuid())
  contractNo   String         @unique  // HD-2025-001
  signDate     DateTime?
  startDate    DateTime?
  endDate      DateTime?
  value        Decimal        @db.Decimal(15,0)
  status       ContractStatus @default(ACTIVE)
  fileUrl      String?        // File hợp đồng scan
  notes        String?

  project      Project  @relation(fields: [projectId], references: [id])
  projectId    String   @unique  // 1 project chỉ có 1 contract

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  milestones   Milestone[]
  payments     Payment[]
}

enum ContractStatus {
  ACTIVE      // Đang hiệu lực
  SUSPENDED   // Tạm dừng
  COMPLETED   // Hoàn thành
  CANCELLED   // Huỷ
}

// ─────────────────────────────────────────
// MILESTONES — Cột mốc triển khai / nghiệm thu
// ─────────────────────────────────────────
model Milestone {
  id           String          @id @default(cuid())
  name         String          // "Nghiệm thu giai đoạn 1", "Bàn giao thiết bị"
  description  String?
  dueDate      DateTime?
  completedAt  DateTime?
  status       MilestoneStatus @default(PENDING)
  paymentAmount Decimal?       @db.Decimal(15,0)  // Giá trị đợt thanh toán
  notes        String?

  project      Project   @relation(fields: [projectId], references: [id])
  projectId    String

  contract     Contract? @relation(fields: [contractId], references: [id])
  contractId   String?

  createdAt    DateTime @default(now())
}

enum MilestoneStatus {
  PENDING      // Chưa bắt đầu
  IN_PROGRESS  // Đang thực hiện
  DONE         // Hoàn thành
  ACCEPTED     // Đã nghiệm thu
}

// ─────────────────────────────────────────
// PAYMENTS — Thanh toán
// ─────────────────────────────────────────
model Payment {
  id          String   @id @default(cuid())
  amount      Decimal  @db.Decimal(15,0)
  paidAt      DateTime
  method      String?  // "Chuyển khoản", "Tiền mặt"
  reference   String?  // Số chứng từ / số hóa đơn
  notes       String?

  contract    Contract @relation(fields: [contractId], references: [id])
  contractId  String

  createdAt   DateTime @default(now())
}

// ─────────────────────────────────────────
// ACTIVITIES — Lịch sử tương tác
// ─────────────────────────────────────────
model Activity {
  id           String       @id @default(cuid())
  type         ActivityType
  title        String       // "Gọi điện chốt báo giá Thaco"
  content      String?      // Nội dung chi tiết / ghi chú
  scheduledAt  DateTime?    // Thời gian dự kiến (task)
  doneAt       DateTime?    // Thời gian hoàn thành
  isCompleted  Boolean      @default(false)
  attachmentUrl String?     // File đính kèm

  customer     Customer? @relation(fields: [customerId], references: [id])
  customerId   String?

  project      Project?  @relation(fields: [projectId], references: [id])
  projectId    String?

  user         User      @relation(fields: [userId], references: [id])
  userId       String

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum ActivityType {
  CALL       // Gọi điện — icon: phone (blue)
  EMAIL      // Email — icon: mail (gray)
  MEETING    // Cuộc họp — icon: users (green)
  SURVEY     // Khảo sát thực địa — icon: clipboard (orange)
  DEMO       // Demo sản phẩm — icon: monitor (purple)
  NOTE       // Ghi chú — icon: file-text (gray)
  FOLLOWUP   // Theo dõi — icon: refresh (teal)
}
```

---

## 6. API RESPONSE FORMAT

Mọi API response đều theo format chuẩn sau (xử lý bởi `transform.interceptor.ts`):

```typescript
// Success — single item
{
  "data": { ...item },
  "meta": null
}

// Success — list with pagination
{
  "data": [...items],
  "meta": {
    "total": 1284,
    "page": 1,
    "limit": 10,
    "totalPages": 129
  }
}

// Error
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["name is required", "taxCode must be unique"]
}
```

---

## 7. NAMING CONVENTIONS

> AI phải tuân theo đúng các convention này trong mọi file được tạo.

```
Files/Folders:      kebab-case          customer-detail.tsx, quote-items.ts
React Components:   PascalCase          CustomerCard, QuoteTable
Functions/Vars:     camelCase           getCustomerById, totalAmount
Constants:          UPPER_SNAKE_CASE    MAX_QUOTE_ITEMS, VAT_RATE, API_URL
TypeScript Types:   PascalCase          CreateCustomerDto, CustomerStatus
Prisma Models:      PascalCase          Customer, QuoteItem
API Endpoints:      kebab-case plural   /customers, /quote-items, /auth/login
CSS classes:        Tailwind utility    (không viết CSS tay trừ globals.css)
Enum values:        UPPER_SNAKE_CASE    ProjectStatus.DELIVERING
```

---

## 8. FRONTEND PATTERNS

### Data Fetching — TanStack Query
```typescript
// hooks/use-customers.ts
export function useCustomers(filters: CustomerFilterDto) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => apiClient.get('/customers', { params: filters }),
    staleTime: 30_000,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCustomerDto) => apiClient.post('/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Đã thêm khách hàng')
    },
  })
}
```

### Format tiền VND
```typescript
// lib/format.ts
export function formatVND(amount: number | string): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(amount))
}
// Output: 1.245.000.000 ₫

export function formatVNDShort(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)} tỷ`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(0)}M`
  return formatVND(amount)
}
// Output: "1,2 tỷ" hoặc "450M"
```

### Status Badge
```typescript
// components/shared/status-badge.tsx
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // CustomerStatus
  LEAD:        { label: 'Tiềm năng',      className: 'bg-[#E8E8E8] text-[#4A4A4A]' },
  PROSPECT:    { label: 'Tiềm năng',      className: 'bg-[#D6EAF8] text-[#1A5276]' },
  ACTIVE:      { label: 'Hoạt động',      className: 'bg-[#D5F5E3] text-[#1E5631]' },
  INACTIVE:    { label: 'Không HĐ',       className: 'bg-[#FADBD8] text-[#922B21]' },
  // ProjectStatus
  SURVEY:      { label: 'Khảo sát',       className: 'bg-[#E8E8E8] text-[#4A4A4A]' },
  QUOTING:     { label: 'Báo giá',        className: 'bg-[#D6EAF8] text-[#1A5276]' },
  NEGOTIATING: { label: 'Đàm phán',       className: 'bg-[#FDEBD0] text-[#7D4E00]' },
  DELIVERING:  { label: 'Triển khai',     className: 'bg-[#D0EFE8] text-[#0E6655]' },
  COMPLETED:   { label: 'Hoàn thành',     className: 'bg-[#D5F5E3] text-[#1E5631]' },
  WON:         { label: 'Đã ký HĐ',       className: 'bg-[#D5F5E3] text-[#1E5631]' },
  LOST:        { label: 'Không thành',    className: 'bg-[#FADBD8] text-[#922B21]' },
  // QuoteStatus
  DRAFT:       { label: 'Bản nháp',       className: 'bg-[#E8E8E8] text-[#4A4A4A]' },
  SENT:        { label: 'Đã gửi',         className: 'bg-[#D6EAF8] text-[#1A5276]' },
  ACCEPTED:    { label: 'Chấp nhận',      className: 'bg-[#D5F5E3] text-[#1E5631]' },
  REJECTED:    { label: 'Từ chối',        className: 'bg-[#FADBD8] text-[#922B21]' },
  EXPIRED:     { label: 'Hết hạn',        className: 'bg-[#FDEBD0] text-[#7D4E00]' },
}
```

---

## 9. DOCKER & ENVIRONMENT

### docker-compose.yml
```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ahso_crm
      POSTGRES_USER: ahso
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3001:3001"
    env_file: ./backend/.env
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend/uploads:/app/uploads

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file: ./frontend/.env.local
    depends_on:
      - backend

volumes:
  pgdata:
```

### backend/.env.example
```bash
DATABASE_URL="postgresql://ahso:password@postgres:5432/ahso_crm"
REDIS_URL="redis://redis:6379"
JWT_SECRET="change-this-to-random-32-char-string"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
UPLOAD_DIR="./uploads"
PORT=3001
NODE_ENV=development

# Phase 2 — AI (để trống lúc đầu)
ANTHROPIC_API_KEY=""
AI_PROVIDER="local"
OLLAMA_URL="http://localhost:11434"
```

### frontend/.env.local.example
```bash
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_APP_NAME="AHSO CRM"
```

---

## 10. ROADMAP THEO TUẦN

```
TUẦN 1 — Setup & Auth (MỤC TIÊU: Login được, token hợp lệ)
  □ docker-compose.yml chạy PG + Redis
  □ NestJS: auth module (login, refresh, logout)
  □ NestJS: users module (basic CRUD)
  □ Prisma: migrate toàn bộ schema
  □ Next.js: layout (sidebar + topbar) đúng Stitch design
  □ Next.js: trang Login với form validation
  □ Next.js: protected routes, token refresh

TUẦN 2 — Customers (MỤC TIÊU: Thêm/sửa/xem KH được)
  □ NestJS: customers + contacts module
  □ Next.js: /customers — danh sách với filter, search, pagination
  □ Next.js: /customers/[id] — chi tiết với tabs, timeline
  □ Next.js: form tạo/sửa khách hàng
  □ Import dữ liệu mẫu từ Excel (seed script)

TUẦN 3 — Projects & Pipeline (MỤC TIÊU: Xem kanban, kéo thả stage)
  □ NestJS: projects module
  □ Next.js: /projects — kanban board (5 cột, scroll)
  □ Drag-drop thay đổi stage
  □ Project form + liên kết với customer

TUẦN 4 — Quotes & PDF (MỤC TIÊU: Xuất PDF gửi được khách)
  □ NestJS: quotes module + PDF service (Puppeteer)
  □ Next.js: /quotes/new — form tạo báo giá
  □ Inline editable items table
  □ PDF template tiếng Việt chuẩn A4
  □ Preview modal + download

TUẦN 5 — Contracts & Documents (MỤC TIÊU: Đủ bộ tài liệu nghiệm thu)
  □ NestJS: contracts + milestones + payments
  □ Next.js: /contracts — danh sách + chi tiết
  □ Milestone tracker với progress
  □ Biên bản nghiệm thu PDF

TUẦN 6 — Dashboard & Reports (MỤC TIÊU: Dashboard load < 2s)
  □ NestJS: dashboard aggregation endpoints
  □ Next.js: /dashboard — Recharts charts
  □ KPI cards với realtime data
  □ Pipeline preview + activity feed

TUẦN 7 — Activities & Tasks (MỤC TIÊU: Log mọi tương tác)
  □ NestJS: activities module
  □ Next.js: activity timeline (dùng chung)
  □ Task checklist trên dashboard
  □ /calendar — lịch công việc

TUẦN 8 — Polish & Import (MỤC TIÊU: Go live)
  □ Import Excel khách hàng cũ
  □ UI/UX review theo Stitch screenshots
  □ Performance optimization
  □ Error boundaries + loading states
  □ Production deploy trên VPS

PHASE 2 (Sau tuần 8) — AI Agent
  □ AI Gateway service
  □ Tóm tắt khách hàng (Claude API)
  □ Gợi ý bước tiếp theo
  □ Soạn email nháp
  □ Ollama local (Gemma3) cho data nhạy cảm
```

---

## 11. QUY TẮC QUAN TRỌNG CHO AI KHI CODE

```
1. LUÔN đọc file này trước khi bắt đầu bất kỳ task nào

2. KHÔNG tự ý thêm dependency mới mà không hỏi trước
   Các package đã được chốt ở Mục 2

3. KHÔNG thay đổi Prisma schema mà không cập nhật file này

4. MỌI text hiển thị cho người dùng phải bằng tiếng Việt
   (trừ technical labels như "ID", "URL", "API")

5. FORMAT tiền: luôn dùng formatVND() hoặc formatVNDShort()
   KHÔNG hardcode format string

6. MỌI API call phải qua apiClient (lib/api-client.ts)
   KHÔNG dùng fetch() trực tiếp

7. MỌI form phải dùng React Hook Form + Zod validation
   KHÔNG dùng state onChange thuần

8. COMPONENT mới: kiểm tra shadcn/ui có sẵn chưa trước khi tự viết
   npx shadcn@latest add [component-name]

9. MÀU SẮC: chỉ dùng design tokens ở Mục 3
   KHÔNG tự đặt màu mới

10. KHI KHÔNG CHẮC về nghiệp vụ:
    Hỏi lại thay vì tự giả định
    Luồng chính: Khách hàng → Dự án → Báo giá → Hợp đồng → Thu tiền
```

---

*Cập nhật lần cuối: 2025 — v1.0*
*Mọi thay đổi kiến trúc cần cập nhật file này trước khi code*
