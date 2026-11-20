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

**Khóa sổ**: chưa có trong hệ thống → thêm cấu hình `inventory.lockedThrough` (ngày; ADMIN đặt qua API, có audit). Mọi chứng từ kho có ngày ≤ `lockedThrough` không được xác nhận/hủy/đổi ngày hóa đơn.

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
  - Khóa `inventory.manualIssuePriceMode` ∈ {`IGNORE_WARN` (mặc định), `BLOCK`}; `inventory.lockedThrough` (ngày khóa sổ, ADMIN, có audit).
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

### 2.7 P2-8 Audit
Ghi `AuditService.record` (ai, lúc nào, trước/sau) khi: tạo/xác nhận/hủy phiếu nhập, xuất, sửa hóa đơn phiếu nhập, đổi `costPrice`/`accountingClass`/`supplierType`, đổi cấu hình giá xuất.

## 3. Chia PR

| PR | Nội dung | Model |
|---|---|---|
| 1 | P0-1, P0-2, P0-3 (+ tool MCP, test, tài liệu tool) | Sonnet |
| 2 | P1-4 (cấu hình giá xuất + lịch sử + khóa năm, khóa sổ, `StockIssueLotConsumption`, hủy có đảo + điều kiện chặn, hoàn kho, đổi giá đợt phân bổ theo `AVERAGE`) | Sonnet |
| 3 | P1-5 (báo cáo + xuất CSV/Excel + đổi nguồn vật tư cost-summary) | Sonnet |
| 4 | P2-6, P2-7, P2-8 | Sonnet |
| 5 | Review tổng thể (nhất là PR 2: tiền, đồng thời, idempotent), bảo mật, QA đầy đủ, hướng dẫn migrate production | Opus |

Mỗi PR: một commit rõ ràng; tsc backend/frontend + jest + `static_checks` + e2e liên quan; không push.

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
