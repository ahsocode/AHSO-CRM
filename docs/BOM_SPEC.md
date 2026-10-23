# BOM — Định mức vật tư, giá vốn dự án, mẫu máy

> Đặc tả triển khai. Schema đã chốt trong `backend/prisma/schema.prisma` (khối "BOM") và migration
> `20261023090000_bom_project_costs`. **Không sửa schema** khi làm GĐ1–4; nếu thật sự cần, dừng lại và báo.
> UI tuân thủ `CLAUDE.md` (token màu, Be Vietnam Pro, tiếng Việt, No-Line Rule) và `docs/GLOSSARY_VI.md`.

## 0. Bài toán

AHSO bán 1 máy (hóa đơn bán: "Máy X × 1") nhưng máy gồm hàng trăm vật tư: cơ khí, điện, camera, phần mềm,
nhân công, gia công thuê ngoài. Hiện mỗi máy thiết kế riêng theo dự án; sau này máy nào có thị trường sẽ lấy
BOM của máy đã bán để sản xuất hàng loạt. Vì vậy BOM là **đối tượng độc lập**, đi qua vòng đời:

```
BOM dự toán (PROJECT, DRAFT) → duyệt (APPROVED, khóa) → BOM thực tế (tính từ phân bổ + chi phí)
  → "Lưu thành mẫu máy" (MODEL v1, v2…) → dự án mới "Tạo từ mẫu máy" → (GĐ5) lệnh sản xuất BOM × N
```

## 1. Khái niệm & nhãn tiếng Việt

| Enum | Giá trị → nhãn UI |
|---|---|
| `MaterialKind` | STOCK → Hàng tồn kho · SERVICE → Dịch vụ / phần mềm · PRODUCT → Thành phẩm (máy) |
| `BomKind` | PROJECT → BOM dự án · MODEL → Mẫu máy |
| `BomStatus` | DRAFT → Nháp · APPROVED → Đã duyệt · ARCHIVED → Ngừng dùng |
| `CostGroup` | MECHANICAL → Cơ khí · ELECTRICAL → Điện – điều khiển · VISION → Vision – camera · SOFTWARE → Phần mềm · LABOR → Nhân công · OUTSOURCE → Thuê ngoài – gia công · SHIPPING → Vận chuyển · OTHER → Khác |

Đặt các nhãn trong `frontend/lib/constants.ts` (`MATERIAL_KIND_LABELS`, `BOM_KIND_LABELS`, `BOM_STATUS_LABELS`,
`COST_GROUP_LABELS`, cùng thứ tự `COST_GROUP_ORDER`). Màu badge trạng thái: dùng token sẵn có
(Nháp = muted, Đã duyệt = success, Ngừng dùng = text-secondary).

## 2. Quy tắc nghiệp vụ (backend phải chặn, frontend chỉ hỗ trợ)

- R1 **Mã BOM**: `BOM-YYYY-NNN`, sinh trong transaction, cùng cách `generateNextReceiptNo` ở `stock-receipts.service.ts`.
- R2 **BOM dự án**: `kind=PROJECT`, `projectId` bắt buộc, `productId` null. Một dự án có thể có nhiều BOM
  (mỗi máy / hạng mục một BOM).
- R3 **Mẫu máy**: `kind=MODEL`, `productId` bắt buộc (vật tư `kind=PRODUCT`), `projectId` null, `version` tăng dần theo
  `productId` (unique `[productId, version]`).
- R4 **Khóa**: chỉ BOM `DRAFT` được sửa dòng / thông tin. `APPROVED` → muốn sửa phải "Tạo phiên bản mới"
  (sao chép thành DRAFT, `sourceBomId` = bản cũ; với MODEL `version+1`; với PROJECT giữ version+1 cùng projectId).
- R5 **Dòng tự do**: khi DRAFT cho phép `materialId = null`. **Duyệt** BOM dự án thì được phép còn dòng tự do,
  nhưng **Lưu thành mẫu máy** và **gợi ý phân bổ** bắt buộc mọi dòng nhóm vật tư hàng tồn kho phải có `materialId`
  → trả lỗi 400 liệt kê tên các dòng thiếu mã.
