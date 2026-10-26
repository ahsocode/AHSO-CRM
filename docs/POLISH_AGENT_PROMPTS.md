# Đợt hoàn thiện sau BOM — Kế hoạch & prompt giao agent

> Làm **sau khi đã push BOM**. Mỗi bước = một phiên agent mới mở tại thư mục repo `AHSO-CRM`.
> Ở chỗ `[KHỐI QUY TẮC CHUNG]`: dán nguyên khối "Khối quy tắc chung" trong `docs/BOM_AGENT_PROMPTS.md`.

| Bước | Việc | Model | Ghi chú |
|---|---|---|---|
| 1 | Ô chọn khách hàng / dự án có tìm kiếm (bỏ giới hạn 100 mục) | **Sonnet** | Quan trọng nhất — hỏng khi dữ liệu > 100 |
| 2 | QA: chặn route quên guard + tự dọn cache Docker | **Haiku** | Chỉ sửa `tools/ahso-ui-qa/` |
| 3 | 3 lỗi UX nhỏ (kho trống, "đ"/"₫", "VND" trong thông báo) | **Haiku** | |
| 4 | Review + full QA + push | **Opus** | |

Bước 2 và 3 không đụng file của nhau → chạy song song được. Bước 1 chạy riêng.

---

## Bước 1 — Prompt (Sonnet)

```
Bạn là dev frontend của AHSO CRM (Next.js 14 App Router, TS strict, Tailwind token, shadcn/ui,
TanStack Query, RHF + Zod). Repo: thư mục hiện tại.

[KHỐI QUY TẮC CHUNG]

VẤN ĐỀ: các ô chọn khách hàng / dự án tải cố định trang đầu (`limit: 100`). Khi có hơn 100 bản ghi,
mục ngoài 100 không chọn được và giá trị chọn sẵn (?projectId=, form sửa) hiện trống.
Danh sách hiện tại (grep -rn "limit: 100\|limit: 200" frontend/app frontend/hooks):
  quotes/_components/quote-form-screen.tsx, quotes-client.tsx
  contracts/_components/contract-form-screen.tsx, contracts-client.tsx
  projects/_components/project-form-screen.tsx, projects-client.tsx (limit 200), bom-create-dialog.tsx
  surveys/_components/survey-form-screen.tsx (khách hàng + dự án theo khách hàng)
  activities/_components/activity-form-screen.tsx (2 chỗ)
  inventory/issues/_components/stock-issue-form-screen.tsx, stock-issue-client.tsx
  documents/_components/document-upload-dialog.tsx
  hooks/use-projects.ts:78
Backend đã hỗ trợ `search` cho /customers và /projects (kiểm tra lại DTO filter).

NHIỆM VỤ
1. Tạo component dùng chung frontend/components/shared/entity-combobox.tsx: ô nhập tìm kiếm
   (debounce 300ms, gọi API với search + limit 20), danh sách gợi ý điều khiển được bằng bàn phím
   (↑ ↓ Enter Esc), hiện nhãn của giá trị đang chọn KỂ CẢ khi nó không nằm trong kết quả tìm
   (lấy bằng hook chi tiết theo id, ví dụ useCustomer(id)/useProject(id) — có sẵn thì dùng lại),
   nút xóa chọn, trạng thái đang tải / không có kết quả bằng tiếng Việt, aria đúng chuẩn combobox.
   Tham khảo frontend/components/bom/bom-material-cell.tsx (picker vật tư đã làm theo kiểu này).
   KHÔNG thêm thư viện mới, KHÔNG sửa components/ui/*. Không dùng portal → nếu đặt trong <form>
   thì phím Enter trong ô tìm KHÔNG được submit form (preventDefault).
2. Tạo 2 wrapper: CustomerCombobox, ProjectCombobox (ProjectCombobox nhận lọc customerId tùy chọn).
   Tương thích RHF: dùng qua <Controller> hoặc value/onChange; giữ nguyên id trường (#customerId,
   #projectId) cho input chính để e2e cũ vẫn tìm được.
3. Thay toàn bộ các chỗ trong danh sách trên. Ở các trang danh sách (bộ lọc), dùng combobox cho bộ lọc.
   Xóa các useEffect "gán lại setValue sau khi option tải xong" chỉ tồn tại vì select native
   (quote/contract ?projectId, project form tạo nhanh khách hàng) NHƯNG giữ đúng hành vi:
   ?projectId= vẫn chọn sẵn; tạo nhanh khách hàng vẫn chọn ngay khách mới.
4. Cập nhật e2e nào đang dùng selectOption trên #customerId / #projectId sang thao tác combobox
   (grep -rn "customerId\|projectId" e2e/). Thêm e2e mới trong
   test.describe("Ô chọn có tìm kiếm", ...): tạo qua API 1 khách hàng có tên duy nhất, mở
   /projects/new, gõ 3 ký tự tên → chọn được; mở /quotes/new?projectId=<dự án cũ nhất> (ngoài
   100 mục đầu nếu seed đủ, nếu không thì dự án bất kỳ) → ô dự án hiện đúng tên.
   Chạy: npm run qa:prepush -- --e2e-only --grep "Ô chọn có tìm kiếm|Khách hàng|Báo giá|Hợp đồng"
5. Ghi bẫy mới (nếu có) vào tools/ahso-ui-qa/SKILL.md mục "Bẫy đã gặp".
6. Commit: "feat(ui): searchable customer/project combobox replacing 100-item selects"
```

