# AHSO CRM — Kế hoạch sửa giao diện (10/2026)

> Nguồn: đánh giá trực tiếp trên crm.ahso.vn (1440px) ngày 17/10/2026.
> Kế hoạch này được viết để **model rẻ hơn (Sonnet/Haiku) thực thi mà không cần tự dò codebase**:
> mỗi task đã ghi sẵn file, vị trí, cách sửa và tiêu chí nghiệm thu.

---

## 0. Cách thực thi tiết kiệm token

### Phân công model

| Batch | Nội dung | Model đề xuất | Lý do |
|---|---|---|---|
| B1 | Lỗi sai thông tin | **Haiku** | Sửa cơ học, vị trí đã chỉ rõ |
| B2 | Việt hóa nhãn | **Haiku** | Thay chuỗi theo bảng thuật ngữ có sẵn |
| B3 | Dashboard | Sonnet | Đổi layout nhỏ, đổi loại biểu đồ |
| B4 | Kanban gọn | Sonnet | Viết lại 1 component |
| B5 | Bảng khách hàng | Haiku | Sửa nhỏ, vị trí rõ |
| B6 | Form báo giá dạng bảng | Sonnet | Refactor lớn nhất, giữ nguyên logic form |
| B7 | Nháy trang đăng nhập | **Opus** | Liên quan auth/cookie, cần xác minh production |
| B8 | QA cuối | Sonnet + Chrome | Chụp màn hình đối chiếu |

### Luật cho model thực thi (bắt buộc — đây là chỗ tiết kiệm token)

1. **Chỉ đọc file được liệt kê trong task.** Không `find`/`grep` toàn repo, không đọc PROJECT_STRUCTURE.md trừ khi task yêu cầu.
2. **Không đổi business logic, API, data types** ngoài phạm vi task (Logic Rule, CLAUDE.md §5).
3. **Kiểm tra theo batch, không theo task:** cuối mỗi batch chạy một lần:
   ```bash
   cd frontend && npx tsc --noEmit && npx next lint --quiet
   cd backend && npx tsc --noEmit && npx jest <module liên quan>   # chỉ khi batch đụng backend
   ```
4. **1 commit / batch**, message tiếng Anh dạng `fix(ui): B1 data correctness`. Không push.
5. Gặp tình huống ngoài kế hoạch → **dừng và hỏi**, không tự mở rộng phạm vi.
6. Trên ổ TRANSCEND (exFAT): trước khi chạy jest, xóa file rác `find . -name '._*' -not -path '*/node_modules/*' -delete`.

### Prompt mẫu giao cho model thực thi

```
Đọc docs/UI_FIX_PLAN_2026-10.md, mục 0 và Batch <Bx>. Thực hiện đúng các task
trong Batch <Bx>, tuân thủ "Luật cho model thực thi". Xong thì chạy kiểm tra
cuối batch, commit 1 lần, báo lại: danh sách file đã sửa + kết quả kiểm tra.
```

### Skill dùng ở đâu

| Skill | Dùng ở | Mục đích |
|---|---|---|
| `design:ux-copy` | B2 | Chỉ khi gặp nhãn KHÔNG có trong bảng thuật ngữ §B2 |
| `design:design-system` | B8 | Audit nhất quán (radius, card, màu) sau khi sửa xong |
| `design:accessibility-review` | B8 | Kiểm tra tương phản `text-muted`, kích thước chạm |
| `anthropic-skills:chrome-browser` | B7, B8 | Xác minh trên production |

Các batch khác **không cần skill** — kế hoạch đã đủ chi tiết, gọi skill chỉ tốn thêm token.

### Thứ tự & phụ thuộc

`B1 → B2` (B2 đụng nhiều file mà B1 cũng đụng, làm tuần tự tránh xung đột) → `B3, B4, B5` (độc lập, chạy song song được) → `B6` → `B7` (độc lập, làm lúc nào cũng được) → `B8`.

---

## B1 — Lỗi sai thông tin · Haiku · ~1h

