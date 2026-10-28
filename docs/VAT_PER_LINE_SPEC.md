# VAT theo từng dòng báo giá — spec

## Mục tiêu
Mỗi dòng báo giá (`QuoteItem`) có thuế suất VAT riêng: KCT, 0%, 5%, 8%, 10% (và giá trị lạ 0–100 cho dữ liệu cũ).
`Quote.taxRate` chỉ còn là **mức mặc định gợi ý cho dòng mới**; tổng tiền KHÔNG dùng nó nữa.

## Dữ liệu (đã làm: schema + migration `20261028100000_quote_item_tax_rate`)
- `QuoteItem.taxRate Decimal(5,2)?` — `null` = KCT (không chịu thuế), `0` = thuế suất 0%. Hai trường hợp KHÁC nhau.
- Migration backfill dòng cũ bằng `Quote.taxRate` => báo giá cũ giữ nguyên số tiền.

## Hợp đồng API (JSON)
Ghi (create/update quote):
- `items[].taxRate?: number | null` — 0..100, tối đa 2 chữ số thập phân. `null` = KCT. **Bỏ trống (undefined) = lấy `quote.taxRate`**. Luôn lưu giá trị đã resolve xuống DB.
- `taxRate` cấp báo giá giữ nguyên (mặc định 10).
Đọc:
- `items[].taxRate: number | null`
- `taxRate` (mặc định), `taxAmount` (= tổng thuế các dòng), `total`
- `taxBreakdown: Array<{ rate: number | null; base: number; tax: number }>` — sắp xếp rate giảm dần, KCT (null) cuối cùng; chỉ nhóm có ít nhất 1 dòng.

## Cách tính (nguồn sự thật: `buildQuoteTotals` ở backend, bản sao hành vi ở frontend)
```
lineTotal = round(quantity * unitPrice)
base[rate] = sum(lineTotal) theo nhóm rate (null là một nhóm riêng)
tax[rate]  = rate === null ? 0 : round(base[rate] * rate / 100)   // làm tròn theo NHÓM như hóa đơn điện tử
subtotal = sum(base), taxAmount = sum(tax), total = subtotal + taxAmount
```
Khoá nhóm so sánh theo số (8 và 8.00 cùng nhóm).
`calculateAcceptedQuoteTotal` (báo giá chấp nhận một phần) và hợp đồng dùng cùng quy tắc theo nhóm.

## Nhãn hiển thị
`null` -> "KCT"; số -> `${n}%` (bỏ phần thập phân .00). Dòng tổng: "VAT 8%", "VAT 10%", "Không chịu thuế (KCT)".
Nhiều nhóm => mỗi nhóm một dòng trong phần tổng (PDF, màn hình). Không thêm cột VAT vào bảng PDF (giữ `tableColumnWidths`).

## Giới hạn / ngoài phạm vi
- `ProjectCost.vatRate` (chi phí đầu vào) KHÔNG đổi.
- Tổng các giá trị vẫn phải ≤ `MAX_QUOTE_AMOUNT` (xem create-quote.dto.ts).
- Preset UI: KCT, 0%, 5%, 8%, 10%; nếu dòng cũ có mức khác, vẫn hiển thị đúng mức đó.

## Quy tắc làm việc
Theo CLAUDE.md: DTO Zod + ZodValidationPipe, mock thuần (không mock PrismaService), test phải FAIL khi logic tiền sai.
Không commit, không xóa file, không đụng file ngoài phạm vi được giao. Prisma client chưa được generate lại (môi trường không tải được engine):
lỗi type chỉ do thiếu `QuoteItem.taxRate` trong client cũ thì báo cáo, đừng che bằng `any`/`ts-expect-error`.