- R6 **BOM con**: `childBomId` trỏ tới BOM `MODEL` `APPROVED` (cụm). Cấm vòng lặp (A chứa B chứa A) — kiểm tra DFS khi lưu.
  Chi phí dòng có BOM con = `quantity × tổng dự kiến của BOM con`.
- R7 **Tổng dự kiến** BOM = Σ dòng `quantity × estUnitCost` (dòng có BOM con dùng R6). Tính ở backend, trả về theo nhóm.
- R8 **Báo giá**: `QuoteItem.bomId` (tùy chọn) gắn BOM của **cùng dự án**. Giá vốn dự kiến của dòng báo giá =
  `tổng BOM × quantity dòng`. Lãi gộp dự kiến = thành tiền − giá vốn. **Chỉ hiển thị nội bộ**, không bao giờ đưa vào
  PDF/HTML template in báo giá.
- R9 **Quy tắc ngày hóa đơn** (đã có cho lô kho): giá vốn chỉ nhận lô / chi phí có ngày hóa đơn mua ≤ ngày hóa đơn bán.
  Áp dụng cả cho `ProjectCost.invoiceDate` khi gắn vào một đợt phân bổ.
- R10 **Nhiều đợt phân bổ**: một dự án có nhiều `ProjectMaterialAllocation`, mỗi đợt ứng một hóa đơn bán
  (`salesInvoiceDate`, `salesInvoiceNo`). Index unique "1 đợt đang hoạt động / dự án" đã bị bỏ trong migration.
- R11 **Quyền**: xem BOM / chi phí / lãi gộp của dự án = `projects.view` + quyền xem dự án đó (STAFF chỉ dự án của mình,
  dùng lại `project-where.ts`). Sửa = `projects.edit`. Mẫu máy (MODEL): xem `materials.view`, sửa `materials.edit`.
- R12 Xóa BOM: soft delete (`deletedAt`); cấm xóa nếu đang được dòng báo giá, dòng phân bổ, hay BOM khác (BOM con) dùng.

## 3. API (prefix `/api`, response chuẩn `{ data, meta }`, DTO Zod, lỗi tiếng Việt)

### GĐ1 — BOM
| Method | Route | Ghi chú |
|---|---|---|
| GET | `/projects/:id/boms` | danh sách BOM dự án + tổng dự kiến |
| POST | `/projects/:id/boms` | `{ name, notes?, sourceBomId? }` — nếu có `sourceBomId` (MODEL APPROVED hoặc BOM dự án khác) thì sao chép dòng |
| GET | `/boms/:id` | chi tiết: thông tin + `lines[]` (kèm material {id, code, name, unit, kind}, childBom {id, code, name, version}) + `totals { total, byGroup: {group, amount}[] }` |
| PATCH | `/boms/:id` | `{ name?, notes? }` — chỉ DRAFT |
| PUT | `/boms/:id/lines` | thay toàn bộ dòng: `{ lines: [{ id?, group, materialId?, childBomId?, name, specification?, unit?, quantity>0, estUnitCost>=0, notes? }] }` tối đa 1000 dòng; `order` = vị trí trong mảng |
| POST | `/boms/:id/approve` | DRAFT → APPROVED, `approvedAt` |
| POST | `/boms/:id/new-version` | sao chép APPROVED → DRAFT mới (R4) |
| POST | `/boms/:id/archive` | → ARCHIVED |
| DELETE | `/boms/:id` | R12 |
| GET | `/boms/models` | mẫu máy, filter `search`, `productId`, `status` — dùng cho "Tạo từ mẫu" và chọn BOM con |

Module mới `backend/src/boms/` (controller, service, dto, `boms.service.spec.ts`), đăng ký trong `app.module.ts`.
`Material` DTO create/update/filter thêm `kind` (mặc định STOCK). `QuoteItem` DTO thêm `bomId?`; quote detail trả
thêm `costEstimate { cost, margin, marginPct }` cho từng dòng có `bomId` và tổng báo giá.