### B1.1 Màu biểu đồ pipeline bị đảo nghĩa ("Hoàn thành" đang màu đỏ)
- **Nguyên nhân:** màu gán theo `index` của mảng, không theo trạng thái.
- **File:** `frontend/lib/constants.ts`, `frontend/app/(dashboard)/dashboard/_components/project-donut.tsx` (dòng 10, 42, 55), `frontend/app/(dashboard)/dashboard/_components/pipeline-preview.tsx` (dòng 7, 54, 66).
- **Sửa:** trong `constants.ts`, thay `CHART_STAGE_SERIES` bằng map theo trạng thái:
  ```ts
  export const CHART_STAGE_COLORS: Record<ProjectStatus, string> = {
    SURVEY: CHART_COLORS.muted,          // xám xanh
    QUOTING: CHART_COLORS.primaryLight,  // xanh dương
    NEGOTIATING: CHART_COLORS.accent,    // cam
    WON: CHART_COLORS.primaryMid,        // xanh đậm
    DELIVERING: CHART_COLORS.teal,       // teal
    COMPLETED: CHART_COLORS.success,     // XANH LÁ
    LOST: CHART_COLORS.danger            // ĐỎ
  };
  ```
  Trong 2 component: `STAGE_COLORS[index % ...]` → `CHART_STAGE_COLORS[stage.status as ProjectStatus] ?? CHART_COLORS.axis`. Xóa `CHART_STAGE_SERIES` nếu không còn nơi dùng (kiểm tra bằng tsc).
- **Nghiệm thu:** "Hoàn thành" xanh lá, "Không thành" đỏ ở cả donut lẫn thanh phân bổ.

### B1.2 "▲ 100% kỳ trước" khi kỳ trước = 0
- **File:** `backend/src/dashboard/dashboard.service.ts` dòng ~75; `frontend/lib/types.ts` (`DashboardKpis.monthlyRevenue.changePercent`); `frontend/app/(dashboard)/dashboard/_components/kpi-cards.tsx`.
- **Sửa:** backend trả `changePercent: null` khi kỳ trước = 0 (thay `? 100 : 0`). Type → `number | null`. Frontend: nếu `null` → hiển thị `Chưa có số liệu kỳ trước` (màu `text-text-secondary`, không mũi tên); ngược lại giữ như cũ. Cập nhật `dashboard.service.spec.ts` nếu có assert 100.
- **Nghiệm thu:** không còn "100%" giả; test dashboard pass.

### B1.3 Breadcrumb sai ở 9 module ("Tổng quan › Dashboard")
- **File:** `frontend/components/layout/topbar.tsx`, hàm `getTopbarContext` (dòng ~37–47).
- **Sửa:** thêm trước dòng fallback:
  ```ts
  if (pathname.startsWith("/activities")) return { area: "CRM", current: "Hoạt động" };
  if (pathname.startsWith("/surveys")) return { area: "CRM", current: "Khảo sát" };
  if (pathname.startsWith("/documents")) return { area: "CRM", current: "Hồ sơ" };
  if (pathname.startsWith("/suppliers")) return { area: "Kho vật tư", current: "Nhà cung cấp" };
  if (pathname.startsWith("/materials")) return { area: "Kho vật tư", current: "Vật tư" };
  if (pathname.startsWith("/inventory")) return { area: "Kho vật tư", current: "Kho hàng" };
  if (pathname.startsWith("/agents")) return { area: "AI", current: "AI Agents" };
  if (pathname.startsWith("/notifications")) return { area: "Hệ thống", current: "Thông báo" };
  if (pathname.startsWith("/settings")) return { area: "Hệ thống", current: "Cài đặt" };
  ```
  Fallback cuối giữ `{ area: "Tổng quan", current: "Dashboard" }` nhưng chỉ khi `pathname.startsWith("/dashboard")`; trường hợp khác trả `{ area: "AHSO CRM", current: "" }` và component không render dấu `›` khi `current` rỗng.
- **Nghiệm thu:** mở /suppliers, /materials, /inventory, /activities → breadcrumb đúng.

### B1.4 Mô tả menu sai ("Quyền truy cập nội bộ" lặp 4 lần)
- **File:** `frontend/components/layout/sidebar.tsx`, hàm `getItemHint` (dòng 13–67) và nơi render hint.
- **Sửa (theo Design Spec v2 §6.2 "Bỏ hint text dưới label"):** **xóa hẳn dòng hint** dưới mỗi mục menu và xóa hàm `getItemHint`. Lợi ích kèm theo: 18 mục menu vừa màn hình, tên user ở đáy không bị cắt.
- **Nghiệm thu:** sidebar chỉ còn icon + nhãn, cao mỗi mục ~40px; không còn chữ "Quyền truy cập nội bộ".

