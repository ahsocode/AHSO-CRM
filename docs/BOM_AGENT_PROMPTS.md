# BOM — Kế hoạch & prompt giao agent code

> Đặc tả nghiệp vụ: `docs/BOM_SPEC.md`. File này là **kế hoạch thực thi** + **prompt copy-paste** cho từng bước.
> Mỗi bước chạy trong **một phiên agent mới** (Claude Code mở tại thư mục repo `AHSO-CRM`), xong bước nào commit bước đó.

## Hiện trạng (23/10/2026)

| Phần | Trạng thái |
|---|---|
| Schema + migration `20261023090000_bom_project_costs` + đặc tả | ✅ commit `d32500b` |
| Backend GĐ1–4 (BOM, chi phí trực tiếp, nhiều đợt phân bổ, gợi ý FIFO, lãi gộp, bảng kê, mẫu máy) + types/hooks frontend | ✅ commit `653839e`, jest 67/67 |
| Frontend: loại vật tư, tab BOM, trình soạn BOM, nhập Excel, mẫu máy, tab phân bổ nhiều đợt, tab chi phí & lãi gộp, `e2e/project-costs.spec.ts` | 🟡 **đã viết nhưng chưa commit, chưa chạy thử**; `tsc` frontend pass |
| Báo giá: "Gắn BOM" trên dòng + khối giá vốn nội bộ | ❌ chưa làm |
| Menu "Mẫu máy" trong nhóm Kho | ❓ cần kiểm tra |
| `e2e/bom.spec.ts` | ❌ chưa có |

## Thứ tự thực hiện

| Bước | Việc | Model | Ước lượng |
|---|---|---|---|
| 0 | Chốt phần đang dở: migrate DB local, commit WIP | Anh tự chạy | 5 phút |
| 1 | Rà soát + hoàn thiện frontend GĐ1 & GĐ4 đang dở, thêm "Gắn BOM" cho báo giá, menu Mẫu máy, `e2e/bom.spec.ts` | **Sonnet** | 1 phiên |
| 2 | Rà soát + hoàn thiện frontend GĐ2–3 đang dở, chạy `e2e/project-costs.spec.ts` | **Sonnet** | 1 phiên |
| 3 | Việt hóa / token / No-Line rà soát toàn bộ file mới | **Haiku** | 1 phiên ngắn |
| 4 | Review tổng + bảo mật + chạy full QA trước khi push | **Opus** | 1 phiên |

Bước 1 và 2 **chạy tuần tự** (cùng sửa `project-detail-client.tsx`). Bước 3 sau khi 1–2 xong.

---

## Bước 0 — Anh tự chạy (từng lệnh, không có chú thích `#`)

```
cd /Volumes/TRANSCEND/Claude/WORK/CRM/AHSO-CRM
```
```
git add -A
```
```
git commit -m "wip(bom): frontend BOM, materials kind, allocation batches, project costs (unverified)"
```
```
cd backend && npx prisma generate && cd ..
```

Migration được stack QA tự chạy (`migrate deploy`) khi `npm run qa:up`.

---

## Khối quy tắc chung (đã nhúng sẵn trong mọi prompt bên dưới)

