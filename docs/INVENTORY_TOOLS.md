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

## Controls (khóa kỳ, audit, tài khoản máy)

| API | Quyền | Ghi chú |
|---|---|---|
| `GET /inventory/period-lock` | ADMIN | Ngày khóa hiện tại (`lockedUntil`) + lịch sử `PeriodLockHistory` (100 dòng mới nhất) |
| `PUT /inventory/period-lock` | ADMIN | Body `{lockedUntil: "YYYY-MM-DD" \| ISO \| null, reason (>= 5 ký tự)}`. `null` = mở khóa. Ngày không kèm giờ được chuẩn hóa về cuối ngày UTC. Lùi ngày/mở khóa cũng chỉ ADMIN và bắt buộc `reason`. Setting + lịch sử + audit trong một transaction |
| `GET /audit` (bí danh `/audit-logs`) | ADMIN, MANAGER | Lọc `resource`, `resourceId`, `userId`, `action`, `from`, `to`, `page`, `limit` |
| `POST /api-tokens` | ADMIN | Body `{name, scopes[], expiresAt?}`; trả token dạng rõ (`ahso_sa_…`) **đúng một lần** |
| `GET /api-tokens` | ADMIN | Danh sách, không có hash |
| `DELETE /api-tokens/:id` | ADMIN | Thu hồi (token đã thu hồi dùng lại → 401) |

- **Scope cho phép**: `inventory.read`, `inventory.receipt_draft`, `inventory.alias_write`. Không có scope xác nhận/hủy/duyệt/khóa kỳ/quản lý token.
- **Tài khoản máy**: header `Authorization: Bearer ahso_sa_…`. Principal có role `MACHINE`, `sub = service:<tokenId>`, quyền = các scope + `inventory.view_cost`. **Mặc định bị từ chối (403)** ở mọi endpoint không gắn `@RequireScope('<scope>')` (từ `api-tokens/require-scope.decorator`); controller của PR khác chỉ cần gắn decorator này lên đúng handler đọc/nháp/alias. Không bao giờ gắn lên handler confirm/cancel/approve/lock (có test quét mã nguồn).
- **Audit**: `AuditService.recordEvent({userId, action, resource, resourceId, changes: {before, after, reason, meta}, ip}, tx?)`; `meta.actorType` = `USER` | `SERVICE`; token/secret luôn bị che (`[REDACTED]`). Bảng `AuditLog` bất biến ở tầng DB, mã nguồn không update/delete.
- **MCP server**: đặt `CRM_API_TOKEN=ahso_sa_…` để dùng làm bearer (bỏ qua đăng nhập email/mật khẩu). Không đặt thì giữ nguyên `CRM_EMAIL`/`CRM_PASSWORD`.

## Hóa đơn bán ra, ghi nhận giá vốn, chi phí dự án, phân bổ vật tư dùng chung (INV-E)

Tool MCP trong `mcp-server/src/tools/project-finance.tools.ts`; backend `backend/src/project-finance/`.

| Tool | API | Quyền | Ghi chú |
|---|---|---|---|
| `link_sales_invoice_to_project` | `POST /sales-invoices` | `projects.edit` | `projectId, contractId?, series, number, date, buyerTaxCode?, amountExVat, vatAmount, notes`. Trùng (ký hiệu, số) khi chưa hủy → 409 kèm `existingInvoiceId`. Kiểm tra khóa kỳ theo ngày hóa đơn |
| `list_sales_invoices` | `GET /sales-invoices` | `projects.view` | Lọc `projectId, contractId, status, series, number, dateFrom, dateTo`, phân trang. STAFF chỉ thấy dự án của mình |
| `cancel_sales_invoice` | `POST /sales-invoices/:id/cancel` | `projects.edit` | `reason` ≥ 5 ký tự; `replacedByInvoiceId?` → trạng thái `REPLACED` + ghi liên kết vào `notes`; ngược lại `CANCELLED`. Chặn khi kỳ khóa, hoặc dự án `DELIVERED` mà đây là hóa đơn cuối |
| `recognize_project_cost` | `POST /projects/:id/recognize-cost` | `projects.edit` (+ `inventory.approve` cho REOPEN) | `action = DELIVER \| REOPEN`, `reason`. DELIVER cần ≥ 1 hóa đơn bán `ISSUED` (hoặc ADMIN + `overrideNoInvoice` + lý do); ghi `costRecognizedAt`; chạy lại trả `changed:false`. REOPEN cần lý do ≥ 5 ký tự và kỳ ghi nhận chưa khóa |
| `add_project_cost` | `POST /project-finance/costs` | `projects.edit` | `category` chuỗi tự do → `CostGroup` (gồm `TRAVEL`; không nhận ra → `OTHER`). `projectId` bỏ trống = chi phí chưa gắn dự án |
| `list_project_costs` | `GET /project-finance/costs` | `projects.view` | Lọc `projectId, unassignedOnly, group, dateFrom, dateTo`, phân trang |
| `assign_project_cost` | `PATCH /project-finance/costs/:id/assign` | `projects.edit` | `projectId`. Không chuyển được chi phí thuộc đợt phân bổ |
| `allocate_common_materials` | `POST /project-finance/common-allocations` | `inventory.view_cost` (+ `inventory.approve` cho CONFIRM) | Xem bên dưới |