### B1.5 Cách viết số không thống nhất ("2.2 tỷ", "704M")
- **File:** `frontend/lib/format.ts`, hàm `formatVNDShort` (dòng ~40).
- **Sửa:**
  ```ts
  const SHORT_NUMBER = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
  export function formatVNDShort(amount: number): string {
    if (Math.abs(amount) >= 1_000_000_000) return `${SHORT_NUMBER.format(amount / 1_000_000_000)} tỷ`;
    if (Math.abs(amount) >= 1_000_000) return `${SHORT_NUMBER.format(amount / 1_000_000)} tr`;
    return formatVND(amount);
  }
  ```
  → "2,2 tỷ", "704 tr", "18,6 tỷ". Nếu có test của `format.ts`, cập nhật kỳ vọng.
- **Nghiệm thu:** dashboard/kanban hiển thị dấu phẩy thập phân và "tr".

### B1.6 Thẻ "VIP trên trang" chỉ đếm trang hiện tại
- **File:** `backend/src/customers/customers.service.ts` (object `summary` ở dòng ~140); `frontend/lib/types.ts` (type meta summary của customers); `frontend/app/(dashboard)/customers/_components/customer-overview-cards.tsx` dòng 37, 53–55.
- **Sửa:** backend thêm `vipCount` vào `summary` = `prisma.customer.count({ where: { ...where, isVip: true } })` (dùng cùng `where` của list, trong `$transaction` sẵn có). Frontend: nhãn → "Khách hàng VIP", giá trị `meta.summary.vipCount`, helper → "Trong bộ lọc hiện tại". Thẻ tổng: helper `Trang x/y` → "Theo bộ lọc hiện tại".
- **Mẫu tham khảo:** `backend/src/suppliers/suppliers.service.ts` → `findAll` (`summary.activeCount`).
- **Nghiệm thu:** số VIP không đổi khi chuyển trang.

**Kiểm tra cuối B1:** tsc + lint frontend; tsc backend + `npx jest src/dashboard src/customers`. Commit `fix(ui): B1 data correctness on dashboard, nav and counters`.

---

## B2 — Việt hóa toàn bộ nhãn tiếng Anh · Haiku · ~1.5h

Có **110 nhãn tiếng Anh trong 42 file** (eyebrow/chip), cộng một số câu mô tả có thuật ngữ lập trình.

### B2.1 Liệt kê (chạy 1 lần, không cần đọc file)
```bash
cd frontend && grep -rnE '(v2-label|industrial-chip|uppercase|tracking-\[0\.[0-9]+em\])[^>]*>[[:space:]]*[A-Z][A-Za-z0-9 &/+-]{2,}[[:space:]]*<' app components --include=*.tsx | grep -v components/ui
```

### B2.2 Bảng thuật ngữ (dùng đúng bản dịch này — không tự sáng tác)

