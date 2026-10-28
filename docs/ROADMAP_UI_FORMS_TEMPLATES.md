# Kế hoạch: Giao diện, biểu mẫu, mẫu tài liệu (cập nhật 28/10/2026)

Nguồn: `FORM_STANDARD_AUDIT.md`, `DOCUMENT_TEMPLATE_AUDIT.md`, review bản thật crm.ahso.vn.
Quy tắc chung: mỗi bước là một PR độc lập, revert được; logic tiền/VAT/quyền không đổi nếu chưa được Henry duyệt; điều khoản hợp đồng duyệt từng điều (L-01..L-20); chạy đủ typecheck + lint + test trước khi báo xong; không ghi vào DB thật khi chưa có xác nhận.

## Giai đoạn 0 — Chốt nền (Henry làm, ~30 phút)
1. Commit 2 nhóm riêng: (a) VAT 8% + MCP + PDF "trên X đ" + script sửa dữ liệu; (b) P0 giao diện (dự án, hợp đồng, lịch).
2. `npm run qa:prepush`, push, deploy (có migration `20261028150000_quote_default_vat_8`).
3. Chạy `vat-correction.mjs --apply` cho 18 báo giá nháp (đã backup DB trước), chạy lại dry-run kiểm NO_CHANGE.
4. Xem bằng mắt: danh sách dự án, kanban, hợp đồng, lịch trên bản thật.

## Giai đoạn 1 — Đợt P1 giao diện (sau Giai đoạn 0)
| Mục | Nội dung | File chính |
|---|---|---|
| 1.1 | Dashboard: "Việc cần làm hôm nay" kiểm tra lỗi trống (cùng nguyên nhân lịch?), thay bằng "Cần làm ngay" (báo giá nháp lâu chưa gửi, dự án quá hạn, hợp đồng còn nợ); nhãn số trên cột biểu đồ | dashboard module + frontend dashboard |
| 1.2 | Báo giá: tăng cỡ trang, lọc nhanh bấm từ ô KPI, thanh hành động hàng loạt (gửi, PDF, nhân bản) | quote-table.tsx, quotes list |
| 1.3 | Khách hàng: cột giá trị báo giá/doanh thu, lọc nhanh trạng thái | customers list |
| 1.4 | Thanh bên: gom nhóm 17 mục (Bán hàng / Vận hành / Kho / Quản trị), phím tắt tạo mới | layout/sidebar |
Cần Henry: không có quyết định chặn.

## Giai đoạn 2 — Chuẩn hoá biểu mẫu nhập liệu (8 bước, theo FORM_STANDARD_AUDIT)
Bước 1 nền tảng (FormField, FormSection, FormActions, FormError, MoneyInput, NumberInput, DateInput, SelectField, FormDialog, useUnsavedChangesGuard, một hệ toast duy nhất) → auth → admin → danh mục → nghiệp vụ → nhóm tiền (báo giá, hợp đồng, thanh toán) LAST, chỉ áp MoneyInput sau khi có test đối chiếu payload không đổi.
Điều kiện bắt đầu: xong Giai đoạn 0 và 1.2 (cùng file báo giá).

## Giai đoạn 3 — Chuẩn hoá mẫu tài liệu (10 bước, theo DOCUMENT_TEMPLATE_AUDIT)
- Làm ngay không cần duyệt: Bước 0 (lưới an toàn/snapshot), Bước 1 (hiển thị thuần), Bước 2 (hạ tầng: nội suy ngày/nơi, alias taxId→taxCode, múi giờ VN, không in 0 cho thiếu, allowlist `extra` qua security review).
- Bước 3 (văn bản vận hành dùng chung kit): không cần duyệt câu chữ.
- Bước 4 (báo giá): chờ Q-1, Q-3, Q-4, L-19.
- Bước 5-7 (dữ liệu thật, giao hàng/nghiệm thu, đánh số): chờ L-10..L-15, L-18, L-20.
- Bước 8 (hợp đồng/NDA): chỉ làm TỪNG ĐIỀU đã tích duyệt; khuyến nghị có người phụ trách pháp lý xem.

## Quyết định Henry cần trả lời (mặc định đề xuất nếu không trả lời)
| ID | Câu hỏi | Mặc định đề xuất |
|---|---|---|
| Q-1 | PDF báo giá có cột VAT? | Không cột VAT riêng; VAT theo nhóm ở khối tổng + nhãn "trên X đ" (đúng spec hiện tại) |
| Q-3 | vi-en song ngữ? | Song ngữ Việt + Anh |
| Q-4 | Màu thương hiệu | #073A66 (mẫu 059) |
| Q-5 | Tiền tố số đề xuất | AHSO- |
| Q-6 | Bằng chữ thêm "chẵn"? | Có |
| Q-7 | Văn bản AHSO phát hành có letterhead logo? | Có |
| Q-2 | Còn cho sửa bố cục văn bản pháp lý bằng variant editor? | Khoá cho loại pháp lý |

## Phân công agent (theo file không chồng nhau)
- Opus: mọi thứ chạm tiền/VAT/số văn bản/DB (Giai đoạn 3 bước 2 phần dữ liệu, 5, 6, 7).
- Sonnet: giao diện, form, partial/CSS.
- Haiku: sửa chính tả, khoá i18n, dọn mã chết.
- Mỗi đợt kết thúc bằng 1 agent kiểm độc lập (code-reviewer, security-auditor cho `extra` và upload) và tôi chạy lại toàn bộ kiểm tra.

## Rủi ro đã biết
- Bước migrate form và mẫu đụng cùng file báo giá/hợp đồng với VAT: phải commit/deploy VAT trước.
- `prisma:seed` xoá dữ liệu: không chạy trên DB có dữ liệu (seed chưa sửa an toàn).
- Dựng PDF trong VM dùng font thay thế: ngắt trang có thể lệch nhẹ so với production, cần xem PDF thật sau deploy.
