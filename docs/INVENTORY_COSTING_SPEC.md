# Kho & kế toán giá vốn theo dự án — Đặc tả triển khai

> Nguồn yêu cầu: yêu cầu nâng cấp của Henry (20/11/2026). Tài liệu này = **đối chiếu với code hiện tại + quyết định thiết kế + chia PR**.
> Đọc kèm `CLAUDE.md`, `docs/BOM_SPEC.md` (đã có ProjectCost, đợt phân bổ, cost-summary), `docs/GLOSSARY_VI.md`.
> Dữ liệu production (62 phiếu nhập, 119 vật tư, 58 NCC, 1 kho): **mọi migration chỉ thêm cột nullable/có default, không backfill phá dữ liệu cũ**.

## 0. Quyết định đã chốt (Henry, 20/11/2026 — gồm bản bổ sung)

**Giá xuất (phương án 1)**: cấu hình toàn công ty, mặc định **bình quân gia quyền di động** (`AVERAGE`), đổi được sang `FIFO`.
1. `Material.costPrice` (bình quân di động) là **nguồn duy nhất** cho giá trị tồn và giá vốn: `get_inventory_valuation`, `get_inventory_summary`, `get_project_cost` dùng chung số này → luôn khớp.
2. Lô nhập vẫn giữ để **truy vết số hóa đơn nguồn**. Báo cáo theo lô ghi rõ "chỉ để tham khảo, không dùng để tính giá vốn" khi cấu hình là `AVERAGE`.
3. Quy tắc "ngày hóa đơn mua ≤ ngày hóa đơn bán": với `AVERAGE` chỉ **cảnh báo, không chặn** (trả `warnings[]` khi xác nhận phiếu xuất, lưu lại, có báo cáo liệt kê); với `FIFO` **áp cứng** (chặn).
4. Phương pháp **khóa theo năm tài chính**: chỉ đổi được cho năm tài chính **sau**, không đổi giữa kỳ; lưu lịch sử (người đổi, ngày hiệu lực, lý do). Từ chối kèm lý do nếu đổi giữa năm.
5. Giá xuất tự tính khi không truyền `unitPrice`. Nếu client truyền tay: theo cấu hình `manualIssuePriceMode` = `IGNORE_WARN` (mặc định: bỏ qua giá truyền, ghi cảnh báo) hoặc `BLOCK` (từ chối). Luồng nội bộ (phiếu do đợt phân bổ tạo) không bị ảnh hưởng.

**Phân loại kế toán vật tư (phương án 1)**: thêm **`accountingClass`**, giữ nguyên `kind` (STOCK/SERVICE/PRODUCT) và code BOM.
1. Giá trị: `RAW_MATERIAL` (TK152, mặc định), `TOOL` (153), `MERCHANDISE` (156), `FINISHED_GOOD` (155), `CONSUMABLE_COMMON` (vật tư phụ, phân bổ cuối kỳ).
2. Ràng buộc với `kind`: `SERVICE` → `accountingClass` **null** (không qua kho); `PRODUCT` → mặc định `FINISHED_GOOD`; `STOCK` → mặc định `RAW_MATERIAL`, cho đổi. Service chặn tổ hợp sai (ví dụ SERVICE + RAW_MATERIAL; đổi `kind` sang SERVICE thì xóa `accountingClass`).
3. Migration **gán mặc định cho dữ liệu cũ** (STOCK → RAW_MATERIAL, PRODUCT → FINISHED_GOOD, SERVICE → null) bằng `UPDATE` trong migration; kèm tool cập nhật hàng loạt `bulk_update_material_classes` để kế toán chỉnh.
4. Báo cáo giá trị tồn **nhóm theo `accountingClass`**, không theo `kind`.
5. `create_material`, `update_material`, `list_materials` nhận và lọc theo `accountingClass`; mô tả tool/tài liệu ghi rõ: `kind` = có qua kho hay không, `accountingClass` = hạch toán tài khoản nào. Mọi chỗ `materialKind` trong yêu cầu gốc = `accountingClass`.

**Hủy phiếu xuất đã xác nhận (phương án 1)**: thêm bảng **`StockIssueLotConsumption`** (mỗi dòng xuất ghi lô đã trừ, số lượng, giá tại thời điểm xuất); phiếu xuất mới **bắt buộc** ghi bảng này khi xác nhận.
1. Hủy cần `reason` bắt buộc, audit (ai, lúc nào, trước/sau), **không xóa phiếu** mà chuyển `CANCELLED`, sinh **bút toán đảo**: hoàn tồn **đúng lô, đúng giá lúc xuất**, rồi **tính lại `costPrice`** (coi phần hoàn như một lần nhập ở giá xuất gốc, theo công thức bình quân di động).
2. **Chặn hủy** (yêu cầu tạo **phiếu điều chỉnh ở kỳ hiện tại** thay vì hủy): (a) kỳ chứa phiếu đã khóa sổ; (b) dự án của phiếu đã `DELIVERED` (giá vốn đã ghi nhận 632); (c) phiếu thiếu dữ liệu lô (phiếu cũ). "Phiếu điều chỉnh" = phiếu hoàn kho `RETURN_FROM_PROJECT` (hoặc phiếu xuất bổ sung) lập ở kỳ hiện tại.
3. Hủy **idempotent**: hủy lần hai không hoàn tồn lần nữa (trả lỗi/kết quả cũ, không đổi số liệu).
4. Phiếu cũ trước khi có bảng này: hiện chưa có phiếu nào; sau này nếu có phiếu thiếu lô → chặn hủy trực tiếp, hướng dẫn phiếu điều chỉnh.

**Khóa sổ**: xem §7.2 (bổ sung số 2) — cấu hình **`periodLockedUntil`** thay cho `periodLockedUntil` ở các chỗ cũ.

**Nghiệm thu bổ sung**: (1) tổng `get_inventory_valuation(asOfDate)` = tổng `get_inventory_summary`; (2) với `AVERAGE`, `get_project_cost` và `get_inventory_valuation` dùng cùng `costPrice`; (3) có cảnh báo khi hóa đơn mua đứng sau ngày hóa đơn bán; (4) đổi phương pháp giữa năm bị từ chối kèm lý do; (5) tool MCP cũ chạy như trước, tham số mới đều tùy chọn.

## 1. Đối chiếu với code hiện tại (phải đọc trước khi sửa)