```
QUY TẮC CHUNG
- Đọc CLAUDE.md, docs/BOM_SPEC.md, docs/GLOSSARY_VI.md trước khi làm.
- KHÔNG sửa backend/prisma/schema.prisma hay migrations. Nếu buộc phải đổi schema: dừng lại và báo.
- Frontend: chỉ Tailwind token / CSS variable (không hex), font Be Vietnam Pro, No-Line Rule
  (phân vùng bằng nền, không bằng border), mọi chữ hiển thị tiếng Việt theo GLOSSARY_VI.md,
  tiền dùng formatVND (số đầy đủ, không rút gọn trên báo giá/hợp đồng/giá vốn).
- Mọi API call qua apiClient (@/lib/api-client); không fetch; không `any`; không thêm npm package;
  không sửa components/ui/*. Dialog của dự án KHÔNG có portal → luôn render dialog bên NGOÀI <form>,
  reset form bằng giá trị cụ thể reset({...}). Native <select>: gán lại setValue sau khi option tải xong.
- onError hiển thị getApiErrorMessage(error, "<câu mặc định>") để thấy lý do thật từ backend.
- Code/comment/commit message tiếng Anh.
- Ổ đĩa exFAT: trước khi kết thúc chạy
  find frontend backend/src e2e -path '*/node_modules' -prune -o -name '._*' -delete
KIỂM TRA BẮT BUỘC TRƯỚC KHI BÁO XONG
  cd frontend && npx tsc --noEmit -p . && cd ..
  cd backend && npx tsc --noEmit -p . && cd ..
  npx --prefix frontend eslint <các file đã sửa>
  python3 tools/ahso-ui-qa/scripts/static_checks.py      (0 error; dòng e2e chứa dữ liệu test
                                                          thêm `// qa-static: not-ui`)
  npm run qa:prepush -- --e2e-only --grep "<tên test của bước>"
- Không push. Commit 1 lần cuối bước với message tiếng Anh.
- Báo cáo cuối ≤ 20 dòng: file đã đổi, lệch đặc tả + lý do, việc còn mở. Không dán code.
```

---

## Bước 1 — Prompt (Sonnet)

```
Bạn là dev frontend của AHSO CRM (Next.js 14 App Router, TS strict, Tailwind token, shadcn/ui,
TanStack Query, RHF + Zod). Repo: thư mục hiện tại.

[Dán KHỐI QUY TẮC CHUNG ở trên vào đây]