---

## Bước 2 — Prompt (Haiku)

```
Sửa công cụ QA của repo AHSO CRM. CHỈ sửa trong tools/ahso-ui-qa/ (script + SKILL.md).
Code/comment tiếng Anh, thông báo cho người dùng có thể tiếng Anh (đây là công cụ dev).

1. tools/ahso-ui-qa/scripts/static_checks.py — thêm kiểm tra "guard":
   - Quét mọi backend/src/**/*.controller.ts (bỏ file `._*`).
   - Một route = dòng có @Get/@Post/@Patch/@Put/@Delete(.
   - Route được coi là có bảo vệ nếu: class có @UseGuards( ở 5 dòng ngay trên `export class`,
     HOẶC trong khối decorator ngay trên method có @UseGuards(, HOẶC có @Public().
   - Ngoại lệ hợp lệ (whitelist trong script, có comment lý do): auth.controller.ts các route
     login / refresh / forgot / reset password; health.controller.ts.
   - Route không bảo vệ → "ERROR guard    <file>:<dòng>  <METHOD> <path>".
   - Route có JwtAuthGuard ở class nhưng thiếu @RequirePermissions/@RequireAnyPermissions/@Roles
     → "WARN  guard    ..." (không chặn push).
   - Gọi kiểm tra này trong luồng chính cùng các check khác, quét TOÀN BỘ controller (không chỉ
     file thay đổi).
   - Tự kiểm: tạm thời bỏ @UseGuards trong 1 controller → phải ra ERROR; trả lại như cũ.
2. tools/ahso-ui-qa/scripts/prepush.sh — trước bước `"${COMPOSE[@]}" build backend frontend`:
   - Đọc dung lượng build cache: docker system df --format '{{.Type}} {{.Size}}'
   - Nếu dòng "Build Cache" > 5GB (so sánh bằng số; đơn vị có thể là kB/MB/GB) thì chạy
     `docker builder prune -f --filter until=72h` và in "[qa] pruned Docker build cache".
   - KHÔNG bao giờ prune volume, KHÔNG prune image đang dùng.
   - Script phải chạy được trên macOS bash 3.2 (không dùng mapfile, ${var,,}, associative array).
3. tools/ahso-ui-qa/SKILL.md: thêm 2 dòng mô tả check "guard" và việc tự dọn cache vào phần mô tả
   bậc kiểm tra; cập nhật mục bẫy "Docker đầy ổ đĩa".
Kiểm tra: python3 tools/ahso-ui-qa/scripts/static_checks.py chạy được, 0 ERROR guard trên code hiện
tại; bash -n tools/ahso-ui-qa/scripts/prepush.sh. Xóa file `._*` trong tools/.
Commit: "feat(qa): flag unguarded controller routes; prune Docker build cache before QA build".
Báo cáo ≤ 10 dòng, liệt kê các WARN guard tìm thấy (nếu có).
```