Cũng có `GET /project-finance/common-allocations` và `GET /project-finance/common-allocations/:id` (danh sách / chi tiết đợt đã xác nhận, cần `inventory.view_cost`).

### Quy tắc

- **DELIVERED đóng băng chi phí**: khi `Project.costRecognitionStatus = DELIVERED`, thêm/sửa/xóa `ProjectCost` (cả `/projects/:id/costs`, `/project-costs/:id` và `/project-finance/costs`) bị từ chối. Hàm dùng chung `assertProjectCostOpen(db, projectId)` trong `project-finance/cost-lock.ts` (stock-issues dùng cùng hàm/trạng thái khi hủy phiếu xuất).
- **Khóa kỳ**: tạo/hủy hóa đơn bán (theo ngày hóa đơn), thêm chi phí (theo ngày chứng từ), ghi nhận/mở lại giá vốn, xác nhận phân bổ (theo ngày cuối kỳ) đều qua `assertPeriodOpen`.
- **Phân bổ vật tư dùng chung**: tổng = Σ thành tiền dòng phiếu xuất `CONFIRMED`, **không gắn dự án**, vật tư `accountingClass = CONSUMABLE_COMMON`, ngày trong `[periodFrom, periodTo]`. Chia cho dự án `costRecognitionStatus = IN_PROGRESS`, chưa `LOST`, đang hoạt động trong kỳ, theo cơ sở: `REVENUE` (Σ hóa đơn bán `ISSUED` chưa VAT trong kỳ), `DIRECT_COST` (Σ phiếu xuất dự án + chi phí trực tiếp trong kỳ) hoặc `MANUAL` (`manualShares`). Làm tròn phần dư lớn nhất bằng số nguyên: Σ các dòng = tổng đúng từng đồng.
- `PREVIEW` không ghi gì. `CONFIRM` ghi `CommonCostAllocation` + dòng + một `ProjectCost` (nhóm `OTHER`) mỗi dự án trong một transaction và audit. Cùng kỳ xác nhận lần hai → trả đợt cũ (`idempotent: true`); kỳ giao nhau nhưng khác → 409.

## Giá xuất, cấu hình phương pháp, hủy phiếu xuất có đảo (INV-C)

### Tool

| Tool | API | Quyền | Ghi chú |
|---|---|---|---|
| `get_costing_config` (mới) | `GET /inventory/costing-config` | `inventory.view` | Phương pháp hiện hành (`AVERAGE`/`FIFO`) + lịch sử (người đổi, ngày hiệu lực, lý do) |
| `set_costing_config` (mới) | `PUT /inventory/costing-config` | chỉ ADMIN | `method`, `effectiveFrom` (01/01 của năm SAU năm hiện tại trở đi), `reason` >= 5 ký tự. Đổi giữa năm → 400 |
| `cancel_stock_issue` (mở rộng) | `POST /stock-issues/:id/cancel` | `inventory.edit` (nháp); thêm `inventory.approve` (đã xác nhận) | Tham số mới tùy chọn `reason` (bắt buộc >= 5 ký tự với phiếu đã xác nhận). Không có `reason` + phiếu nháp = như cũ |
| `create_stock_issue` (mở rộng) | `POST /stock-issues` | `inventory.create` | `items[].unitPrice` giờ **tùy chọn** (nên bỏ); `reasonType` tùy chọn: `PROJECT`/`INTERNAL_USE`/`WARRANTY`/`LOSS_DAMAGE`/`SAMPLE`/`OTHER` (mặc định `PROJECT` nếu có `projectId`, ngược lại `OTHER`; chỉ `PROJECT` bắt buộc dự án). Trả thêm `warnings[]` |
| `confirm_stock_issue` (mở rộng đầu ra) | `POST /stock-issues/:id/confirm` | `inventory.approve` | Trả thêm `costingMethod`, `totalAmount`, `warnings[]`, `items[]` (giá + các lô đã trừ) |