| Tiếng Anh | Tiếng Việt |
|---|---|
| Revenue Trend | Doanh thu |
| Pipeline / Pipeline Overview | Pipeline / Phân bổ pipeline |
| Pipeline Filter | Bộ lọc |
| Kanban Pipeline | Bảng Kanban |
| Project Pipeline | Dự án |
| Customer Ledger | Danh sách khách hàng |
| Supplier Ledger | Danh sách nhà cung cấp |
| Status Ledger | Trạng thái |
| NCC Signal / VT Signal / Quote Signal | *(xóa chip)* |
| Quotation Desk | Báo giá |
| Quote Identity | Thông tin cơ bản |
| Project Snapshot | Dự án & khách hàng |
| Quote Summary | Tổng hợp |
| Quote Stack | Các phiên bản báo giá |
| Line Items | Hạng mục |
| Print Layout | Tùy chỉnh bản in |
| Terms | Điều khoản |
| Action Desk | Thao tác |
| Source Quote / Source Project | Báo giá nguồn / Dự án nguồn |
| Project Knowledge Hub | Tổng quan dự án |
| Project Core | Thông tin dự án |
| Project Pulse / Activity Pulse | Hoạt động gần đây |
| Project 360 / Project 360 Guard | Tổng quan 360° |
| Project Document Plan | Kế hoạch hồ sơ |
| Customer Owner | Phụ trách |
| Primary Contact | Liên hệ chính |
| Unified Timeline / Timeline | Dòng thời gian |
| Lifecycle | Tiến trình |
| Progress | Tiến độ |
| Top Customers | Khách hàng hàng đầu |
| Site Visit | Khảo sát thực địa |
| Templates | Mẫu |
| Dynamic Schema / Schema Preview | Trường tùy chỉnh / Xem trước |
| Result Preview | Xem trước kết quả |
| Recent Collections | Thu tiền gần đây |
| Realtime Inbox | Hộp thư |
| Registry | Danh mục |
| Retention Matrix | Chính sách lưu trữ |
| Runtime Guard | Bảo vệ hệ thống |
| Soft delete recovery | Khôi phục dữ liệu đã xóa |
| Uploaded / Received | Đã tải lên / Đã nhận |
| AI Summary | Tóm tắt AI |
| Automation Hub (eyebrow trên PageHeader) | *(xóa — trùng với tên app ở sidebar)* |
| **Giữ nguyên:** AHSO CRM, Dashboard, Email, Mailbox, AI Agents, Kanban, CSV, VAT, MST | — |

Nhãn không có trong bảng → gọi skill `design:ux-copy` **một lần cho cả nhóm còn lại**, rồi bổ sung vào bảng này.

### B2.3 Câu mô tả chứa thuật ngữ lập trình (sửa đúng chuỗi)

| File | Cũ | Mới |
|---|---|---|
| `quotes/_components/quote-form-screen.tsx` (PageHeader description) | "Tạo quote trực tiếp từ dự án thật, tính toán line item và khóa luôn payload để sang được màn hình preview/in." | "Chọn dự án, nhập hạng mục và xem trước bản in trước khi gửi khách." |
| `quotes/_components/quote-form-screen.tsx` (Project Snapshot empty) | "...owner và context thương mại." | "Chọn dự án để tự điền khách hàng và người phụ trách." |
| `projects/_components/project-kanban-board.tsx` (helper trên board) | "...Kéo tay cầm ⠿ để di chuyển card hoặc dùng select làm fallback." | "Kéo thẻ sang cột khác để chuyển giai đoạn." |
| `projects/_components/project-overview-cards.tsx` và `reports/_components/reports-overview-cards.tsx` | "Estimated value của dự án chưa đóng trong tập lọc" / "Các job đã vào delivery..." | "Tổng giá trị dự án đang mở" / "Dự án đang triển khai hoặc chờ nghiệm thu" |
| `projects/_components/project-kanban-board.tsx` (card stats) | "milestone", "activity" | "mốc", "hoạt động" |
| `(auth)/login/page.tsx` | "Lead / Quote / Contract", "Realtime · RBAC · Document Hub", "Project 360", "AHSO Workspace", "CRM B2B" | "Khách hàng / Báo giá / Hợp đồng", "Cập nhật tức thì · Phân quyền · Hồ sơ tập trung", *(xóa)*, "AHSO", *(xóa)* |

Mọi đường dẫn tương đối tính từ `frontend/app/(dashboard)/` trừ dòng login.

**Kiểm tra cuối B2:** chạy lại lệnh B2.1 → kết quả chỉ còn các nhãn trong dòng "Giữ nguyên". tsc + lint. Commit `fix(ui): B2 translate user-facing English labels`.

---

## B3 — Dashboard · Sonnet · ~1.5h

**File:** `frontend/app/(dashboard)/dashboard/_components/dashboard-date-range-filter.tsx` (thanh thời gian), `page.tsx`, `_components/revenue-chart.tsx`, `_components/pipeline-preview.tsx`, `_components/project-donut.tsx`, `_components/activity-feed.tsx`.