### GĐ2 — Chi phí trực tiếp & phân bổ
| Method | Route | Ghi chú |
|---|---|---|
| GET/POST | `/projects/:id/costs` | `{ group, description, supplierId?, invoiceNo?, invoiceDate, amount>=0, vatRate?, bomLineId?, notes? }` |
| PATCH/DELETE | `/project-costs/:id` | soft delete; cấm sửa nếu đã gắn đợt phân bổ CONFIRMED |
| GET | `/projects/:id/material-allocations` | **danh sách** đợt (giữ endpoint số ít cũ trả đợt mới nhất để không vỡ UI cũ cho tới khi đổi xong) |
| POST | `/projects/:id/material-allocations` | tạo đợt mới `{ salesInvoiceDate, salesInvoiceNo?, notes?, items[{stockLotId, quantity, bomLineId?}], costIds?[] }` |
| PUT | `/material-allocations/:id` · POST `/material-allocations/:id/confirm` · `/cancel` | như logic hiện có, theo id đợt |
| POST | `/projects/:id/material-allocations/suggest` | `{ bomId, salesInvoiceDate, quantityMultiplier?=1 }` → gợi ý FIFO (§4), **không ghi DB** |

### GĐ3 — Báo cáo
| GET | `/projects/:id/cost-summary` | doanh thu (hợp đồng, nếu chưa có thì báo giá ACCEPTED), giá vốn vật tư (đợt CONFIRMED), chi phí trực tiếp, lãi gộp, % ; so sánh dự toán–thực tế theo nhóm và theo dòng BOM |
| GET | `/material-allocations/:id/cost-sheet` | dữ liệu "Bảng kê giá vốn hóa đơn bán số …" (frontend xuất Excel bằng `exceljs`) |

### GĐ4 — Mẫu máy
| POST | `/boms/:id/save-as-model` | từ BOM dự án (DRAFT hoặc APPROVED): `{ productId? , newProduct?: { code, name, unit } , source: "ESTIMATE" \| "ACTUAL" }`. ACTUAL = số lượng & đơn giá bình quân lấy từ phân bổ + chi phí thực tế của dự án (dòng BOM không có thực tế giữ dự toán). Tạo MODEL DRAFT `version = max+1`. R5 |
| GET | `/boms/models/:productId/versions` | lịch sử phiên bản |

## 4. Thuật toán gợi ý phân bổ FIFO (GĐ2)

Input: BOM (đã R5), `salesInvoiceDate`, hệ số N. Bung BOM con đệ quy thành nhu cầu `{materialId, bomLineId, qty}`
(chỉ vật tư `kind=STOCK`; SERVICE → gợi ý gắn `ProjectCost`). Trừ phần đã phân bổ ở các đợt CONFIRMED khác của
dự án theo `bomLineId`. Với mỗi nhu cầu: lấy `StockLot` cùng vật tư, `remainingQuantity > 0`,
`purchaseInvoiceDate ≤ salesInvoiceDate`, sắp xếp `purchaseInvoiceDate asc, createdAt asc`, trừ dần (lô đang bị
đợt DRAFT khác giữ thì trừ phần giữ). Output: `items[]` + `shortages[{materialId, name, missingQty}]` +
`serviceLines[]` (dòng dịch vụ chưa có chi phí). Viết thành hàm thuần (pure) trong `boms/fifo-suggest.ts` để unit test.

## 5. UI (frontend)

### GĐ1
- **Vật tư**: form có ô "Loại" (3 loại §1); danh sách có cột/badge loại và bộ lọc loại.
- **Dự án → tab mới "BOM / Dự toán"** (đặt cạnh tab "Vật tư"): danh sách BOM của dự án (mã, tên, trạng thái, tổng dự kiến),
  nút "Tạo BOM" (trống / từ mẫu máy / sao chép BOM dự án khác).
- **Trình soạn BOM** (`/projects/[id]/boms/[bomId]`): bảng dòng kiểu bảng tính như form báo giá
  (`quote-form-screen.tsx` — học lại cách nhập bàn phím, thêm/xóa dòng). Cột: STT · Nhóm · Mã vật tư (ô tìm kiếm
  `/materials/select?search=`) · Tên · Quy cách · ĐVT · SL · Đơn giá dự kiến · Thành tiền · Ghi chú. Dòng chưa có mã:
  nền `--color-warning-bg`, gợi ý "Chưa gắn mã vật tư". Bên phải / phía trên: tổng theo nhóm và tổng cộng.
  Nút: Lưu · Duyệt · Tạo phiên bản mới · Nhập Excel · Xuất Excel. APPROVED → chỉ đọc.