### Quy tắc giá xuất

- Phương pháp theo ngày phiếu: bản ghi `InventoryCostingConfig` mới nhất có `effectiveFrom` <= ngày phiếu; chưa có bản ghi = `AVERAGE`.
- **Giá xuất luôn do hệ thống tính khi xác nhận**. `AVERAGE`: `Material.costPrice` lúc xác nhận (xuất không làm đổi `costPrice`), thành tiền = SL x `costPrice` làm tròn 0. `FIFO`: thành tiền = Σ SL lô x giá lô, đơn giá = thành tiền / SL.
- Mọi phiếu (cả `AVERAGE`) trừ lô theo FIFO và ghi `StockIssueLotConsumption` {lô, SL, giá lô, `invoiceDateWarning`}. Phiếu do đợt phân bổ tạo ghi đúng lô đã chọn; dòng phân bổ + phiếu xuất tính theo `costPrice` khi `AVERAGE`.
- `unitPrice` do client truyền: `IGNORE_WARN` (mặc định) bỏ qua, trả `warnings[]`; `BLOCK` (`inventory.manualIssuePriceMode`) từ chối 400. Phiếu nháp chỉ lưu giá ước tính = `costPrice` hiện tại.
- Ngày hóa đơn bán = ngày của đợt phân bổ (nếu phiếu thuộc đợt) → `Project.salesInvoiceDate` → trống thì bỏ qua kiểm tra. Lô có ngày hóa đơn mua sau ngày đó: `AVERAGE` cảnh báo + cờ trên dòng lô; `FIFO` chặn.

### Hủy phiếu xuất đã xác nhận

- Idempotent: hủy lần hai trả trạng thái hiện có (`alreadyCancelled: true`), không hoàn tồn thêm; hai request song song chỉ một request hoàn.
- Chặn (400, kèm hướng dẫn lập phiếu hoàn kho ở kỳ hiện tại): kỳ chứa phiếu đã khóa sổ; dự án `DELIVERED`; thiếu dữ liệu lô của dòng nào đó.
- Đảo trong một transaction (khóa dòng phiếu + vật tư + lô): cộng lại đúng lô (không vượt SL nhập), `adjustBalance +SL`, tính lại `costPrice` bình quân di động, sinh phiếu nhập `RETURN_FROM_PROJECT` (đã `CONFIRMED`, `returnedFromIssueId`, ngày = ngày hủy, kèm lý do), phiếu xuất → `CANCELLED` + `cancelledAt/By/Reason`, ghi audit trước/sau.
- `AVERAGE`: SL hoàn nhập lại vào bình quân ở giá xuất gốc (ví dụ xuất 5 @120k, nhập thêm 5 @180k → `costPrice` 135k, hủy → (20x135k + 5x120k)/25 = 132k). `FIFO`: lô được trả đúng SL/giá lô; `costPrice` giữ nguyên (xuất FIFO không làm đổi `costPrice`).

## API báo cáo kho (INV-D) — chỉ đọc

Mọi endpoint `GET /api/inventory/reports/*` (và tool MCP tương ứng) trả cùng một hợp đồng JSON, **không có tác dụng phụ**:

```
{ "meta": { generatedAt, asOfDate | period:{from,to}, costMethod, periodLockedUntil, costVisible, filters, schemaVersion:"1.0", ...riêng từng báo cáo },
  "data": [ ... ],
  "page": { page, limit, total, totalPages } }
```

- Phân trang: `page` (mặc định 1), `limit` (mặc định **100**, tối đa **500**). Số tiền = số nguyên VND, số lượng = số thập phân tối đa 3 chữ số, ngày = ISO 8601.
- Quyền: người dùng cần `inventory.view`; tài khoản máy cần scope `inventory.read` (`@RequireScope`). Người không có `inventory.view_cost` nhận mọi trường giá/giá trị là `null` (`meta.costVisible = false`); tài khoản máy mặc định có `inventory.view_cost`.
- `costMethod` tính theo ngày báo cáo (`asOfDate`, hoặc cuối kỳ).