1. **Thanh chọn thời gian:** gom thành 1 hàng gọn bên phải PageHeader (select kỳ + 2 ô ngày + nút "Đặt lại" dạng ghost nhỏ). Bỏ card nền trắng bao quanh và khoảng trống ở giữa.
2. **Bỏ trùng dữ liệu pipeline:** giữ `pipeline-preview` (thanh phân bổ + số theo giai đoạn) làm khối chính, **mỗi ô giai đoạn là link** sang `/projects?view=kanban&status=<STATUS>`. Bỏ `project-donut` khỏi dashboard; ô bên phải đổi thành "Top 5 dự án giá trị cao đang mở" (dữ liệu: `useProjects({ page:1, limit:5, ... })`, sắp theo `estimatedValue` nếu API hỗ trợ `sortBy`; nếu không hỗ trợ → **dừng và hỏi**, đừng sửa backend).
3. **Biểu đồ doanh thu:** đổi `Area/Line type="monotone"` của "Thực thu" sang `<Bar>` (màu `CHART_COLORS.primaryMid`, radius `[4,4,0,0]`), giữ đường "Mục tiêu" là `<Line type="linear" strokeDasharray>` → dùng `ComposedChart`. Trục Y dùng `formatVNDShort`.
4. **Activity feed:** cột thời gian rộng cố định 88px, ngày và giờ cùng 1 dòng ("09/06 20:06"); bỏ emoji đầu tiêu đề nếu là ký tự emoji (regex `/^\p{Extended_Pictographic}\s*/u`).
5. **"Việc cần làm" trống:** EmptyState có `action` = link "Lên lịch việc" → `/activities/new`.

**Nghiệm thu:** màn hình đầu (1440×900) thấy được KPI + doanh thu + pipeline mà không cuộn. Commit `feat(ui): B3 dashboard layout cleanup`.

---

## B4 — Kanban gọn · Sonnet · ~2h

**File:** `frontend/app/(dashboard)/projects/_components/project-kanban-board.tsx` (hàm `ProjectCardContent` dòng ~54–169, `DraggableCard`), `projects-client.tsx`, `project-overview-cards.tsx`.

1. **Card mới (mục tiêu cao ~120px), chỉ gồm:**
   - Dòng 1: tên dự án (2 dòng tối đa, link chi tiết) + **một** chấm cảnh báo bên phải (xem mục 2).
   - Dòng 2: tên khách hàng (1 dòng, truncate; **bỏ** tiền tố pháp lý dùng util B5.2).
   - Dòng 3: giá trị (`formatVNDShort`, đậm) · hạn chót (`formatDate`, đỏ nếu trễ) · avatar người phụ trách (24px) bên phải.
   - Thanh tiến độ mảnh 3px màu `CHART_STAGE_COLORS[status]` ở đáy card.
   - **Bỏ:** mã dự án (đưa vào tooltip `title`), StatusBadge (cột đã thể hiện), badge độ ưu tiên khi = NORMAL (chỉ hiện "Gấp" khi HIGH), ngành, dòng "x báo giá · x milestone · x activity", "Cập nhật…", "Chưa có hợp đồng", select "Chuyển stage", nút Chi tiết/Sửa.
   - Click card → chi tiết; nút "Sửa" chuyển thành icon bút chì hiện khi hover (góc phải trên).
2. **Gộp cảnh báo thành 1 tín hiệu ưu tiên** (tránh "báo động tràn lan"):
   `isOverdue` → chấm đỏ, tooltip "Trễ hạn {n} ngày" › `daysInCurrentStage ≥ 30` → chấm đỏ "Ứ đọng {n} ngày" › `≥ 14` → chấm cam › `!hasUpcomingActivity` → chấm cam "Chưa có việc kế tiếp" › không gì cả. Chỉ hiển thị **1** chấm + tooltip.
3. **Header trang:** 4 thẻ KPI + card "Bộ lọc" → thay bằng **1 thanh** cao ~48px: ô tìm kiếm, 3 select lọc, và tóm tắt "29 dự án · 2,9 tỷ" bên phải. Bảng Kanban phải bắt đầu trong ~200px đầu màn hình.
4. **Cột "Không thành"**: thu gọn mặc định (rộng 56px, chữ dọc + số lượng), click để mở. Nút "Về dashboard" ở PageHeader (nằm trong `projects-client.tsx`) → xóa.
5. Giữ nguyên: kéo-thả (`useDraggable`), API đổi trạng thái, ngưỡng `STAGE_ROTTING_*`.

