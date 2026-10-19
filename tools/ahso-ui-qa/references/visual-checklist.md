# Visual checklist (bậc 4) — chỉ dùng cho trang trong phạm vi diff

Mỗi trang: 1 screenshot `scale: 0.5` ở 1440×900, phần còn lại kiểm bằng text/JS.

## Mọi trang
- [ ] Breadcrumb topbar đúng module (không phải "Tổng quan › Dashboard" ở trang khác).
- [ ] Không còn chữ tiếng Anh cho người dùng — kiểm nhanh bằng JS:
  ```js
  const BAN=/\b(ledger|desk|snapshot|activity|timeline|milestone|quote|pipeline filter|import|upload|preview|template|owner|stage)\b/i;
  [...document.querySelectorAll('main *')].filter(e=>e.children.length===0&&BAN.test(e.textContent)).map(e=>e.textContent.trim()).slice(0,20)
  ```
- [ ] Không có nhãn nhỏ (eyebrow) lặp lại tiêu đề ngay dưới.
- [ ] Số tiền: `1.245.000.000 ₫` (đầy đủ) hoặc `1,2 tỷ` / `704 tr` (rút gọn) — dấu phẩy thập phân, không "M".
- [ ] Không border phân section (chỉ input, dòng bảng, viền trái 3–4px của card).
- [ ] Console không có lỗi: `read_console_messages` với `onlyErrors: true`.

## Theo trang
| Trang | Kiểm tra |
|---|---|
| `/dashboard` | KPI không có "▲100%" giả; pipeline: Hoàn thành **xanh lá**, Không thành **đỏ**; bấm 1 giai đoạn → Kanban đã lọc |
| `/projects?view=kanban` | ≥ 4 card/cột; mỗi card ≤ 1 chấm cảnh báo; cột "Không thành" thu gọn; tóm tắt "N dự án đang mở · X tỷ" |
| `/customers` | 20 dòng/trang, phân trang cuối bảng; avatar không toàn "CT"; cột Dự án/Phụ trách 1 dòng; % dùng dấu phẩy |
| `/quotes/new` | Hạng mục dạng bảng ~48px/dòng; Enter ở Đơn giá dòng cuối → thêm dòng; khung Tổng hợp bám khi cuộn, số **đầy đủ**; "Tùy chỉnh bản in" đóng mặc định. **Không bấm Lưu trên production.** |
| `/suppliers/[id]` | 3 thẻ số liệu, bảng vật tư, phiếu nhập gần đây; "Tạo phiếu nhập" điền sẵn NCC |
| Mở tab mới (khi đã có tab CRM) | Vào thẳng trang, network **không** có `/api/auth/logout` |