| Tool MCP | Endpoint | Tham số (đều tùy chọn trừ ghi chú) | Nội dung |
|---|---|---|---|
| `get_stock_ledger` | `/stock-ledger` | `fromDate`, `toDate` (**bắt buộc**), `materialId`, `warehouseId` | Thẻ kho: dòng nhập/xuất/chuyển/kiểm kê đã xác nhận; mỗi dòng có `qtyIn/qtyOut`, `unitPrice`, `amount`, `balanceQty/balanceValue`, số chứng từ, hóa đơn (`sellerTaxCode`, `invoiceSeries`, `invoiceNumber`, `invoiceDate`, `supplier`) và `sourceReceiptLotId` (dòng xuất có đúng 1 lô; nhiều lô → `null`, xem `sources[]`). `meta.accounts[]` = tồn đầu/cuối kỳ (SL + giá trị) từng vật tư/kho. Phiếu xuất đã hủy hiện hai dòng (`ISSUE` tại ngày phiếu, `ISSUE_REVERSAL` tại ngày hủy) |
| `get_inventory_valuation` | `/inventory-valuation` | `asOfDate`, `groupBy` (`none`/`accountingClass`/`warehouse`), `accountingClass` (hoặc `UNCLASSIFIED`), `warehouseId`, `materialId` | Giá trị tồn. `meta.totals.totalValue`; `meta.valuationMethod` = `LIVE_COST_PRICE` hoặc `REPLAY_MOVING_AVERAGE`; `meta.warnings[]` |
| `get_project_cost` | `/project-cost` | `projectId`, `fromDate`, `toDate`, `includeLines` (mặc định true khi có `projectId`) | Mỗi dự án: `materialCost` (Σ phiếu xuất CONFIRMED có dự án, giá xuất đã ghi), `returnedCost` (phiếu hoàn kho), `netMaterialCost`, `directCost` + `directCostByGroup` (CostGroup), `totalCost`; dòng chi tiết kèm hóa đơn nguồn từng lô và cờ cảnh báo ngày hóa đơn |
| `list_unallocated_receipts` | `/unallocated-receipts` | `fromDate`, `toDate`, `warehouseId`, `supplierId`, `materialId`, `includeCommon` | Dòng nhập `PURCHASE` đã xác nhận, không gắn dự án, lô còn tồn; mặc định bỏ `CONSUMABLE_COMMON` |
| `get_receipts_without_invoice` | `/receipts-without-invoice` | `mode` (`NUMBER` mặc định / `ANY_FIELD`), `fromDate`, `toDate`, `warehouseId`, `supplierId` | Phiếu nhập `PURCHASE` đã xác nhận còn thiếu hóa đơn, kèm `missingFields[]`. `meta.missingCount`, `meta.gatePassed` (= true khi 0) — dùng làm cổng trước khi xuất kho |
| `get_invoice_date_warnings` | `/invoice-date-warnings` | `fromDate`, `toDate`, `projectId`, `materialId`, `warehouseId`, `includeCancelled` | Dòng `StockIssueLotConsumption.invoiceDateWarning = true`: ngày hóa đơn lô, ngày hóa đơn bán (hoặc ngày phiếu xuất), `daysPurchaseAfterSale` |

**Bí danh** (cùng handler, hành vi y hệt tool PR 1): `update_receipt_invoice_info` = `update_receipt_invoice`; `bulk_update_receipt_invoice_info` = `bulk_set_receipt_invoices`.

### Quy tắc & phương pháp

- **Giá trị tồn hôm nay** = Σ(SL tồn × `Material.costPrice`), làm tròn **một lần** ở cuối — cùng công thức `get_inventory_summary` nên `meta.totals.totalValue` bằng `totalValue` của summary (khi không lọc). Giá trị từng dòng làm tròn riêng nên tổng dòng có thể lệch vài đồng so với tổng.
- **Giá trị tồn ngày quá khứ**: dựng lại sổ từ chứng từ đã xác nhận có ngày chứng từ ≤ `asOfDate`, thứ tự (ngày chứng từ, giờ xác nhận), bình quân gia quyền di động y công thức `updateAverageCostPrice` (nhập và hoàn kho do hủy phiếu xuất cập nhật giá; xuất/chuyển/kiểm kê chỉ đổi số lượng). Dựng lại tiếp đến hiện tại rồi so với tồn × `costPrice` hiện hành: `meta.reconciliationDiff` ≠ 0 nghĩa là số quá khứ chỉ để tham khảo (kèm cảnh báo).
- Phiếu nhập hoàn kho tự sinh khi hủy phiếu xuất không đếm hai lần: sổ chỉ hiện dòng đảo của phiếu xuất đã hủy.
- Giá vốn dự án dùng **giá xuất đã ghi** trên phiếu (`AVERAGE`: `costPrice` lúc xuất) nên khớp với giá trị tồn; phiếu xuất `CANCELLED` không tính. `meta.totals` của `get_project_cost` chỉ cộng các dự án trong trang hiện tại (`totalsScope: "page"`).
- `sellerTaxCode` lấy trên phiếu nhập, thiếu thì lấy MST nhà cung cấp.
- Truy vấn dùng chỉ mục `materialId`, `status`, `projectId`, `invoiceDateWarning`; thẻ kho và định giá quá khứ nạp chứng từ đã xác nhận của vật tư trong phạm vi lọc (nên truyền `materialId` khi dữ liệu lớn).