**Nghiệm thu:** 1440×900 thấy ≥ 4 card mỗi cột; kéo-thả vẫn đổi được giai đoạn. Commit `feat(ui): B4 compact kanban cards and single risk signal`.

---

## B5 — Bảng khách hàng · Haiku · ~45 phút

1. **Số dòng/trang:** `frontend/app/(dashboard)/customers/_components/customers-client.tsx` dòng 28 `PAGE_SIZE = 8` → `20`. Trong `customer-table.tsx` thêm phân trang ở **cuối bảng** (dùng lại đúng nút/handler `onPageChange` đang có ở đầu bảng).
2. **Avatar toàn "CT":** `frontend/components/shared/avatar-initials.tsx` dòng 22–27. Trước khi tách chữ, bỏ tiền tố pháp lý (không phân biệt hoa thường):
   ```ts
   const LEGAL_PREFIX = /^(công ty|cty|tnhh|cổ phần|cp|mtv|tmdv|tm|dv|hộ kinh doanh|tập đoàn|chi nhánh|doanh nghiệp tư nhân|dntn|một thành viên|thương mại|dịch vụ|sản xuất)\s+/i;
   let base = name.trim();
   while (LEGAL_PREFIX.test(base)) base = base.replace(LEGAL_PREFIX, "");
   ```
   Export thêm hàm `stripLegalPrefix(name)` để B4 dùng lại. Ví dụ: "CÔNG TY TNHH NA TÂY TECH" → "NT"; "Vinamilk Corp" → "VC" (không đổi).
3. **Cột trạng thái rối mắt:** trong `customer-table.tsx` (`InlineStatusCell`), đổi `<Select>` thành select **không viền, nền theo màu badge trạng thái** (`bg-success-bg text-success` khi ACTIVE, `bg-info-bg text-primary-mid` PROSPECT, `bg-bg-hover text-text-secondary` LEAD, `bg-danger-bg text-danger` INACTIVE), `rounded-full h-7 px-3 text-xs font-semibold`, mũi tên chỉ hiện khi hover. Logic giữ nguyên.
4. **Header bảng (áp dụng mọi bảng):** `frontend/app/globals.css` dòng 111–113, `.v2-table-head`: `bg-primary text-white` → `bg-bg-page text-text-secondary` (đúng spec "header bg #F4F6F8").
5. Cột "Dự án": bỏ dòng phụ "Đang gắn".

**Nghiệm thu:** 20 dòng/trang, avatar khác nhau theo công ty, cột trạng thái trông như badge. Commit `fix(ui): B5 customer table density and avatars`.

---

## B6 — Form báo giá dạng bảng · Sonnet · ~4h

**File:** `frontend/app/(dashboard)/quotes/_components/quote-form-screen.tsx` (853+ dòng; phần hạng mục ~dòng 355–495, Print Layout ~498–530, cột phải sticky). **Không đổi** `form-schemas.ts`, mutation, payload, `QuoteTemplateControls`, `MaterialPickerButton`, kéo-thả `SortableItemShell`.

1. **Hạng mục thành bảng** (mỗi hạng mục 1 dòng ~48px):
   | ⠿ | # | Tên hạng mục (+ nút 🔍 Vật tư) | ĐVT (80px) | SL (80px, phải) | Đơn giá (140px, phải) | Thành tiền (140px, phải, chỉ đọc) | ⋯ |
   - Mô tả: không hiện mặc định; nút "＋ Mô tả" trong menu ⋯ hoặc icon nhỏ cạnh tên → mở dòng phụ chứa `Textarea` (rows=2) ngay dưới. Dòng nào đã có mô tả thì dòng phụ luôn hiện.
   - Menu ⋯: "Thêm mô tả", "Nhân bản dòng", "Xóa dòng".
   - Phím: `Enter` ở ô Đơn giá của dòng cuối → thêm dòng mới và focus ô Tên.
   - Ô số dùng `inputMode="decimal"`, căn phải, `tabular-nums`; hiển thị đơn giá định dạng `vi-VN` khi blur.
   - Dòng tổng cuối bảng: Tạm tính · VAT · **Tổng cộng**.
