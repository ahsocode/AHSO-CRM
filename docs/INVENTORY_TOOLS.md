# Tool MCP & API kho — PR 1 (hóa đơn, loại NCC, nhóm hạch toán, lô theo dự án)

> Tool cũ giữ nguyên hành vi; mọi tham số mới đều **tùy chọn**.
> **`kind`** = vật tư có qua kho hay không (STOCK / SERVICE / PRODUCT). **`accountingClass`** = hạch toán vào tài khoản nào (RAW_MATERIAL TK152, TOOL 153, MERCHANDISE 156, FINISHED_GOOD 155, CONSUMABLE_COMMON).

## Tool mới

| Tool | Tham số | Ghi chú |
|---|---|---|
| `find_receipt_by_invoice` | `invoiceNumber`, `invoiceSeries`, `sellerTaxCode`, `invoiceDateFrom`, `invoiceDateTo`, `limit` (cần ≥ 1 tham số lọc) | Tìm phiếu nhập đang giữ một hóa đơn |
| `update_receipt_invoice` | `receiptId` + các trường hóa đơn (bên dưới) | Chỉ sửa hóa đơn, kể cả phiếu đã xác nhận; không đụng dòng hàng/tồn kho. Đổi ngày HĐ chỉ khi lô chưa bị tiêu hao |
| `bulk_set_receipt_invoices` | `items[]`: `receiptId` hoặc `receiptNo` + trường hóa đơn (≤ 500 dòng) | Kết quả từng dòng: UPDATED / DUPLICATE / NOT_FOUND / ERROR |
| `bulk_update_supplier_types` | `items[]`: `supplierId`, `supplierType` | Kết quả từng dòng: UPDATED / UNCHANGED / NOT_FOUND / ERROR |
| `bulk_update_material_classes` | `items[]`: `materialId`, `accountingClass` | Dòng vi phạm ràng buộc `kind` báo lỗi riêng, dòng khác vẫn chạy |

Trường hóa đơn: `purchaseInvoiceNo` (cũ), `invoiceSeries`, `invoiceNumber`, `invoiceDate`, `sellerTaxCode`, `invoiceFileRef`, `invoiceLookupCode`, `invoiceType` (NORMAL/REPLACEMENT/ADJUSTMENT), `relatedInvoiceRef`.

## Tool sửa (thêm tham số tùy chọn)

| Tool | Tham số thêm |
|---|---|
| `create_stock_receipt` | Các trường hóa đơn ở trên; `items[].projectId` (hàng mua riêng cho dự án). Trả `warnings` nếu NCC loại OTHER |
| `list_stock_receipts` | `invoiceNumber`, `invoiceSeries`, `sellerTaxCode`, `invoiceDateFrom`, `invoiceDateTo`, `hasInvoice` |
| `get_stock_receipt_detail` | (không tham số mới) hiển thị hóa đơn và dự án của từng dòng |
| `confirm_stock_receipt` | (không tham số mới) trả `warnings` nếu NCC loại OTHER |
| `get_inventory_balances` | `projectId`: chỉ tính tồn thuộc lô gắn dự án đó (tổng `remainingQuantity` của lô) |
| `list_suppliers` | `supplierType` |
| `create_supplier` / `update_supplier` | `supplierType` (GOODS mặc định / SERVICE / EXPENSE / OTHER) |
| `list_materials` | `kind`, `accountingClass` |
| `create_material` / `update_material` | `kind`, `accountingClass` |

## API backend mới

| Route | Quyền | Mô tả |
|---|---|---|
| `PATCH /stock-receipts/:id/invoice` | `inventory.edit` | Sửa hóa đơn của phiếu (không phải CANCELLED) |
| `POST /stock-receipts/invoices/bulk` | `inventory.edit` | Nhận mảng hoặc `{items}`, trả `{results, summary}` |
| `PATCH /suppliers/bulk-type` | `suppliers.edit` | Nhận mảng hoặc `{items}` |
| `GET /suppliers/suggest-expense` | `suppliers.view` | Gợi ý NCC có tên giống chi phí (Grab, xăng, VNPT…) — chỉ đọc, **không tự đổi dữ liệu** |
| `PATCH /materials/bulk-classes` | `materials.edit` | Nhận mảng hoặc `{items}` |
| `GET /stock-receipts`, `GET /suppliers`, `GET /materials`, `GET /inventory/balances` | như cũ | Thêm bộ lọc ở trên |

## Quy tắc

- **Chống trùng hóa đơn**: cùng (MST người bán, ký hiệu, số) trên phiếu chưa hủy → 409 kèm `existingReceiptId`, `existingReceiptNo`. Phiếu CANCELLED/đã xóa không tính. Thiếu MST người bán thì lấy MST của NCC.
- **Đồng bộ trường cũ**: có `invoiceNumber` mà `purchaseInvoiceNo` trống → `purchaseInvoiceNo = "<ký hiệu>-<số>"`. Có `invoiceDate` → ngày hóa đơn mua của lô = `invoiceDate`, ngược lại = ngày phiếu.
- **Loại NCC**: SERVICE/EXPENSE → 400 "không phải hàng hóa, không nhập kho" (khi tạo, sửa nháp và xác nhận). OTHER → cho phép, trả cảnh báo. Phiếu không có NCC: như cũ.
- **`kind` ↔ `accountingClass`**: SERVICE ⇒ phải trống (gán RAW_MATERIAL… bị từ chối; đổi kind sang SERVICE tự xóa); STOCK mặc định RAW_MATERIAL; PRODUCT mặc định FINISHED_GOOD. Vật tư cũ đã được migration gán mặc định theo `kind`.
- **Lô theo dự án** khi xuất cho dự án P: lô của P trước (FIFO trong nhóm), rồi lô chung; không bao giờ lấy lô dự án khác. Xuất không gắn dự án: chỉ lô chung. Phân bổ vật tư dự án cũng không đưa lô của dự án khác.