---

# Nhập kho tự động từ hóa đơn (PR 3 / INV-B)

> Tool ở `mcp-server/src/tools/inventory-intake.tools.ts`, API ở `backend/src/invoice-intake/`. **Không tool nào xác nhận phiếu**: phiếu tạo từ `EMAIL_AUTO`/`IMPORT` luôn là NHÁP + `PENDING_REVIEW`.

## Tool MCP

| Tool | Tham số chính | Ghi chú |
|---|---|---|
| `match_invoice_line` | `supplierId` hoặc `supplierTaxCode`, `itemName`, `itemCode?`, `unit?` | Khớp alias theo mã rồi theo tên chuẩn hóa; không khớp chỉ trả `candidates` (tối đa 10, điểm 0–1), **không bao giờ tự chấp nhận** |
| `save_material_alias` | NCC, `supplierItemName`, `materialId`, `supplierItemCode?`, `supplierUnit?`, `unitConversion?` | Upsert (không trùng): duy nhất theo (NCC, mã) hoặc (NCC, tên chuẩn hóa) khi không có mã. Ghi audit |
| `list_pending_invoice_lines` | `status?` (mặc định PENDING), `supplierId?`, `receiptId?`, `projectId?`, `page?`, `limit?` | Dòng chưa ghép, chưa tạo tồn |
| `resolve_pending_invoice_line` | `lineId`, `materialId`, `saveAlias?` (mặc định true), `unitConversion?` | Tạo dòng phiếu thật trên phiếu NHÁP, đánh dấu RESOLVED |
| `discard_pending_invoice_line` | `lineId`, `reason` | Bỏ dòng, bắt buộc lý do |
| `create_stock_receipt_from_invoice` | Header: `sellerTaxCode`, `series`, `number`, `date`, `source`, `invoiceType?`, `relatedInvoiceRef?`, `vatTotal?`, `totalDeclared?`, `supplierId?`, `warehouseId?`… + `lines[]` | Xem quy tắc bên dưới |
| `list_pending_review_receipts` | `source?`, `supplierId?`, `page?`, `limit?` | Phiếu `PENDING_REVIEW` + số dòng chờ ghép, tổng tiền, `roundingDiff` |
| `review_stock_receipt` | `receiptId`, `note?` | Cần `inventory.approve`; **tài khoản máy bị từ chối** |

`lines[]`: `lineNo`, `name`, `qty`, `unitPrice` (**chưa VAT**), `code?`, `unit?`, `vatRate?`, `vatAmount?`, `lineKind` (GOODS mặc định / SERVICE / EXPENSE), `materialId?`, `projectId?`, `costGroup?` (gồm `TRAVEL`).

## Quy tắc `create_stock_receipt_from_invoice`