2. **Cột phải:** sửa lỗi bị che khi cuộn — container cột phải dùng `self-start sticky top-[72px]` và **không** có `overflow` ở ancestor; khối "Tổng hợp" đặt **trên cùng**, "Dự án & khách hàng" bên dưới. Bỏ viền hộp quanh từng ô tổng hợp (No-Line Rule) → dùng hàng có nền `bg-bg-subtle` xen kẽ.
3. **Tùy chỉnh bản in:** gói khối độ rộng cột vào `<details>` (hoặc Collapsible có sẵn) đóng mặc định, tiêu đề "Tùy chỉnh bản in (nâng cao)".
4. **Header:** bỏ nút "Về danh sách" **chỉ trong `quote-form-screen.tsx`** (topbar đã có "Quay lại"); giữ nguyên ở `quote-detail-client.tsx` và `quote-preview-client.tsx`.
5. Chế độ chỉ xem (`!isEditableQuote`): bảng giữ nguyên bố cục, input chuyển `readOnly` không viền.

**Nghiệm thu:** báo giá 20 dòng cao < 1.200px; thêm/xóa/sắp xếp/chọn vật tư/áp mẫu vẫn chạy; tổng tiền luôn nhìn thấy khi cuộn; lưu xong mở bản xem trước khớp số liệu. Chạy thêm e2e nếu có (`npx playwright test quotes` — nếu không có, bỏ qua). Commit `feat(ui): B6 table-based quote line items editor`.

---

## B7 — Nháy trang đăng nhập khi mở tab mới · Opus · ~1h (cần xác minh trước)

- **Triệu chứng:** mở tab mới tới `/dashboard` → hiện `/login?next=...` khoảng 3 giây rồi mới tự vào dashboard.
- **Giả thuyết:** `frontend/middleware.ts` chặn khi không thấy cookie `ahso_refresh_token`. Backend đặt cookie ở `auth.controller.ts` (`getRefreshCookieOptions`, ~dòng 155) **không có `domain`** → nếu API chạy khác host với crm.ahso.vn, cookie không gửi kèm request trang → middleware đá về /login, sau đó trang login tự refresh bằng API và chuyển tiếp.
- **Xác minh (bắt buộc trước khi sửa):** trên Chrome đã đăng nhập, DevTools → Application → Cookies: `ahso_refresh_token` nằm ở host nào? Kiểm tra `NEXT_PUBLIC_API_URL` của production trong `.github/workflows/deploy.yml` / secrets.
- **Hướng sửa (tùy kết quả):**
  - API khác host cùng domain gốc → thêm biến môi trường `COOKIE_DOMAIN=.ahso.vn` vào `getRefreshCookieOptions` (chỉ áp dụng production) + cập nhật docs deploy.
  - Hoặc: sau khi login/refresh thành công, frontend tự đặt cookie đánh dấu không chứa bí mật `ahso_session=1` (path `/`, `SameSite=Lax`, cùng thời hạn refresh) và middleware kiểm tra cookie này; xóa khi logout.
- **Nghiệm thu:** mở tab mới → vào thẳng dashboard, không thấy trang đăng nhập.

---

## B8 — QA cuối · Sonnet + Chrome · ~1h

1. Chụp lại 6 màn hình (dashboard, khách hàng, kanban, tạo báo giá, nhà cung cấp list/chi tiết) ở 1440×900 qua `anthropic-skills:chrome-browser`.
2. Chạy `design:design-system` cho: radius (chỉ 6/8/20px), các kiểu thẻ số liệu (mục tiêu: 1 component dùng chung `V2MetricCard`), viền phân section.
3. Chạy `design:accessibility-review` tập trung: `text-text-muted` (#95A5B2, tương phản ~2.9:1) đang dùng cho nhãn cần đọc → đổi sang `text-text-secondary`.
4. Lập danh sách việc còn lại (nếu có) vào cuối file này, mục "Tồn đọng".

---

## Ước lượng tổng

| Batch | Thời gian | Model |
|---|---|---|
| B1 | 1h | Haiku |
| B2 | 1.5h | Haiku |
| B3 | 1.5h | Sonnet |
| B4 | 2h | Sonnet |
| B5 | 0.75h | Haiku |
| B6 | 4h | Sonnet |
| B7 | 1h | Opus |
| B8 | 1h | Sonnet |
| **Tổng** | **~12.75h** | |

## Tồn đọng
*(B8 điền)*