- **Nhập Excel** (client-side `exceljs`, không thêm thư viện): chọn file → chọn sheet → **ghép cột** (tự đoán theo tiêu
  đề: "STT", "Mã|Mã VT|Part No|Code", "Tên|Mô tả|Description", "Quy cách|Thông số|Spec", "ĐVT|Unit", "SL|Số lượng|Qty",
  "Đơn giá|Unit price", "Nhóm|Group", "Ghi chú|Note") → xem trước 20 dòng → mã vật tư khớp `Material.code` thì gắn,
  không khớp thì thành dòng tự do; nhóm đoán theo từ khóa (cơ khí/điện/camera/phần mềm…) hoặc OTHER → "Thêm vào BOM"
  (nối thêm hoặc thay thế). Bỏ qua dòng trống / dòng tổng.
- **Báo giá**: mỗi dòng có thể gắn BOM của dự án (menu dòng → "Gắn BOM"). Trang chi tiết báo giá hiện khối nội bộ
  "Giá vốn dự kiến · Lãi gộp dự kiến" (chỉ người có `projects.edit`), có ghi rõ "Nội bộ — không in ra báo giá".

### GĐ2–3
- Tab "Vật tư" của dự án đổi thành danh sách **đợt phân bổ** (mỗi đợt = 1 hóa đơn bán). Tạo đợt: chọn BOM + ngày/số
  hóa đơn bán → "Gợi ý theo BOM" điền sẵn lô; hiện **thiếu hàng** (đỏ) và dòng dịch vụ chưa có chi phí.
- Tab mới **"Chi phí & lãi gộp"**: bảng chi phí trực tiếp (thêm/sửa/xóa) + thẻ tổng: Doanh thu · Giá vốn vật tư ·
  Chi phí trực tiếp · Lãi gộp · % · và bảng "Dự toán – thực tế" theo nhóm (cột chênh lệch tô màu danger khi vượt).
- Nút "Xuất bảng kê giá vốn" trên mỗi đợt đã xác nhận (Excel).

### GĐ4
- Menu **Kho → "Mẫu máy"** (`/inventory/models`): danh sách thành phẩm có BOM, phiên bản mới nhất, trạng thái, giá vốn
  dự kiến; trang chi tiết dùng lại trình soạn BOM + lịch sử phiên bản.
- Trong BOM dự án: nút "Lưu thành mẫu máy" (hộp thoại: chọn thành phẩm có sẵn hoặc tạo mới; nguồn Dự toán / Thực tế).

## 6. GĐ5 (chưa làm — chỉ để thiết kế không phải làm lại)
Lệnh sản xuất `ProductionOrder { modelBomId, quantity, status }` → nhu cầu vật tư = BOM × N − tồn kho → đề nghị mua →
xuất kho sản xuất → nhập kho thành phẩm (vật tư PRODUCT, có serial) với giá thành = giá vốn thực tế → bán như hàng
tồn kho. Không cần đổi bảng BOM hiện tại.

## 7. Kiểm thử bắt buộc
- Unit (jest, backend): sinh mã BOM; R4 khóa; R5; R6 chống vòng; R7 tổng theo nhóm có BOM con; FIFO (§4) gồm thiếu
  hàng, lô sau ngày hóa đơn bị loại, trừ phần đã phân bổ; quyền STAFF (R11).
- E2E (`e2e/bom.spec.ts`): tạo BOM dự án → nhập dòng → duyệt → không sửa được → phiên bản mới; gắn BOM vào dòng báo giá
  → thấy giá vốn dự kiến và bản in không chứa chữ "Giá vốn"; gợi ý phân bổ có thiếu hàng; lưu thành mẫu máy và tạo
  BOM dự án mới từ mẫu. Tạo dữ liệu qua API, dọn dẹp ở `finally`, dùng helper sẵn có trong `e2e/ui-regression.spec.ts`.
- `python3 tools/ahso-ui-qa/scripts/static_checks.py` = 0 lỗi.