BỐI CẢNH: backend BOM đã xong (backend/src/boms/, commit 653839e). Lớp dữ liệu frontend đã có:
frontend/types/bom.ts, frontend/hooks/use-boms.ts, use-materials.ts (useMaterialsSelect(search, kind)),
nhãn trong frontend/lib/constants.ts. Một phiên trước đã viết dở (commit WIP), CHƯA chạy thử:
- materials/_components/* (ô "Loại", badge, bộ lọc loại)
- projects/_components/project-boms-tab.tsx, bom-create-dialog.tsx
- projects/[id]/boms/[bomId]/ ; components/bom/{bom-editor, bom-lines-table, bom-import-dialog,
  save-as-model-dialog}.tsx ; lib/bom-editor.ts ; lib/bom-excel.ts
- inventory/models/ (danh sách + [bomId])

NHIỆM VỤ (đặc tả: docs/BOM_SPEC.md §1, §2, §5 "GĐ1" và "GĐ4"):
1. Rà soát các file dở ở trên theo đặc tả, sửa chỗ thiếu/sai. Kiểm tra kỹ: BOM APPROVED chỉ đọc;
   dòng chưa có mã vật tư nền warning; tổng theo nhóm; nhập Excel (ghép cột tự đoán, xem trước 20 dòng,
   khớp Material.code, nối thêm/thay thế, bỏ dòng trống/dòng tổng); xuất Excel; BOM con chỉ chọn mẫu máy
   APPROVED; "Lưu thành mẫu máy" (chọn thành phẩm PRODUCT có sẵn hoặc tạo mới; nguồn Dự toán/Thực tế).
2. Báo giá (CHƯA LÀM): trong form báo giá (quotes/_components/quote-form-screen.tsx) mỗi dòng có thao
   tác "Gắn BOM" chọn BOM của cùng dự án (gửi bomId theo DTO đã có). Trang chi tiết báo giá
   (quote-detail-client.tsx) hiện khối nội bộ "Giá vốn dự kiến · Lãi gộp dự kiến" theo từng dòng và tổng,
   CHỈ khi response có costEstimate, kèm dòng chú thích "Nội bộ — không in ra báo giá".
   Xác nhận bản in/PDF không chứa chữ "Giá vốn".
3. Menu: đảm bảo có mục "Mẫu máy" (/inventory/models) trong nhóm Kho ở sidebar (tìm NAV_ITEMS hoặc
   cấu hình sidebar hiện có).
4. Viết e2e/bom.spec.ts theo §7 phần BOM: tạo BOM dự án → nhập dòng → duyệt → không sửa được →
   tạo phiên bản mới; gắn BOM vào dòng báo giá → thấy giá vốn ở chi tiết, bản in không có "Giá vốn";
   lưu thành mẫu máy → tạo BOM dự án mới từ mẫu. Tạo dữ liệu qua API, dọn trong finally; dùng
   e2e/helpers.ts và các helper trong e2e/ui-regression.spec.ts (API_URL, getAccessTokenFromPage,
   authHeaders, unwrap — copy nếu chưa export). Đặt tất cả test trong
   test.describe("BOM", ...) và chạy: npm run qa:prepush -- --e2e-only --grep "BOM"
5. Commit: "feat(bom): BOM editor, Excel import/export, models, quote cost estimate + e2e"
```

---

## Bước 2 — Prompt (Sonnet)

```
Bạn là dev frontend của AHSO CRM (Next.js 14 App Router, TS strict, Tailwind token, shadcn/ui,
TanStack Query, RHF + Zod). Repo: thư mục hiện tại.

[Dán KHỐI QUY TẮC CHUNG ở trên vào đây]

BỐI CẢNH: backend đã có nhiều đợt phân bổ / dự án (mỗi đợt = 1 hóa đơn bán), endpoint gợi ý FIFO,
chi phí trực tiếp, cost-summary, cost-sheet (xem docs/BOM_SPEC.md §3 GĐ2–3, §4). Hooks:
frontend/hooks/use-project-costs.ts, use-projects.ts, use-boms.ts. Phiên trước đã viết dở, CHƯA chạy:
- projects/_components/project-materials-tab.tsx (đã đổi sang danh sách đợt)
- projects/_components/project-finance/{allocation-batch-card, allocation-batch-editor,
  allocation-rows-editor, cost-summary-view, project-cost-dialog, export-cost-sheet}.tsx/ts
- projects/_components/project-costs-tab.tsx
- e2e/project-costs.spec.ts

NHIỆM VỤ (đặc tả §2 R9–R10, §4, §5 "GĐ2–3"):
1. Rà soát và hoàn thiện các file trên. Kiểm tra kỹ:
   - Tạo đợt: chọn BOM + ngày/số hóa đơn bán → "Gợi ý theo BOM" điền lô; hiện thiếu hàng (danger) và
     dòng dịch vụ chưa có chi phí; vẫn sửa lô thủ công được; xác nhận / hủy (chỉ DRAFT).
   - Dự án có phân bổ kiểu cũ (1 đợt) vẫn hiển thị đúng.
   - Tab "Chi phí & lãi gộp": bảng chi phí trực tiếp (thêm/sửa/xóa; không sửa được chi phí đã gắn đợt
     CONFIRMED — hiển thị lý do từ backend); thẻ Doanh thu · Giá vốn vật tư · Chi phí trực tiếp ·
     Lãi gộp · %; bảng "Dự toán – thực tế" theo nhóm, mở rộng theo dòng BOM, chênh lệch vượt = danger.
   - "Xuất bảng kê giá vốn" trên đợt CONFIRMED → Excel tiêu đề "Bảng kê giá vốn hóa đơn bán số …".
2. Hoàn thiện e2e/project-costs.spec.ts: kho + vật tư STOCK + phiếu nhập (xác nhận) có 1 lô ngày trước và
   1 lô ngày SAU hóa đơn bán; BOM dự án có vật tư đó + 1 dòng SOFTWARE; bấm "Gợi ý theo BOM" → lô sau ngày
   không được dùng, thiếu hàng hiện khi SL vượt tồn; thêm chi phí trực tiếp; xác nhận đợt; kiểm tra số lãi
   gộp trên tab "Chi phí & lãi gộp". Đặt trong test.describe("Giá vốn dự án", ...) và chạy:
   npm run qa:prepush -- --e2e-only --grep "Giá vốn dự án"
3. Commit: "feat(bom): allocation batches with FIFO suggest, direct costs, gross margin + e2e"
```

---

## Bước 3 — Prompt (Haiku)

```
Rà soát giao diện các file MỚI/ĐÃ SỬA trong 2 commit gần nhất của repo AHSO CRM
(git diff --name-only HEAD~2 -- frontend). Chỉ sửa styling và chữ hiển thị, KHÔNG đổi logic,
API call, kiểu dữ liệu.

Kiểm tra từng file:
1. Chữ hiển thị cho người dùng phải là tiếng Việt, đúng thuật ngữ docs/GLOSSARY_VI.md
   (template→mẫu, version→phiên bản, active→đang dùng, export→xuất, import→nhập, draft→nháp…).
2. Không có mã màu hex/rgb; chỉ class Tailwind theo token có sẵn (xem tailwind.config và globals.css).
3. No-Line Rule: không dùng border để chia section (border cho input/table cell thì được).
4. Font: không có font-family nào khác Be Vietnam Pro.
5. Tiền dùng formatVND, không ghép chuỗi " VND"/"đ" thủ công.

Sau khi sửa: python3 tools/ahso-ui-qa/scripts/static_checks.py phải 0 error 0 warning;
cd frontend && npx tsc --noEmit -p .
Nếu đổi chữ mà e2e đang dùng làm selector: grep -rn "<chữ cũ>" e2e/ và sửa test cho khớp.
Xóa file rác: find frontend e2e -path '*/node_modules' -prune -o -name '._*' -delete
Commit: "style(bom): glossary and token cleanup". Báo cáo ≤ 10 dòng.
```

---

## Bước 4 — Prompt (Opus)

```
Review toàn bộ tính năng BOM của AHSO CRM trước khi push (git log origin/main..HEAD).
Đọc docs/BOM_SPEC.md làm chuẩn.