---

## Bước 3 — Prompt (Haiku)

```
Sửa 3 lỗi UX nhỏ trong repo AHSO CRM. Chỉ sửa đúng chỗ, KHÔNG đổi logic nghiệp vụ hay API.

[KHỐI QUY TẮC CHUNG]

1. Form phiếu nhập kho chưa có kho nào:
   frontend/app/(dashboard)/inventory/receipts/_components/ (file *form*.tsx, ô #warehouseId dùng
   useWarehousesSelect). Khi đã tải xong và danh sách kho rỗng: hiện khối thông báo nền
   warning-bg "Chưa có kho nào. Tạo kho trước khi lập phiếu nhập." kèm link "Tạo kho" tới trang tạo
   kho (tìm route đúng trong app/(dashboard)/inventory/warehouses). Làm tương tự cho form phiếu
   xuất, chuyển kho, kiểm kê nếu có cùng ô chọn kho.
2. Ký hiệu tiền thống nhất "₫": tìm mọi chỗ ghép tay "đ" hoặc " VND" sau số tiền ở frontend
   (grep -rn "toLocaleString\|đ\`\|} đ\|VND" frontend/app frontend/components frontend/lib — loại các
   từ tiếng Việt bình thường). Hộp thoại chấp nhận báo giá đang dùng "đ" → đổi sang formatVND.
   Mọi số tiền hiển thị phải qua formatVND / formatVNDShort từ @/lib/format.
3. Thông báo lỗi backend có "VND": backend/src/contracts/contracts.service.ts (~dòng 469, vượt giá trị
   hợp đồng) và backend/src/projects/projects.service.ts (~dòng 836, mô tả timeline) → dùng ký hiệu "₫"
   với định dạng số vi-VN (tìm helper format có sẵn trong backend, ví dụ formatNumber; nếu không có
   thì dùng toLocaleString("vi-VN")). GIỮ NGUYÊN các chỗ `currency: "VND"` (mã ISO cho Intl/PDF).
   Cập nhật unit test backend có so khớp chuỗi cũ (grep -rn "VND" backend/src --include=*.spec.ts).
Kiểm tra: cd backend && npx jest contracts projects; e2e: grep -rn "VND\| đ" e2e/ và sửa nếu test
dựa vào chuỗi cũ; chạy npm run qa:prepush -- --e2e-only --grep "Kho|Hợp đồng|Báo giá".
Commit: "fix(ux): empty-warehouse hint, consistent ₫ symbol in UI and backend messages".
Báo cáo ≤ 10 dòng.
```

---

## Bước 4 — Prompt (Opus)

```
Review các commit chưa push của AHSO CRM (git log origin/main..HEAD) thuộc đợt hoàn thiện:
combobox tìm kiếm, check guard trong static_checks, tự dọn cache Docker, 3 lỗi UX.

1. Combobox: thử tay trên stack QA (npm run qa:up, http://localhost:3100) — bàn phím, Enter trong ô
   tìm không submit form cha, giá trị chọn sẵn ngoài trang đầu vẫn hiện tên, tạo nhanh khách hàng
   vẫn tự chọn, quyền STAFF chỉ thấy khách hàng/dự án của mình trong gợi ý.
2. static_checks guard: đọc logic, thử bỏ guard một route → ERROR; không báo nhầm route auth/health.
3. prepush.sh: chạy được trên bash 3.2; không có lệnh prune volume/image.
4. Không còn chuỗi " VND"/"đ" ghép tay trong UI; `currency: "VND"` còn nguyên.
5. Chạy full: npm run qa:prepush (không --fast). Sửa lỗi nếu có (commit riêng).
Báo cáo: vấn đề theo mức độ (chặn push / nên sửa / gợi ý), việc đã sửa, lệnh push.
```