- **Chống trùng** theo (MST người bán, ký hiệu, số): gọi lại trả phiếu cũ `alreadyExists: true` (HTTP 200), không tạo/sửa gì; đồng thời cũng an toàn (khóa advisory + unique index `StockReceipt_invoice_active_key`, bắt P2002). Phiếu CANCELLED không chặn gửi lại. Hóa đơn chỉ gồm chi phí cũng idempotent.
- **Hóa đơn bán ra của AHSO** (MST người bán = `company.taxCode`, mặc định 0316896939, bỏ qua dấu cách/hậu tố chi nhánh) → `{ skipped: "SALES_INVOICE" }`, **không ghi gì**.
- **NCC** tìm theo `supplierId` hoặc MST; chưa có NCC → 422, **không tự tạo**.
- **Dòng GOODS**: khớp alias (hoặc `materialId` truyền sẵn) → `StockReceiptItem` (áp `unitConversion`); không khớp → `ReceiptPendingLine`. Phiếu còn dòng chờ ghép **không xác nhận được**.
- **Dòng SERVICE/EXPENSE** (hoặc NCC loại Dịch vụ/Chi phí, hoặc vật tư `kind=SERVICE`) → **không tạo tồn**, tạo `ProjectCost` (`projectId` có thể trống, đủ trường hóa đơn, `receiptId`, `source`, `reviewStatus=PENDING_REVIEW`). Hóa đơn toàn chi phí → không tạo phiếu (`receiptId: null`, có `expenseLineIds`).
- **Thay thế/điều chỉnh** (`invoiceType` ≠ PURCHASE, cần `relatedInvoiceRef` = "ký hiệu-số" / số phiếu / ID phiếu gốc): phiếu gốc phải CONFIRMED (nháp → từ chối, hướng dẫn sửa/hủy gốc). Tạo phiếu `receiptType=ADJUSTMENT` + `adjustsReceiptId`, chênh lệch tính trên trạng thái hiệu lực (gốc + các điều chỉnh trước): SL khác → dòng SL có dấu (âm = trả NCC); chỉ khác giá → dòng `valueAdjustment` (không đổi tồn). `REPLACEMENT` coi hóa đơn mới là toàn bộ (vật tư thiếu bị giảm hết); `ADJUSTMENT` chỉ chạm vật tư có trong hóa đơn. Dòng chưa ghép được → 422 (lưu alias rồi gửi lại). Không có chênh lệch → `noDifference: true`, không tạo phiếu. Khi xác nhận điều chỉnh có tồn = 0 cho dòng chỉ-giá: bỏ qua kèm cảnh báo (đặc tả §11.2).
- **Tiền**: đơn giá lưu **chưa VAT**, VAT tách riêng (`vatTotal`, `vatRate/vatAmount` từng dòng). `roundingDiff = totalDeclared − (Σ dòng đã lưu gồm dòng chờ ghép + chi phí + vatTotal)`, lưu trên phiếu; lệch > 1.000 đ chỉ cảnh báo. Không chỉnh đơn giá cho khớp. Quy đổi đơn vị làm tròn đơn giá 0 chữ số, chênh lệch rơi vào `roundingDiff`. **Không bao giờ đổi `Material.costPrice` khi tạo/ghép/duyệt nháp** (chỉ khi xác nhận).
- **Khóa kỳ**: ngày phiếu/ngày hóa đơn (lấy ngày nhỏ hơn) ≤ `periodLockedUntil` → từ chối.

## API backend

| Route | Quyền / scope máy | Mô tả |
|---|---|---|
| `POST /invoice-intake/match-line` | `inventory.view` / `inventory.read` | Ghép dòng |
| `POST /invoice-intake/aliases` | `inventory.edit` / `inventory.alias_write` | Lưu alias |
| `GET /invoice-intake/pending-lines` | `inventory.view` / `inventory.read` | Danh sách + phân trang `{data, meta}` |
| `POST /invoice-intake/pending-lines/:id/resolve` · `/discard` | `inventory.edit` / `inventory.receipt_draft` | Xử lý dòng chờ |
| `POST /invoice-intake/receipts` | `inventory.create` / `inventory.receipt_draft` | Tạo phiếu từ hóa đơn |
| `GET /invoice-intake/receipts/pending-review` | `inventory.view` / `inventory.read` | Phiếu chờ duyệt |
| `POST /stock-receipts/:id/review` | `inventory.approve` (không có scope máy) | Duyệt → `REVIEWED`, ghi `reviewedBy/At` + audit |

## Thay đổi ở luồng phiếu nhập hiện có

- `POST /stock-receipts/:id/confirm` và `/cancel`: cần `inventory.approve` (controller **và** service), gọi `assertPeriodOpen`; ghi audit.
- Xác nhận bị từ chối (400) khi: `reviewStatus=PENDING_REVIEW`; còn dòng chờ ghép (liệt kê dòng); phiếu PURCHASE/ADJUSTMENT thiếu thông tin hóa đơn; kỳ đã khóa.
- Xác nhận phiếu `ADJUSTMENT`: SL > 0 như dòng nhập thường; SL < 0 cần đủ tồn, giảm lô FIFO; dòng `valueAdjustment` chỉnh `costPrice = (tồn × costPrice + Δ) / tồn`.
- Hủy phiếu nháp: các dòng chi phí sinh từ phiếu đó bị xóa mềm (để hóa đơn gửi lại được).