1. Bảo mật: mọi route mới trong backend/src/boms và material-allocations có JwtAuthGuard +
   PermissionsGuard + quyền đúng R11; STAFF chỉ thấy BOM/chi phí/lãi gộp của dự án mình;
   costEstimate chỉ trả cho người có projects.edit; bản in/PDF báo giá không lộ bomId/giá vốn.
   Thử bằng curl trên stack QA (localhost:3101): không token → 401; tài khoản staff → 403/404 với dự án
   người khác.
2. Đúng nghiệp vụ: R4 khóa APPROVED, R5, R6 chống vòng BOM con, R9 ngày hóa đơn cho cả lô và chi phí,
   R10 nhiều đợt, FIFO trừ phần đã phân bổ/đang giữ, doanh thu trước VAT (giá trị hợp đồng ĐÃ gồm VAT).
3. Kiểm tra migration khớp schema:
   cd backend && npx prisma migrate diff --from-migrations prisma/migrations
     --to-schema-datamodel prisma/schema.prisma
     --shadow-database-url "postgresql://ahso:<mật khẩu QA>@localhost:55432/shadow"   → phải rỗng
4. Chạy: npm run qa:prepush   (đầy đủ, không --fast). Sửa lỗi nếu có, commit riêng.
5. Cập nhật docs/PROJECT_STRUCTURE.md nếu có route/module mới chưa ghi; ghi các bẫy mới vào
   tools/ahso-ui-qa/SKILL.md mục "Bẫy đã gặp".
Báo cáo: danh sách vấn đề theo mức độ (chặn push / nên sửa / gợi ý), việc đã sửa, lệnh push.
```

---

## Mẹo tiết kiệm token

- Mỗi bước **một phiên mới**, chỉ dán đúng prompt của bước đó — agent tự đọc spec, không cần kể lại lịch sử.
- Khi test fail, chỉ dán cho agent **tiêu đề test + dòng Error + Locator** (như script QA gợi ý), không dán toàn bộ log.
- Bước 3 dùng Haiku vì chỉ là rà soát chữ và màu; đừng giao Haiku sửa logic.
- Nếu Docker báo lỗi postgres exit (1): `docker builder prune -f` rồi `docker image prune -a -f` (xem SKILL.md).
