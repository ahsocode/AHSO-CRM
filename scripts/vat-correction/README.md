# Sửa VAT cho báo giá cũ (chính sách 2026)

Dữ liệu cũ: mọi dòng báo giá đang 10% (do migration backfill). Chính sách AHSO 2026:
- VAT mặc định **8%**.
- Dòng **phần mềm** là **KCT** (không chịu thuế, `taxRate = null`), không cộng vào cơ sở tính VAT.

Script chỉ dùng API (không đụng DB), Node 20+, không cần cài gói.

## Đoán dòng KCT
Một dòng được đoán KCT khi tên (bỏ khoảng trắng đầu/cuối, không phân biệt hoa thường, chuẩn hóa NFC):
- **bắt đầu** bằng "Phần mềm" hoặc "Chương trình", hoặc
- có chứa "(KCT)".

"…và phần mềm AI" ở giữa tên **không** tính. Dòng đã là KCT sẵn thì giữ KCT.
Mọi dòng còn lại -> 8%. Thuế suất mặc định của báo giá -> 8%.
Đây chỉ là **đoán**: đọc kỹ danh sách dòng KCT trong báo cáo trước khi apply.

## Biến môi trường
```bash
export CRM_BASE_URL=https://crm.ahso.vn      # có hoặc không có /api đều được (thiếu thì tự thêm /api)
export CRM_EMAIL=...                         # tài khoản có quyền quotes.view + quotes.edit
export CRM_PASSWORD=...
```
Script không in, không lưu email/mật khẩu.

## 1. Chạy thử (DRY-RUN, mặc định — chỉ gửi GET)
```bash
node scripts/vat-correction/vat-correction.mjs
node scripts/vat-correction/vat-correction.mjs --only BG-2026-061,BG-2026-078   # chỉ vài báo giá
```

## 2. Đọc báo cáo
Bảng in ra màn hình, đồng thời lưu `scripts/vat-correction/report-<timestamp>.json`.
Mỗi báo giá: số BG, trạng thái, khách hàng, tổng hiện tại, tổng mới, chênh lệch, các dòng KCT (tên + thành tiền), và phân loại:

| Phân loại | Ý nghĩa | Khi --apply |
|---|---|---|
| `WILL_CHANGE` | DRAFT/REJECTED, các dòng đang 10% (hoặc KCT) | **Sẽ sửa** |
| `SKIP_LOCKED` | SENT / ACCEPTED / EXPIRED (hoặc trạng thái lạ) | Không bao giờ sửa. `newTotal` chỉ để tham khảo, Henry tự quyết (VD: tạo bản sao rồi sửa) |
| `SKIP_MIXED` | Có dòng mang thuế suất khác 10% và khác KCT -> đã có người sửa tay | Không sửa |
| `NO_CHANGE` | Đã đúng chính sách | Không sửa |

## 3. Áp dụng
```bash
node scripts/vat-correction/vat-correction.mjs --apply                 # hỏi gõ số lượng báo giá sẽ sửa
node scripts/vat-correction/vat-correction.mjs --apply --only BG-2026-061
node scripts/vat-correction/vat-correction.mjs --apply --yes           # bỏ bước hỏi (chỉ khi chắc chắn)
```
Nên apply thử 1 báo giá bằng `--only` trước, mở trên CRM kiểm tra PDF, rồi mới chạy hết.

Với từng báo giá `WILL_CHANGE`, script:
1. GET lại; **bỏ qua** nếu trạng thái không còn DRAFT/REJECTED, `updatedAt` khác lúc dry-run, hoặc kết quả tính khác.
2. Ghi backup `scripts/vat-correction/backup-<quoteNo>.json` (nếu đã có file thì thêm `-<thời gian>`, không ghi đè).
3. `PATCH /quotes/:id` với đầy đủ dữ liệu (giữ thứ tự dòng, tên, mô tả, ĐVT, SL, đơn giá, BOM, điều khoản, ghi chú, độ rộng cột, trạng thái hiện tại). Trường đang trống thì không gửi (giữ nguyên).
4. GET lại và so tổng tiền + thuế suất từng dòng với số tính trước. **Lệch -> báo lỗi to và DỪNG ngay**, không xử lý báo giá khác (exit code 2).

Lỗi HTTP bất kỳ cũng dừng script với thông báo rõ ràng.

Lưu ý: backend tạo lại các dòng khi sửa (id dòng đổi). Nếu dự án đang ở giai đoạn SURVEY, backend tự chuyển sang QUOTING (hành vi bình thường khi sửa báo giá).

## 4. Khôi phục từ backup
Backup là JSON chi tiết báo giá (GET /quotes/:id) trước khi sửa. Cách khôi phục:
- Thủ công trên CRM: mở báo giá, đặt lại thuế suất từng dòng theo `items[].taxRate` trong backup, thuế mặc định theo `taxRate`.
- Hoặc gửi lại qua API (báo giá phải còn DRAFT/REJECTED):
```bash
node -e '
const q=require("./scripts/vat-correction/backup-BG-2026-061.json");
const keep=(v)=>typeof v==="string"&&v.trim()?v:undefined;
const body={projectId:q.project.id,taxRate:q.taxRate,status:q.status,validUntil:q.validUntil||undefined,
 tableColumnWidths:q.tableColumnWidths||undefined,terms:keep(q.terms),deliveryTerms:keep(q.deliveryTerms),internalNote:keep(q.internalNote),
 items:[...q.items].sort((a,b)=>a.order-b.order).map(i=>({name:i.name,description:keep(i.description),unit:keep(i.unit),
 quantity:i.quantity,unitPrice:i.unitPrice,taxRate:i.taxRate,bomId:keep(i.bomId)}))};
console.log(JSON.stringify(body));' > /tmp/restore.json
# rồi PATCH $CRM_BASE_URL/api/quotes/<id> với header Authorization: Bearer <token> và body /tmp/restore.json
```
Sau khi khôi phục, kiểm tra `total` trùng với `total` trong backup.

## Quy tắc an toàn
- Mặc định DRY-RUN, chỉ GET. Ghi chỉ khi có `--apply` + xác nhận (hoặc `--yes`).
- Chỉ sửa DRAFT/REJECTED. **Không bao giờ** sửa SENT/ACCEPTED/EXPIRED. Không bao giờ gọi DELETE.
- Không đụng báo giá đã có người sửa thuế suất (`SKIP_MIXED`).
- Kiểm tra lạc quan bằng `updatedAt`; backup trước mỗi lần ghi; xác minh sau mỗi lần ghi, sai là dừng.
- `report-*.json` và `backup-*.json` chứa dữ liệu khách hàng: **không commit**, giữ nội bộ, xóa khi không cần.

## Test
```bash
node --test scripts/vat-correction/*.test.mjs
```
(Node 22 không nhận thư mục làm đối số `--test`, nên dùng glob như trên.)