| Yêu cầu | Hiện trạng | Hướng xử lý |
|---|---|---|
| Số hóa đơn trên phiếu nhập | `StockReceipt.purchaseInvoiceNo` (chuỗi tự do) + `date` (= ngày hóa đơn mua, lô dùng làm `purchaseInvoiceDate`) | Thêm trường có cấu trúc; **giữ** `purchaseInvoiceNo`/`date` cũ (đồng bộ, xem §2.1) |
| MST nhà cung cấp | `Supplier.taxCode` **đã có** | Chỉ thêm `supplierType` |
| Phân loại vật tư | `Material.kind` (STOCK/SERVICE/PRODUCT) đã có | Thêm `accountingClass` nullable + ràng buộc với `kind` + backfill (§0) |
| Chi phí trực tiếp dự án | `ProjectCost` **đã có** (nhóm `CostGroup`, số/ngày hóa đơn, gắn đợt phân bổ), API `/projects/:id/costs` | **Mở rộng, không tạo bảng mới**: thêm `TRAVEL` vào `CostGroup`; tool `add_project_cost`/`list_project_costs` gọi API này, `category` = `CostGroup` |
| Giá vốn dự án / lãi gộp | `CostReportsService.getCostSummary` (vật tư tính từ **đợt phân bổ**) | `get_project_cost` dùng lại; **đổi nguồn giá vốn vật tư thành phiếu xuất đã xác nhận có `projectId` (đã gồm phiếu do đợt phân bổ tạo) trừ phiếu hoàn kho** để không tính trùng (§2.4) |
| Giá xuất | `StockIssueItem.unitPrice` **bắt buộc nhập tay**; `Material.costPrice` = bình quân di động, cập nhật khi nhập (`updateAverageCostPrice`) | `unitPrice` thành tùy chọn; tự tính khi xác nhận theo cấu hình (§2.3) |
| Trừ lô | `consumeStockLots` trừ FIFO nhưng **không lưu đã trừ lô nào** | Thêm `StockIssueLot` (§2.3) — điều kiện để hủy có đảo và truy vết số hóa đơn |
| Lý do xuất | `StockIssue.reason` chuỗi tự do 500 ký tự | Giữ `reason` làm ghi chú; thêm `reasonType` enum |
| Hủy phiếu xuất đã xác nhận | Hiện **không có** reversal sau CONFIRMED | Làm mới (§2.3) |
| Hóa đơn bán ra | `ProjectMaterialAllocation.salesInvoiceNo/Date` (một số), chưa có danh sách | Thêm `SalesInvoice` (§2.6) |
| Audit log | `AuditService.record(...)` + `AuditInterceptor` có sẵn | Ghi thêm trong service kho/giá (§2.8) |
| MCP | `mcp-server/src/tools/inventory.tools.ts` (tool kho cơ bản) | Mở rộng tool + thêm tool mới, giữ nguyên hành vi cũ, thêm tham số tùy chọn |

## 2. Thiết kế

### 2.1 P0-1 Hóa đơn trên phiếu nhập
- Cột mới trên `StockReceipt` (nullable, trừ `invoiceType` default `NORMAL`): `invoiceSeries`, `invoiceNumber`, `invoiceDate`, `sellerTaxCode`, `invoiceFileRef`, `invoiceLookupCode`, `invoiceType` (enum `InvoiceType`: NORMAL/REPLACEMENT/ADJUSTMENT), `relatedInvoiceRef`.
- **Chống trùng**: unique index *một phần* (Prisma không biểu diễn được → viết SQL thô trong migration, như migration `20260604093000`):
  `CREATE UNIQUE INDEX ... ON "StockReceipt"("sellerTaxCode","invoiceSeries","invoiceNumber") WHERE "sellerTaxCode" IS NOT NULL AND "invoiceSeries" IS NOT NULL AND "invoiceNumber" IS NOT NULL AND "status" <> 'CANCELLED' AND "deletedAt" IS NULL;`
  Service kiểm tra trước để trả **409** `{ message, existingReceiptId, existingReceiptNo }`; vẫn bắt lỗi unique của DB (race) và trả cùng định dạng.
- Đồng bộ với trường cũ: nếu có `invoiceNumber` mà `purchaseInvoiceNo` trống → `purchaseInvoiceNo = "<series>-<number>"`. Nếu có `invoiceDate` → ngày hóa đơn của **lô** (`StockLot.purchaseInvoiceDate`) = `invoiceDate`, ngược lại = `date` như hiện nay.
- **Bổ sung hóa đơn cho phiếu cũ** (nghiệm thu #2): `PATCH /stock-receipts/:id/invoice` chỉ sửa thông tin hóa đơn của phiếu **kể cả đã CONFIRMED** (không đụng dòng hàng/số lượng/giá); `POST /stock-receipts/invoices/bulk` nhận mảng, trả kết quả từng dòng (cập nhật / trùng / không tìm thấy), không dừng cả lô khi một dòng lỗi. Nếu đổi `invoiceDate` của phiếu đã xác nhận → cập nhật `purchaseInvoiceDate` của các lô **chưa bị tiêu hao** và từ chối nếu lô đã tiêu hao một phần (báo rõ).
- API/tool: `create_stock_receipt`, `get_stock_receipt_detail`, `list_stock_receipts` (lọc `invoiceNumber`, `invoiceSeries`, `sellerTaxCode`, `invoiceDateFrom/To`, `hasInvoice`), tool mới `find_receipt_by_invoice`, `update_receipt_invoice`, `bulk_set_receipt_invoices`.

### 2.2 P0-2 / P0-3 Phân loại & hàng đặt riêng cho dự án
- `Supplier.supplierType` enum `SupplierType` {GOODS, SERVICE, EXPENSE, OTHER} default GOODS. Tool/API tạo/sửa/list nhận và lọc. `PATCH /suppliers/bulk-type` nhận `[{supplierId, supplierType}]`, trả kết quả từng dòng. **58 NCC cũ đều là GOODS cho tới khi Henry phân loại** — nên làm thêm danh sách gợi ý (tên chứa Grab/xăng/nhà hàng/VNPT…) trong báo cáo cuối **chỉ để Henry duyệt, không tự đổi**.
- Chặn nhập kho: tạo/xác nhận phiếu nhập có NCC `SERVICE` hoặc `EXPENSE` → 400 "Nhà cung cấp loại … không phải hàng hóa, không nhập kho". `OTHER` → cho phép kèm cảnh báo trong response. Phiếu không có NCC: như cũ.
- `Material.accountingClass` enum `AccountingClass` (nullable; giá trị và ràng buộc với `kind` ở §0). Migration `UPDATE` gán mặc định cho dữ liệu cũ. API/tool/list nhận và lọc; tool mới `bulk_update_material_classes` (mảng `[{materialId, accountingClass}]`, trả kết quả từng dòng, vi phạm ràng buộc `kind` thì báo lỗi dòng đó).
- `StockReceiptItem.projectId` nullable (FK `Project`), sao chép xuống `StockLot.projectId` khi xác nhận. `get_inventory_balances` thêm tham số `projectId`: trả tồn **thuộc lô gắn dự án đó** (tổng `remainingQuantity` của lô).
- Quy tắc chọn lô khi xuất cho dự án P: hợp lệ = lô `projectId = P` **hoặc** `projectId IS NULL`; ưu tiên lô của P trước (FIFO trong nhóm), rồi tới lô chung; **không bao giờ** lấy lô gắn dự án khác. Xuất không gắn dự án: chỉ lô chung.

### 2.3 P1-4 Xuất kho & giá xuất
- **Cấu hình** (bảng `Setting` + bảng lịch sử mới `InventoryCostingConfig` {id, method, effectiveFrom (đầu năm tài chính), changedById, reason, createdAt}):
  - `method` hiệu lực cho một chứng từ = bản ghi có `effectiveFrom` ≤ ngày chứng từ, mới nhất. Chưa có bản ghi nào → `AVERAGE` từ trước đến nay.
  - Năm tài chính: dương lịch (1/1–31/12), khóa `inventory.fiscalYearStartMonth` mặc định 1.
  - `PUT /inventory/costing-method` (ADMIN): `effectiveFrom` **phải là đầu năm tài chính sau năm hiện tại** (hoặc xa hơn); lần cấu hình đầu tiên (chưa có lịch sử) cho phép đặt `effectiveFrom` = đầu năm hiện tại. Đổi giữa năm → 400 "Chỉ được đổi phương pháp tính giá từ năm tài chính <năm>". `GET` trả cấu hình hiệu lực + lịch sử.
  - Khóa `inventory.manualIssuePriceMode` ∈ {`IGNORE_WARN` (mặc định), `BLOCK`}; `periodLockedUntil` (ngày khóa sổ, ADMIN, có audit).
- `StockIssueItem.unitPrice` tùy chọn. Khi **xác nhận** (method theo ngày phiếu):
  - `AVERAGE`: giá xuất = `Material.costPrice` lúc xác nhận; thành tiền = SL × costPrice (làm tròn 0 chữ số như hiện nay). Lô vẫn bị trừ theo FIFO **để truy vết**, **ngày hóa đơn mua > ngày hóa đơn bán chỉ cảnh báo**.
  - `FIFO`: giá xuất theo lô đã trừ (Σ SL lô × giá lô / SL), **áp cứng** ngày hóa đơn mua ≤ ngày hóa đơn bán.
  - "Ngày hóa đơn bán" = `ProjectMaterialAllocation.salesInvoiceDate` nếu phiếu thuộc đợt phân bổ; nếu không thì `Project.salesInvoiceDate`; nếu cả hai trống thì **bỏ qua kiểm tra** (không có căn cứ).
  - Client truyền `unitPrice` tay: `IGNORE_WARN` → bỏ qua giá, thêm vào `warnings[]` "Đã bỏ qua đơn giá nhập tay…"; `BLOCK` → 400. Phiếu do đợt phân bổ tạo là luồng nội bộ, không áp dụng.
  - **Đợt phân bổ hiện có** (`confirmMaterialAllocation`): khi `AVERAGE`, `ProjectMaterialAllocationItem.unitPrice/total` và phiếu xuất sinh ra dùng `costPrice` (vẫn giữ `stockLotId` để truy vết); khi `FIFO` giữ nguyên như hiện nay. Các chỗ đọc giá phân bổ (cost-summary, cost-sheet) phải theo.
- **`StockIssueLotConsumption`** {id, issueItemId, stockLotId, quantity, lotUnitPrice, invoiceDateWarning boolean}: ghi khi xác nhận (mọi phiếu, kể cả do đợt phân bổ tạo). `consumeStockLots` **trả về** danh sách lô đã trừ, giữ nguyên hành vi trừ. Cờ `invoiceDateWarning` bật khi lô có ngày hóa đơn mua sau ngày hóa đơn bán; xác nhận trả `warnings[]`; báo cáo `get_invoice_date_warnings(fromDate?, toDate?, projectId?)` liệt kê.
- `StockIssue.reasonType` enum `IssueReasonType` {PROJECT, INTERNAL_USE, WARRANTY, LOSS_DAMAGE, SAMPLE, OTHER}: tạo mới không truyền thì suy ra `PROJECT` nếu có `projectId`, ngược lại `OTHER`; `PROJECT` bắt buộc `projectId`. Phiếu cũ null. `reason` giữ làm ghi chú.
- **Chặn xuất âm** đã có (`ensureSufficientStock`), giữ; thông báo có "Tồn kho: x".
- **Hủy phiếu xuất đã xác nhận** (`POST /stock-issues/:id/cancel`, DRAFT như cũ). CONFIRMED: `reason` ≥ 5 ký tự; kiểm tra theo thứ tự (khóa sổ → dự án `DELIVERED` → có đủ `StockIssueLotConsumption` → chưa hủy); trong một transaction khóa dòng phiếu: cộng `remainingQuantity` đúng lô (không vượt `receivedQuantity`), `adjustBalance +qty`, rồi **tính lại `costPrice`** bằng `updateAverageCostPrice(qty hoàn, giá xuất gốc)`; đặt `status=CANCELLED`, `cancelledAt`, `cancelReason`, `cancelledById`; audit trước/sau. Hủy lần hai → trả kết quả hiện có, không đổi dữ liệu (kiểm tra trạng thái trong transaction + điều kiện `updateMany where status=CONFIRMED`). Phiếu CONFIRMED không sửa được dòng (thêm test).
  - Chặn kèm thông báo "Hãy lập phiếu hoàn kho (điều chỉnh) ở kỳ hiện tại" cho các trường hợp (a)(b)(c) ở §0.
- **Hoàn kho từ dự án** (= phiếu điều chỉnh): `StockReceipt.receiptType` {PURCHASE (mặc định), RETURN_FROM_PROJECT}; loại RETURN có `returnedFromIssueId` bắt buộc, mỗi dòng ≤ (SL đã xuất − đã hoàn); giá = giá xuất gốc (không cho nhập tay); lô chung (`projectId` null), `purchaseInvoiceDate` = ngày lô gốc; **có** gọi `updateAverageCostPrice` ở giá xuất gốc (nhất quán với hủy); không bắt buộc hóa đơn, không bị chặn bởi loại NCC; chịu kiểm tra khóa sổ.

### 2.4 P1-5 Báo cáo (API + tool MCP + xuất CSV/Excel)
- `get_stock_ledger(materialId?, warehouseId?, fromDate, toDate)`: thẻ kho, dựng từ phiếu nhập/xuất/chuyển/kiểm kê **đã xác nhận** + phiếu xuất đã hủy (hiện **hai dòng**: xuất gốc tại `confirmedAt`, đảo tại `cancelledAt`). Cột: ngày, loại, số chứng từ, số hóa đơn, nhập SL, xuất SL, đơn giá, thành tiền, tồn SL sau dòng; tồn đầu/cuối kỳ. Tính tồn đầu bằng cách cộng dồn mọi chứng từ trước `fromDate`.
- `get_inventory_valuation(asOfDate)`: giá trị tồn nhóm theo `accountingClass` (TK152/153/155/156; vật tư `accountingClass` null thì nhóm "Chưa phân loại" và cảnh báo). **`asOfDate` = hôm nay**: SL × `costPrice` hiện tại — cùng công thức `get_inventory_summary` nên tổng **bằng nhau tuyệt đối**. **Ngày quá khứ**: dựng lại SL và giá bình quân bằng cách chạy lại sổ chứng từ theo thứ tự thời gian (cùng công thức, cùng làm tròn); nếu chạy lại đến hôm nay mà lệch `costPrice` hiện tại thì trả `reconciliationDiff` thay vì im lặng. Báo cáo theo lô (nếu có) ghi "chỉ để tham khảo, không dùng để tính giá vốn" khi cấu hình `AVERAGE`.
- `get_project_cost(projectId)`: vật tư (chi tiết dòng, **số hóa đơn nguồn qua `StockIssueLotConsumption` → lô → phiếu nhập**, kèm cờ cảnh báo ngày hóa đơn; giá = giá xuất đã ghi, tức `costPrice` lúc xuất khi `AVERAGE`), chi phí trực tiếp (`ProjectCost`), doanh thu (hóa đơn bán nếu có, ngược lại hợp đồng/báo giá như `getCostSummary`), lãi gộp, biên. **Đổi nguồn vật tư của `CostReportsService`** thành phiếu xuất CONFIRMED có `projectId` trừ hoàn kho (đã gồm phiếu do đợt phân bổ tạo), giữ nguyên các trường kết quả hiện có để frontend không vỡ.
- `list_unallocated_receipts()`: dòng nhập có lô còn tồn mà chưa gắn dự án / chưa xuất. `get_receipts_without_invoice()`: phiếu PURCHASE chưa có `invoiceNumber`.
- Xuất Excel/CSV cho ledger, valuation, project cost (`?format=csv|xlsx`, backend dùng `exceljs` nếu đã là dependency backend; nếu không có, chỉ CSV — **không thêm package**, báo lại).

### 2.5 P2-6 Hóa đơn bán & ghi nhận giá vốn
- `SalesInvoice` {id, projectId, contractId?, series, number, date, buyerTaxCode, amountExVat, vatAmount, status enum {ISSUED, CANCELLED, REPLACED}, notes, createdById…}, unique (`series`, `number`) khi chưa hủy. Tool `link_sales_invoice_to_project`; liên kết lỏng với `ProjectMaterialAllocation.salesInvoiceNo` (không bắt buộc khớp).
- `Project.costRecognitionStatus` enum {IN_PROGRESS, DELIVERED} default IN_PROGRESS, `costRecognizedAt`. Khi đặt DELIVERED lưu ngày; báo cáo giá vốn theo kỳ dùng `costRecognizedAt`.

### 2.6 P2-7 Phân bổ vật tư dùng chung
- `allocate_common_materials(fromDate, toDate, method="BY_MAIN_MATERIAL_VALUE", mode="PREVIEW"|"CONFIRM")`: lấy phần **xuất** của vật tư `accountingClass=CONSUMABLE_COMMON` trong kỳ (phiếu xuất không gắn dự án, `reasonType` OTHER/INTERNAL_USE) chia cho các dự án theo tỷ lệ giá trị vật tư chính đã xuất cho từng dự án trong kỳ. PREVIEW không ghi gì; CONFIRM ghi một `CommonCostAllocation` (+ dòng) và tạo `ProjectCost` nhóm `OTHER` cho từng dự án; chặn chạy hai lần cùng kỳ (unique theo khoảng kỳ).

### 2.7 Audit
**Đã nâng lên P0 — xem §7.1.**

## 3. Chia PR (đã sắp lại sau bổ sung số 2)

| PR | Nội dung | Model | Trạng thái |
|---|---|---|---|
| 1 | P0-1/2/3: hóa đơn trên phiếu nhập, chống trùng, `supplierType`, `accountingClass`, lô gắn dự án | Sonnet | **Xong** (`483e16b`) |
| 2 | **Kiểm soát tối thiểu (§7)**: audit bất biến, `periodLockedUntil`, quyền `inventory.approve`/`inventory.view_cost`, tài khoản máy (API token) | Sonnet | Chờ giao |
| 3 | **Nhập kho tự động từ hóa đơn (§6)**: `MaterialAlias`, hàng đợi chờ ghép, `create_stock_receipt_from_invoice`, hóa đơn thay thế/điều chỉnh, dòng chi phí, VAT/làm tròn | Sonnet | |
| 4 | **Giá xuất & hủy có đảo (§2.3)**: cấu hình phương pháp theo năm, `StockIssueLotConsumption`, hủy có đảo, hoàn kho, đợt phân bổ theo `AVERAGE` | Sonnet | |
| 5 | **API báo cáo (§2.4 + §8)**: JSON đầy đủ + metadata + phân trang + lọc, `get_receipts_without_invoice`, tool tên `*_invoice_info` | Sonnet | |
| 6 | P2-6/7: hóa đơn bán ra, `DELIVERED`, phân bổ vật tư dùng chung | Sonnet | |
| 7 | Review tổng thể (tiền, đồng thời, idempotent, quyền, token), QA đầy đủ, hướng dẫn migrate production | Opus | |

PR 2 phải xong trước PR 3–6 (mọi chứng từ phải đi qua khóa kỳ + audit + quyền). Mỗi PR: một commit, tsc + jest + `static_checks` + e2e liên quan, **không push**.

## 4. Kiểm thử bắt buộc (số cụ thể)

- **Bình quân gia quyền** (`costPrice` là nguồn duy nhất): nhập 10 cái × 100.000 rồi 10 cái × 140.000 → `costPrice` 120.000; xuất 5 → giá xuất 120.000, thành tiền 600.000, `costPrice` vẫn 120.000; nhập thêm 5 × 180.000 (tồn 20 → 25): (15×120.000 + 5×180.000)/20 = 135.000.
- **FIFO**: cùng dữ liệu, xuất 12 → 10×100.000 + 2×140.000 = 1.280.000 (giá TB 106.667), `StockIssueLot` có 2 dòng.
- **Chống trùng**: cùng (MST, ký hiệu, số) → 409 kèm id; phiếu cũ CANCELLED thì tạo lại được; hai request song song chỉ một thành công.
- **Hủy phiếu xuất**: xuất rồi hủy ngay → tồn, `remainingQuantity` từng lô và `costPrice` về đúng như trước; phiếu nhiều lô hoàn đúng từng lô; nhập thêm giữa lúc xuất và hủy → `costPrice` tính lại đúng công thức; hủy hai lần liên tiếp không hoàn hai lần; **chặn** khi kỳ đã khóa sổ, khi dự án `DELIVERED` (thông báo rõ), khi phiếu thiếu `StockIssueLotConsumption`.
- **Cấu hình giá xuất**: đổi giữa năm bị từ chối kèm lý do; đổi cho năm sau được; chứng từ trước/sau `effectiveFrom` dùng đúng phương pháp; lịch sử có người đổi; `unitPrice` tay: `IGNORE_WARN` bỏ qua + cảnh báo, `BLOCK` từ chối.
- **Cảnh báo ngày hóa đơn**: `AVERAGE` xuất lô có hóa đơn mua sau ngày hóa đơn bán → xác nhận được kèm `warnings[]` và cờ trong báo cáo; `FIFO` cùng tình huống → bị chặn.
- **Phân loại**: SERVICE + `accountingClass` khác null bị từ chối; PRODUCT mặc định FINISHED_GOOD; migration gán mặc định cho dữ liệu cũ.
- **Hoàn kho**: vượt SL đã xuất → lỗi; giá = giá xuất gốc; `costPrice` không đổi.
- **Lô dự án**: xuất cho dự án A không lấy lô của dự án B; ưu tiên lô của A.
- **NCC loại EXPENSE** → chặn; tool cũ không truyền tham số mới vẫn chạy như trước.
- **Khớp số**: tổng `get_inventory_valuation(hôm nay)` = tổng `get_inventory_summary`; với `AVERAGE`, giá vốn vật tư trong `get_project_cost` = Σ SL × giá xuất đã ghi và cùng `costPrice` với valuation.

## 5. Hướng dẫn production (Opus soạn ở PR 5)
Backup DB → deploy → migrate (chỉ thêm) → Henry phân loại NCC bằng `bulk-type` → nhập số hóa đơn cho 62 phiếu cũ bằng `invoices/bulk` → kiểm `get_receipts_without_invoice` = 0 → mới bắt đầu tạo phiếu xuất. **Không** tự đổi dữ liệu production từ môi trường phát triển.

## 6. Prompt PR 1 (Sonnet)

```
Bạn là dev backend AHSO CRM (NestJS 10 + Prisma 5 + Zod) và mcp-server. Repo: thư mục hiện tại.
[KHỐI QUY TẮC CHUNG trong docs/BOM_AGENT_PROMPTS.md — bỏ phần frontend nếu không dùng]
Đọc: docs/INVENTORY_COSTING_SPEC.md (§0–§2.1–§2.3 phần P0, §4), CLAUDE.md, backend/src/stock-receipts/,
backend/src/suppliers/, backend/src/materials/, backend/src/inventory/inventory-balance.service.ts,
mcp-server/src/tools/inventory.tools.ts (và file tool NCC/vật tư nếu tách riêng).
NHIỆM VỤ: PR 1 = P0-1, P0-2, P0-3.
- Một migration mới `YYYYMMDDHHMMSS_inventory_invoice_supplier_type`, CHỈ thêm cột/enum/bảng (+ UPDATE gán `accountingClass`
  mặc định cho vật tư cũ theo §0: STOCK→RAW_MATERIAL, PRODUCT→FINISHED_GOOD, SERVICE→null); unique index một phần
  bằng SQL thô. Cập nhật schema.prisma + docs/PROJECT_STRUCTURE.md. Không backfill dữ liệu cũ.
- Backend: DTO Zod, service, controller (mọi route guard + quyền), PATCH /stock-receipts/:id/invoice,
  POST /stock-receipts/invoices/bulk, PATCH /suppliers/bulk-type, lọc list theo trường mới,
  chặn NCC SERVICE/EXPENSE, projectId ở dòng phiếu nhập → StockLot.projectId, tham số projectId của
  inventory balances, quy tắc chọn lô theo dự án (§2.2) trong consumeStockLots (giữ hành vi cũ khi không có dự án).
- MCP: mở rộng create_stock_receipt / get_stock_receipt_detail / list_stock_receipts / create|update_supplier /
  create|update_material / list_* / get_inventory_balances bằng THAM SỐ TÙY CHỌN (accountingClass thay cho "materialKind");
  thêm find_receipt_by_invoice, update_receipt_invoice, bulk_set_receipt_invoices, bulk_update_supplier_types,
  bulk_update_material_classes. Ràng buộc kind ↔ accountingClass ở service (§0). Mô tả tool nêu rõ khác biệt kind / accountingClass. Không đổi hành vi tool cũ.
- Test (jest) theo §4 phần chống trùng, NCC EXPENSE, lô theo dự án, tương thích ngược (payload cũ vẫn OK).
- Viết docs/INVENTORY_TOOLS.md: bảng tool mới + tham số (tiếng Việt, ngắn).
- Không đổi frontend, không thêm package, KHÔNG đụng dữ liệu production.
Kiểm tra: tsc backend + mcp-server, jest module liên quan, static_checks (guard 0 ERROR).
Commit: "feat(inventory): invoice fields, duplicate guard, supplier types, accounting class, project-tagged lots".
Báo cáo ≤ 25 dòng: migration, endpoint/tool mới/sửa, cách chạy test, điểm lệch đặc tả.
```

---

# Bổ sung số 2 (20/11/2026) — tích hợp hóa đơn tự động, kiểm soát tối thiểu, API cho báo cáo

> Bối cảnh: kế toán bán thời gian, **không dùng CRM**; nhận file Excel do script ngoài tạo từ dữ liệu CRM qua MCP/API. → ưu tiên API/tool ổn định; **không làm giao diện hay xuất Excel trong CRM**; **không** làm ma trận 4 vai trò.
> Mâu thuẫn với phần trước đã xử lý: audit nâng P2 → P0 (§7.1); `periodLockedUntil` thay `inventory.lockedThrough`; xuất CSV/Excel trong CRM ở §2.4 **bỏ** (script ngoài làm); tool `update_receipt_invoice_info`/`bulk_update_receipt_invoice_info` = **bí danh** của `update_receipt_invoice`/`bulk_set_receipt_invoices` PR 1 đã có (đăng ký cả hai tên, cùng handler).

## 6. Nhập kho tự động từ hóa đơn (PR 3)

### 6.1 Ghép dòng hàng ↔ vật tư (`MaterialAlias`)
- Bảng `MaterialAlias` {id, supplierId, supplierItemCode?, supplierItemName, normalizedName, materialId, unitConversion? (số: 1 đơn vị NCC = N đơn vị vật tư; kèm `supplierUnit?`), createdById, createdAt}. Unique `(supplierId, supplierItemCode)` khi có mã; ngược lại unique `(supplierId, normalizedName)`. `normalizedName` = chữ thường, bỏ dấu tiếng Việt, bỏ ký tự thừa, gộp khoảng trắng (dùng `common/utils/vietnamese.ts`).
- `match_invoice_line(supplierId, itemCode?, itemName)`: (1) khớp alias theo mã rồi theo tên chuẩn hóa → trả `{ matched: true, materialId, unitConversion }`; (2) không khớp → `{ matched: false, suggestions: [{materialId, code, name, score, reasons[]}] }` tối đa 10, điểm 0–1: mã trùng `Material.code`/`supplierCode` (`MaterialSupplier.supplierCode`) = 1.0; độ giống tên (token overlap + chuỗi con, đã chuẩn hóa); cộng điểm cho vật tư đã có `MaterialSupplier` với chính NCC này. Tính trong ứng dụng, **không** thêm extension Postgres.
- `save_material_alias(supplierId, supplierItemCode?, supplierItemName, materialId, unitConversion?)`: tạo hoặc cập nhật (upsert); ghi audit.
- Quy đổi đơn vị: khi tạo dòng từ alias, `quantity = qtyHóaĐơn × unitConversion`, `unitPrice = đơnGiáHóaĐơn / unitConversion` (làm tròn 0 chữ số; chênh lệch làm tròn cộng vào `roundingDiff` của phiếu).

### 6.2 Hàng đợi chờ ghép
- Bảng `ReceiptPendingLine` {id, receiptId, lineNo, supplierItemCode?, supplierItemName, supplierUnit?, quantity, unitPrice, vatRate?, vatAmount?, projectId?, status PENDING|RESOLVED|DISCARDED, resolvedMaterialId?, resolvedAt?, resolvedById?}. Dòng không ghép được nằm ở đây, **không** tạo `StockReceiptItem`/lô/tồn.
- **Không xác nhận được phiếu còn dòng PENDING** (400 liệt kê dòng).
- `list_pending_match_lines(supplierId?, receiptId?, page…)`; `resolve_pending_line(lineId, materialId, saveAlias=true, unitConversion?)`: tạo `StockReceiptItem` từ dòng (áp quy đổi), đổi `RESOLVED`, lưu alias nếu `saveAlias`; chỉ khi phiếu còn DRAFT. `discard_pending_line(lineId, reason)`.

### 6.3 `create_stock_receipt_from_invoice` (một lần gọi trọn gói)
- Đầu vào: `invoice` {sellerTaxCode, series, number, date, type (NORMAL|REPLACEMENT|ADJUSTMENT), relatedInvoiceRef?, fileRef?, lookupCode?, totalExVat?, vatTotal?, grandTotal?}, `supplierId` hoặc tự tìm theo `sellerTaxCode` (không thấy → 422 "chưa có NCC", **không tự tạo NCC**), `source` (EMAIL_AUTO | MANUAL | IMPORT), `warehouseId`, `lines[]` {itemCode?, itemName, unit?, quantity, unitPrice (chưa VAT), vatRate?, materialId? (đã ghép), projectId?}.
- Kết quả: `{ receiptId, receiptNo, created: boolean, reviewStatus, matchedLines, pendingLines, expenseLines, warnings[] }`.
- **Mặc định an toàn**: phiếu tạo từ `EMAIL_AUTO`/`IMPORT` **luôn** `DRAFT` + `reviewStatus=PENDING_REVIEW`; **không bao giờ** xác nhận trong cùng lời gọi, kể cả tài khoản có quyền. `StockReceipt` thêm `source` (enum, default MANUAL) và `reviewStatus` (enum PENDING_REVIEW|REVIEWED, nullable; phiếu cũ null). Xác nhận phiếu có `reviewStatus=PENDING_REVIEW` cần `POST /stock-receipts/:id/review` (người có `inventory.approve`) trước hoặc cùng lúc.
- **Idempotent**: trước khi tạo, tra `(sellerTaxCode, series, number)` (không tính phiếu CANCELLED); có → trả phiếu cũ `{created:false}` (HTTP 200), không tạo thêm, không sửa; race → bắt lỗi unique, trả phiếu thắng cuộc. Hóa đơn **bán ra của AHSO** (MST bên bán = MST AHSO `0316896939`, lấy từ cấu hình công ty, không hard-code trong code mà trong `Setting` `company.taxCode`) → trả `{ skipped: true, reason: "SALES_INVOICE" }`, không tạo gì.
- **Hóa đơn thay thế/điều chỉnh** (`type` ≠ NORMAL, `relatedInvoiceRef` = "ký hiệu-số" hoặc id phiếu gốc): tìm phiếu gốc. Gốc **chưa CONFIRMED** (DRAFT): từ chối, hướng dẫn sửa/hủy phiếu gốc. Gốc CONFIRMED: **không sửa phiếu gốc**; tạo phiếu nháp `receiptType = ADJUSTMENT` (enum mở rộng) liên kết `adjustsReceiptId`, **tự tính chênh lệch** theo từng vật tư (SL mới − SL gốc, giá mới − giá gốc, thành tiền): dòng điều chỉnh mang `quantity` có dấu (SL < 0 = trả lại NCC, trừ tồn, cần đủ tồn) và `unitPrice`; chênh **chỉ về giá** (SL không đổi) → dòng `valueAdjustment` (không đổi tồn; khi xác nhận điều chỉnh `costPrice` = (tồnHiệnTại × costPrice + Δgiá trị) / tồnHiệnTại nếu tồn > 0, nếu tồn = 0 thì ghi nhận Δ vào giá vốn dự án đã xuất hoặc bỏ qua kèm cảnh báo — nêu rõ trong báo cáo cuối). Phiếu ADJUSTMENT cũng chỉ ở DRAFT + PENDING_REVIEW, chịu khóa kỳ (lập ở kỳ hiện tại, §7.2).
- **Dòng chi phí / dịch vụ**: dòng thuộc NCC `supplierType` SERVICE/EXPENSE, hoặc `materialId` có `kind = SERVICE`, hoặc không phải hàng nhập kho → **không** tạo tồn; tạo `ProjectCost` (xem 6.4) có/không `projectId`. Nếu **toàn bộ** hóa đơn là chi phí → không tạo `StockReceipt`, kết quả `{ receiptId: null, expenseLineIds: [...] }`.
- `list_pending_review_receipts(page…)`: phiếu `PENDING_REVIEW`, kèm số dòng chờ ghép, tổng tiền, `roundingDiff`, nguồn.

### 6.4 Chi phí không qua kho (mở rộng `ProjectCost`)
- `ProjectCost.projectId` **nới thành nullable** ("chi phí chưa gắn dự án" — thay đổi nới lỏng, tương thích ngược); thêm `sellerTaxCode?`, `invoiceSeries?`, `lineNo?`, `source?`, `reviewStatus?`, `receiptId?`, `vatRate?` đã có, `vatAmount?`. Unique một phần `(sellerTaxCode, invoiceSeries, invoiceNumber, lineNo)` khi đủ. Mọi chỗ đọc `ProjectCost` theo `projectId` giữ nguyên (chi phí chưa gắn dự án không xuất hiện trong báo cáo dự án cho tới khi gắn).
- Tool `list_expense_lines(unassignedOnly?, projectId?, dateFrom?, dateTo?, page…)`, `assign_expense_to_project(costId, projectId)` (tôn trọng khóa kỳ).

### 6.5 Toàn vẹn số liệu & VAT (cả PR 3)
- Đơn giá nhập lưu **chưa VAT**; thêm vào `StockReceiptItem`: `vatRate?`, `vatAmount?`. `StockReceipt`: `totalAmount` = Σ dòng (chưa VAT, như cũ), thêm `vatTotal?`, `invoiceTotalDeclared?` (tổng ghi trên hóa đơn), `roundingDiff` (default 0) = tổng khai báo trên hóa đơn − Σ(dòng gồm cả dòng chờ ghép + chi phí, đã gồm VAT); lệch ≤ 1.000 đ chấp nhận và lưu ở `roundingDiff`, lớn hơn → thêm cảnh báo `warnings[]` (không chặn). Không bao giờ chỉnh đơn giá dòng để "cho khớp".

## 7. Kiểm soát tối thiểu thay cho phân quyền đầy đủ (PR 2)

### 7.1 Audit bất biến
- Dùng `AuditService.record` + bảng `AuditLog` hiện có; thêm các cột/ghi chú: lý do (`changes.reason`), `actorType` ("USER" | "SERVICE") trong `changes.meta`, `userId` của tài khoản máy = `service:<tokenId>`.
- **Bất biến ở tầng DB**: trigger Postgres `BEFORE UPDATE OR DELETE ON "AuditLog"` raise exception (migration SQL thô; kiểm tra mã không có chỗ nào xóa/sửa `AuditLog`, kể cả job dọn dẹp — nếu có thì chuyển thành chỉ đọc). Ghi chú: superuser DB vẫn qua mặt được, ngoài phạm vi.
- Ghi audit **tường minh** (trước/sau, lý do) cho: tạo/sửa/xác nhận/duyệt/hủy phiếu nhập, xuất, chuyển kho, kiểm kê; sửa hóa đơn phiếu; đổi `costPrice`, `accountingClass`, `supplierType`; đổi cấu hình phương pháp giá; đặt/mở `periodLockedUntil`; tạo/thu hồi token máy; tạo/sửa/xóa alias. API `GET /audit` đã có: thêm lọc `resource`, `resourceId`, `userId`, khoảng ngày, phân trang.

### 7.2 Khóa sổ theo kỳ — `periodLockedUntil`
- Lưu trong `Setting` (khóa `inventory.periodLockedUntil`, kiểu ngày, null = chưa khóa) + bảng lịch sử `PeriodLockHistory` {id, lockedUntil (cũ→mới), changedById, reason, createdAt}. `GET/PUT /inventory/period-lock`: chỉ **ADMIN** ("Giám đốc"); `reason` ≥ 5 ký tự bắt buộc cả khi đặt lẫn mở; audit.
- Chặn (400 có `code: "PERIOD_LOCKED"`, nêu ngày khóa + hướng dẫn "lập phiếu điều chỉnh ở kỳ hiện tại") **tạo, sửa, xác nhận, hủy** mọi chứng từ kho (nhập, xuất, chuyển, kiểm kê, điều chỉnh) có ngày ≤ `periodLockedUntil`; thêm cả **đổi ngày** sang kỳ khóa. Ngày chứng từ: `StockReceipt.date`/`invoiceDate` (lấy ngày **nhỏ hơn** làm căn cứ kiểm tra), `StockIssue.date`, v.v.
- Bổ sung thông tin hóa đơn cho phiếu cũ trong kỳ khóa: **chỉ ADMIN**, kèm lý do, audit (§8.2).
- Triển khai bằng **một** hàm dùng chung `assertPeriodOpen(date, actor, opts)` gọi ở mọi service kho; có test từng loại chứng từ.

### 7.3 Hai mức quyền kho (dùng hệ thống quyền hiện có, **không thêm vai trò**)
- Thêm 2 quyền vào bảng `Permission` (migration `INSERT … ON CONFLICT DO NOTHING` + cập nhật `seed.ts`): **`inventory.approve`** (xác nhận, hủy phiếu đã xác nhận, duyệt `PENDING_REVIEW`, sửa giá vật tư `costPrice`, đổi cấu hình giá xuất, thao tác bổ sung hóa đơn ngoài kỳ khóa) và **`inventory.view_cost`** (xem giá nhập, `costPrice`, giá trị tồn, giá vốn dự án, lãi gộp).
- ADMIN ("Giám đốc") luôn có cả hai (đã bypass trong `hasPermission`). Người khác được gán bằng **vai trò tùy chỉnh** có quyền này (vai trò hệ thống MANAGER/STAFF không sửa được — đúng với thiết kế hiện tại); **không** tự động cấp cho MANAGER. Hệ quả cần ghi rõ cho Henry: sau khi triển khai **MANAGER hiện tại không còn xác nhận được phiếu kho** cho tới khi được gán vai trò có `inventory.approve`.
- Người thường: tạo/sửa phiếu **DRAFT** và kiểm kê (`inventory.create/edit` như nay) — **không** xác nhận/hủy phiếu đã xác nhận/sửa giá vật tư.
- **Che giá** cho người không có `inventory.view_cost`: các trường `costPrice`, `unitPrice`/`total` của phiếu và lô **do người khác lập**, giá trị tồn, giá vốn/lãi gộp dự án, `valuation` trả `null` (kèm `costVisible:false` ở metadata); người lập vẫn thấy giá trên phiếu **của mình** (cần nhập giá khi lập). Áp dụng ở lớp response mapper dùng chung, **không** sửa từng nơi lẻ; liệt kê các endpoint đã che trong báo cáo cuối. *(Giả định cần Henry xác nhận: tài khoản máy cho báo cáo có `inventory.view_cost` để script lấy được giá.)*
- Xác nhận/hủy/sửa `costPrice`/đổi cấu hình đều kiểm tra `inventory.approve` ở **controller guard và service** (phòng gọi nội bộ).

### 7.4 Tài khoản máy (API token) cho script/MCP
- Bảng `ApiToken` {id, name, tokenHash (SHA-256 của token), tokenPrefix (8 ký tự đầu, hiển thị), scopes String[], isActive, createdById, lastUsedAt, lastUsedIp?, expiresAt?, revokedAt?, revokedById?, createdAt}. Token dạng `ahso_sa_<32 byte base64url>`, **chỉ hiển thị một lần khi tạo**, không lưu bản rõ, không ghi vào log/audit.
- `JwtAuthGuard` nhận thêm `Authorization: Bearer ahso_sa_…`: tra hash (so sánh hằng thời gian), chặn nếu thu hồi/hết hạn, cập nhật `lastUsedAt`; tạo `JwtUser` tổng hợp `{ sub: "service:<id>", role: "SERVICE", permissions: <theo scopes> }`.
- **Scopes cố định** (không cấu hình tự do): `inventory.read` (đọc tất cả dữ liệu kho/dự án/NCC/vật tư kèm giá = có `inventory.view_cost`), `inventory.receipt_draft` (tạo phiếu nhập nháp + dòng chờ ghép + dòng chi phí, `resolve_pending_line`), `inventory.alias_write` (tạo/sửa alias). **Không có** scope xác nhận, hủy, duyệt, sửa `costPrice`, đặt/mở khóa kỳ, quản lý token/người dùng/vai trò. Guard trả 403 mã `SERVICE_ACCOUNT_FORBIDDEN` cho mọi route ngoài danh sách trắng route theo scope (**mặc định cấm**, thêm route vào danh sách trắng một cách tường minh).
- Quản lý token: `POST/GET /api-tokens`, `POST /api-tokens/:id/revoke` — **chỉ ADMIN**; audit. Mọi thao tác của tài khoản máy ghi audit với `actorType: "SERVICE"`.
- MCP server: hỗ trợ biến môi trường `CRM_API_TOKEN` (ưu tiên hơn email/mật khẩu hiện tại; giữ nguyên cách cũ khi không đặt) — **không** in token ra log.

## 8. API báo cáo cho script (PR 5)

### 8.1 Hợp đồng chung của mọi tool/endpoint báo cáo
`get_stock_ledger`, `get_inventory_valuation`, `get_project_cost`, `list_unallocated_receipts`, `get_receipts_without_invoice` (và `list_expense_lines`, `list_pending_review_receipts`, `list_pending_match_lines`, `get_invoice_date_warnings`):
- Trả **JSON có cấu trúc** (số là `number`, ngày ISO 8601, không chuỗi định dạng), dạng `{ meta, data, page }`:
  `meta` = `{ generatedAt (ISO, giờ máy chủ), asOfDate | period {from,to}, costMethod ("AVERAGE"|"FIFO", theo ngày báo cáo), periodLockedUntil, costVisible, filters (bộ lọc đã áp), schemaVersion: 1 }`; `page` = `{ limit, nextPageToken | null, total? }`.
- **Phân trang** `limit` (mặc định 100, tối đa 1000) + `pageToken` (con trỏ mờ, ổn định theo thứ tự sắp xếp xác định — không dùng offset cho báo cáo lớn, nhưng chấp nhận `offset` cho tool cũ); **bộ lọc** khoảng ngày, kho, vật tư, dự án, NCC, trạng thái. Các `list_*` cũ giữ mặc định 10 khi không truyền gì (không đổi hành vi), thêm `limit`/`pageToken`/lọc ngày tùy chọn.
- Từng dòng nhập có `invoiceSeries`, `invoiceNumber`, `invoiceDate`, `sellerTaxCode`; từng dòng xuất có `sourceReceiptLotId` (và `sourceReceiptId`, các trường hóa đơn nguồn) qua `StockIssueLotConsumption` (PR 4 — tới khi có, trả `null`).
- Số tiền: số nguyên VND; số lượng: số thập phân 3 chữ số; không làm tròn ngầm ở lớp báo cáo.
- Báo cáo **chỉ đọc** — không có tác dụng phụ.

### 8.2 Bổ sung hóa đơn cho 62 phiếu cũ
Đã có ở PR 1 (`PATCH /stock-receipts/:id/invoice`, `POST /stock-receipts/invoices/bulk`). Bổ sung ở PR 2/5: tuân thủ khóa kỳ (§7.2), ghi audit, **tuyệt đối không đổi** số lượng, đơn giá, tổng tiền (có test), thêm tool tên `update_receipt_invoice_info` / `bulk_update_receipt_invoice_info` (bí danh), và `get_receipts_without_invoice()` (JSON theo §8.1, phân trang, lọc ngày/kho/NCC).

## 9. Kiểm thử bổ sung (ngoài §4)
- **Luồng đầu–cuối** (jest tích hợp với mock Prisma hoặc e2e nếu chạy được): tạo phiếu từ hóa đơn → dòng chưa ghép vào hàng đợi → `save_material_alias` + `resolve_pending_line` → duyệt (`inventory.approve`) → xác nhận → xuất kho → báo cáo; tổng khớp ở từng bước.
- **Idempotent**: gọi `create_stock_receipt_from_invoice` hai lần (và song song) → một phiếu; hóa đơn bán ra của AHSO bị bỏ qua; chạy lại không tạo trùng.
- **5 hóa đơn mẫu** (Misumi, Hanna, Xanh SM, 2 hóa đơn bán ra của AHSO): 3 hóa đơn mua → đúng phiếu nháp/`PENDING_REVIEW` hoặc chi phí (Xanh SM là NCC/chi phí → không tạo tồn); 2 hóa đơn bán → `skipped`. Dùng dữ liệu giả lập (fixture tự dựng), **không** dùng dữ liệu production.
- **Tài khoản máy**: bị 403 khi xác nhận/hủy/duyệt/sửa `costPrice`/đặt khóa kỳ/quản lý token; token thu hồi dùng lại → 401; token không lộ trong log hay response ngoài lần tạo.
- **Khóa kỳ**: chặn tạo/sửa/xác nhận/hủy ở từng loại chứng từ có ngày ≤ khóa; đặt/mở khóa không có `reason` bị từ chối; chỉ ADMIN; có `PeriodLockHistory` + audit.
- **Quyền**: người thường xác nhận phiếu → 403; người có `inventory.approve` (qua vai trò tùy chỉnh) → được; che giá hoạt động theo `inventory.view_cost`.
- **Audit**: không `UPDATE`/`DELETE` được `AuditLog` (test ở DB thật nếu có; nếu không, test migration SQL tồn tại + unit test không có mã xóa).
- **Toàn vẹn**: tổng phiếu = Σ dòng; `roundingDiff` đúng; đơn giá chưa VAT; không chỉnh giá cho khớp.
- **Báo cáo**: có `meta.generatedAt/costMethod/periodLockedUntil`; phân trang đủ dữ liệu qua nhiều trang không trùng/thiếu; tool `list_*` cũ không truyền tham số vẫn trả 10 dòng như trước.

## 10. Nghiệm thu bổ sung số 2
1. Script gửi 5 hóa đơn mẫu → đúng như §9; chạy lại lần hai không tạo trùng.
2. Dòng chưa ghép vào hàng đợi; sau khi lưu alias lần sau tự khớp.
3. Tài khoản máy không xác nhận được phiếu.
4. Báo cáo có `generatedAt`, `costMethod`, `periodLockedUntil`.
5. `list_*` phân trang và lọc ngày.

## 11. Câu hỏi còn mở (không chặn PR 2–3, cần Henry trả lời trước PR 5/7)
1. Tài khoản máy cho script báo cáo có được thấy giá (`inventory.view_cost`) không? (Đặc tả giả định **có**.)
2. Hóa đơn điều chỉnh **chỉ về giá** khi hàng đã xuất hết (tồn = 0): ghi nhận chênh lệch vào đâu (giá vốn dự án đã xuất / bỏ qua kèm cảnh báo)? (Đặc tả tạm: bỏ qua kèm cảnh báo.)
3. MST công ty AHSO (`0316896939`) lưu ở cấu hình `company.taxCode` — xác nhận đúng.
