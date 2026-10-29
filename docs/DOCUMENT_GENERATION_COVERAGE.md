# Độ phủ chức năng sinh tài liệu (backend + UI) — kiểm tra ngày 2026-10-29

Phạm vi: chỉ ĐỌC code, không sửa file có sẵn; đây là file duy nhất được thêm vào repo. Câu hỏi của chủ sở hữu: "chức năng sinh tài liệu còn thiếu trong dự án đã chạy được chưa?"

## 0. Kết luận ngắn

**Trả lời: CHƯA đầy đủ.** Backend sinh được PDF cho 16/16 loại trong registry (bằng chứng ở mục 0.2), nhưng ở trang chi tiết DỰ ÁN người dùng KHÔNG có nút tạo từng tài liệu: chỉ có "Lưu cấu hình" rồi "Sinh tài liệu còn thiếu" (hàng loạt). Nút từng tài liệu chỉ có ở trang Báo giá, Hợp đồng, Khách hàng. Trong 16 loại, 5 loại in dữ liệu bịa hoặc dữ liệu giả lập, và chức năng hàng loạt của dự án sẽ tự sinh chúng rồi đánh dấu "Hoàn tất".

### 0.1 Những gì đã chạy thử

| Việc | Kết quả |
|---|---|
| `cd backend && npx jest --runInBand --silent src/documents` | 19 suite, 585 test, tất cả PASS |
| `scripts/render-docs/render-docs.ts` (16 loại x {vi, vi-en} x {full, minimal} = 64 HTML) | 64/64 HTML sinh ra |
| WeasyPrint 70.0 (cài `pip install --user` trên máy dev, ngoài repo) render 64 HTML | 64/64 PDF khác rỗng, 1-4 trang, 17-71 KB. Không có `{{`, `DOCUMENT_TITLE_`, `undefined`, `NaN`, `[object` trong HTML |
| Dọn `._*` | đã chạy `find . -name '._*' ... -delete`, còn 0 file |

### 0.2 Giới hạn của việc chạy thử (không được hiểu là "đã chạy end-to-end")

- Fixture của `render-docs` là dữ liệu giả, KHÔNG đi qua `DocumentDataLoaderService` và KHÔNG qua DB. Vì vậy các nhánh loader, mã 404/403, quét quyền STAFF: **chưa xác minh bằng chạy thật** (chỉ đọc code).
- Không dựng Docker/Postgres, không chạy Playwright e2e, không bấm UI: mọi kết luận về UI là từ đọc code, **chưa xác minh trên trình duyệt**.
- Phiên bản WeasyPrint và font trên production: chưa xác minh (xem `docs/DOCUMENT_TEMPLATE_AUDIT.md` mục 0).
- `docs/DOCUMENT_TEMPLATE_AUDIT.md` (2026-10-28) đã lỗi thời một phần: E-01, E-02, E-04, E-06a/b, E-07, E-11, E-13 đã được sửa (`KNOWN_DEFECTS` rỗng trong `backend/src/documents/__fixtures__/known-defects.ts:9`; `render-document.dto.ts:11` giới hạn `extra`; `document-data-loader.service.ts:24` có `buildCompanyProfile`). **E-05 (dữ liệu bịa) VẪN CÒN** — xem mục 2.

## 1. Ma trận độ phủ

Chú giải: ✔ có và đúng theo đọc code; ✘ không có; ~ có nhưng có điều kiện/lỗi (xem ghi chú). "Entity" = đoạn `:entityId` của route `POST /api/documents/:type/:entityId/render`.

Tất cả loại dùng chung 3 route (`documents.controller.ts`): preview GET `:type/:entityId/preview` (dòng 185-204, quyền `documents.view`), render POST `:type/:entityId/render` (206-229, `documents.create`), tải GET `:documentId/download` (231-243) và `:type/:entityId/download` (245-264), đều `documents.view`.

### 1.1 Loại sinh được (16 loại trong `TEMPLATE_REGISTRY`)

| Loại | (a) Backend: template + registry + loader | (b) Entity nhận, trường thiếu thì sao | (c) UI chạm tới | (d) Lưu và liệt kê | (e) Quyền / IDOR | (g) Test |
|---|---|---|---|---|---|---|
| QUOTATION | ✔ `templates/QUOTATION` (mã chết, thực chạy `quotation-flow-html-renderer`), `loadForQuotation` :311 | `quote`. Không có báo giá: 404. Không 422 | Trang báo giá: `DocumentActions` `quote-detail-client.tsx:251` + nút xem trước. Trang dự án: chỉ qua kế hoạch hàng loạt, và chỉ khi báo giá đã ACCEPTED (xem F-02) | Document + PDF (`documents.service.ts:214-241`); hiện ở "PDF đã tạo" của dự án. Nút `/quotes/:id/pdf` (QuotesPdfService) chỉ render xem trước, KHÔNG lưu | `documents.create`; STAFF chặn theo `customer.assignedToId` (:497-519) | render HTML + VAT snapshot + flow renderer ✔; loader: không có test riêng |
| PROPOSAL | ✔ `loadForProposal` :363 | `project`. Không có báo giá: vẫn render (linkedQuote null) | ✘ không có nút nào ở trang dự án/khảo sát; chỉ kế hoạch hàng loạt | như trên | như trên | HTML ✔; loader ✘ |
| SURVEY_REPORT | ✔ `loadForSurveyReport` :416 (chỉ có trong enum `DocumentType`, KHÔNG có trong `BusinessDocumentType`) | `project`. Chưa có khảo sát: render bản rỗng với ngày hôm nay và người khảo sát mặc định | ✘ tab Khảo sát không có nút; chỉ kế hoạch hàng loạt | như trên | như trên | HTML ✔; loader ✘ |
| CONTRACT | ✔ `loadForContract` :477 | `contract` HOẶC `quote` (nhánh dự phòng :240-308, hợp đồng giả "Theo báo giá ..."). Không có -> 404 | Trang hợp đồng: `DocumentActions` `contract-detail-client.tsx:113` + liên kết xem trước :164. Trang dự án: kế hoạch hàng loạt | ✔ | ✔ | HTML ✔, VAT loader ✔ (`document-data-loader.service.spec.ts`), `legal-articles.lock` ✔ |
| CONTRACT_ADDENDUM | ~ `loadForContractAddendum` :486 | `contract`/`quote`. **In 2 điều khoản sửa đổi cứng** ("Gia hạn 30 ngày", "tiền mặt -> chuyển khoản") :490-493 | như CONTRACT | ✔ | ✔ | HTML ✔ (nhưng test không phát hiện nội dung bịa) |
| NDA | ✔ `loadForNda` :503 | `customer`. Không có -> 404 | Trang khách hàng `customer-detail-client.tsx:133`; kế hoạch dự án (dùng `customerId`) | ✔; Document.entityId = customerId nên hiện ở MỌI dự án của khách (F-08) | ✔ | HTML ✔ |
| DELIVERY_NOTE | ~ `loadForDeliveryNote` :526 | `contract`/`quote`. Hạng mục = hạng mục HỢP ĐỒNG, không có phiếu xuất kho; `deliveryDate = new Date()` :539 | Trang hợp đồng ✔; kế hoạch dự án | ✔ | ✔ | HTML ✔ |
| DOC_HANDOVER | ✘ nội dung giả: `loadForDocHandover` :543-558 (danh sách "User Manual", "System Architecture" cứng) | như trên | Trang hợp đồng ✔ | ✔ | ✔ | HTML ✔ |
| INSTALLATION_REPORT | ~ `loadForInstallationReport` :560; nếu hợp đồng không có hạng mục thì in 3 dòng giả "Server OS & DB, CRM, SSL" :569-573 | như trên | ✔ | ✔ | ✔ | HTML ✔ |
| ACCEPTANCE_REPORT | ~ `loadForAcceptanceReport` :583; KHÔNG đọc `Milestone`/`Payment`; trạng thái cứng "Chờ nghiệm thu"; không hạng mục thì in 4 test case giả "Đạt (Pass)" :592-597 | như trên | Trang hợp đồng ✔ | ✔ | ✔ | HTML ✔ |
| PARTIAL_ACCEPTANCE | ~ `loadForPartialAcceptance` :607; nếu không có gì thì chèn "Giai đoạn 1 – 30%" :639-641; tỷ lệ = tiền hàng chưa VAT / giá trị HĐ đã VAT :612-615 | như trên | ✔ | ✔ | ✔ | HTML ✔ |
| WARRANTY_CERT | ~ `loadForWarrantyCert` :694; 12 tháng CỨNG :697 (bỏ qua `policies.warrantyPeriodMonths`); ngày bắt đầu = `contract.endDate`, rồi `project.completedAt`, rồi hôm nay :699-702 | như trên | ✔ | ✔ | ✔ | HTML ✔ |
| MAINTENANCE_RECORD | ✘ nội dung giả hoàn toàn: `loadForMaintenanceRecord` :715-731 (CPU/RAM, "Cloud AWS", kỹ thuật viên "Nguyễn Văn Kỹ Thuật") | như trên | ✔ | ✔ | ✔ | HTML ✔ |
| PAYMENT_REQUEST | ~ `loadForPaymentRequest` :733; không có mốc PENDING thì số tiền = 30% giá trị HĐ :749 | `contract`/`quote`. KHÔNG có entity `payment`/`milestone` nên không chọn được khoản cần đề nghị | Trang hợp đồng ✔; ✘ màn thanh toán (`contract-payment-manager.tsx`) không có nút | ✔ | ✔ | HTML ✔ |
| PAYMENT_RECEIPT | ~ `loadForPaymentReceipt` :768; lấy khoản thanh toán MỚI NHẤT :775-778; chưa có khoản thì in 30% HĐ + "Chuyển khoản" :781-782 | `contract` (nhánh `quote` luôn rơi vào 30% bịa :773). Không in được phiếu thu cho khoản cũ | như trên | ✔ | ✔ | HTML ✔ |
| AR_RECONCILIATION | ~ `loadForArReconciliation` :799; `invoiced = contract.value` :858 (chưa có dữ liệu hóa đơn) | `customer` | Trang khách hàng ✔ (:133); kế hoạch dự án (một bản cho cả khách) | ✔ | ✔ | HTML ✔ |

Không loại nào trả 422: lỗi duy nhất là 404 "Không tìm thấy ..." khi thiếu thực thể. Thiếu trường thì in rỗng, "……" hoặc dữ liệu bịa (cột (b)).

### 1.2 Loại KHÔNG sinh được (chỉ tải lên / quản lý thủ công) trong `BusinessDocumentType`

| Loại | Backend | UI | Ghi chú |
|---|---|---|---|
| RFQ, CUSTOMER_PO, SIGNED_QUOTATION, SIGNED_CONTRACT, INVOICE, OTHER | ✘ (không có template, đúng ý đồ: tài liệu nhận hoặc ký tải lên) | ✔ tab Tài liệu dự án: form "Thêm tài liệu" + tải tệp (`project-detail-client.tsx:1180-1281`), trang `/documents` | SIGNED_* tạo bằng tải lên rồi `mark-signed`, KHÔNG tự nối với bản sinh (F-07) |
| "Biên bản nghiệm thu" bản thứ hai | ✔ `GET /contracts/:id/acceptance-pdf` (`contracts.controller.ts:49-61`, `contracts-pdf.service.ts:19`) | ✘ hook `useDownloadContractAcceptancePdf` khai báo nhưng không dùng (`contract-detail-client.tsx:33`); trang `/contracts/[id]/acceptance-preview` không có liên kết nào dẫn tới (grep không thấy) | Không lưu Document; trùng nghĩa ACCEPTANCE_REPORT |
| Biên bản thanh lý | `loadForLiquidation` :651 mồ côi, không có registry/template/enum | ✘ | Mã chết |

### 1.3 MCP server (f)

`mcp-server/src/tools/*` (17 file) KHÔNG có tool sinh hay liệt kê tài liệu: grep `document|pdf|render` trong `mcp-server/src` không ra file nào. Có `create_contract`, `record_payment`, `create_quote`... nhưng không có `generate_document`, `list_documents`.

### 1.4 Quyền và IDOR (e)

- Quyền seed: `documents.view/create/edit/delete` (`prisma/migrations/20260425093000_extend_permission_coverage/migration.sql:8-11`). ADMIN: tất cả. MANAGER: view+create+edit (:36-38). **STAFF: chỉ `documents.view`** (:48-52). Hệ quả: STAFF bấm "Tạo tài liệu" (DocumentActions) hoặc "Sinh tài liệu còn thiếu" sẽ nhận 403. UI không kiểm `hasPermission("documents.create")` (grep `hasPermission` trong `document-actions.tsx` và DocumentsPanel: không có). Quyền có thể đã đổi sau migration này: chưa xác minh trên DB thật.
- Phạm vi STAFF cho render/preview: `assertContextAccess` (`documents.service.ts:497-519`) yêu cầu `customer.assignedToId === user.sub`, gọi sau loader (:406). Tải theo id/list: `buildDocumentAccessWhere` (:468-479) cùng điều kiện; tài liệu có `customerId = null` thì STAFF không thấy. **Theo đọc code: STAFF KHÔNG render/tải được tài liệu của dự án/khách không do mình phụ trách.** Chưa có test nào chứng minh (xem 1.5), chưa chạy thật.
- Điểm yếu còn lại: (1) `documents.view` cho phép preview toàn bộ nội dung hợp đồng/báo giá mà không cần `contracts.view`/`quotes.view` (controller :185-190). (2) `buildDocumentAccessWhere` không yêu cầu `assignedTo.isActive` còn `scopeCustomerWhereToUser` (`common/scoping/customer-scope.ts`) thì có: hai chuẩn lệch nhau. (3) Loader không lọc `deletedAt` (`document-data-loader.service.ts:166, 241, 312, 364, 504`): ADMIN/MANAGER render được hợp đồng/báo giá/dự án đã xóa mềm bằng id. (4) `downloadLatest` dùng `entityType` của registry (:300-306) nên không tìm thấy tài liệu sinh từ nhánh báo giá-thay-hợp-đồng (Document.entityType = "quote", xem :191).
- `extra` đã bị khóa còn `signedCopies` (`render-document.dto.ts:11-19`, `documents.service.ts:43-50`) ✔.

### 1.5 Test hiện có và khoảng trống (g)

Có: `templates.render.spec.ts` (mọi loại x vi/vi-en x full/minimal: HTML đủ, không rò `undefined/NaN`, không `{{`, không key thô, không "đồng đồng", số trang), `documents.service.spec.ts` (render 1 lần, lưu PDF, 1 bản ghi; tải theo id; tải bản mới nhất khi chưa render), `document-data-loader.service.spec.ts` (CHỈ VAT hợp đồng), `document-render-extra.spec.ts`, `legal-articles.lock.spec.ts`, `quotation-*`, helper specs, `business-documents.service.spec.ts` (6 test, gồm phạm vi STAFF cho tài liệu nghiệp vụ).

**Không có test cho:** (1) bất kỳ `loadForX` nào ngoài VAT hợp đồng, nghĩa là 15/16 loader chưa được test; (2) `DocumentsController` (quyền, 404/403); (3) phạm vi STAFF/IDOR của `renderPreview/renderPdf/downloadDocument/downloadLatest/list` (`documents.service.spec.ts` chỉ dùng ADMIN, dòng 18); (4) `ProjectsService.getDocuments/updateDocumentPlan/generateDocumentPlan` (`projects.service.spec.ts` chỉ import `DocumentsService` làm mock, không có ca nào); (5) `ContractsPdfService`, `QuotesPdfService`; (6) e2e: `e2e/projects.spec.ts:54-80` chỉ kiểm tab Tài liệu và tệp tải lên, không sinh PDF; (7) frontend: không có test cho `DocumentActions` hay `DocumentsPanel`. Loại không có test nào đi qua loader thật: **tất cả 16** (loader chỉ được test ở nhánh VAT).

## 2. Hỏng hoặc thiếu — xếp theo mức ảnh hưởng

| # | Vấn đề | Bằng chứng | Hướng sửa (1 dòng) |
|---|---|---|---|
| F-01 | **Trang dự án không có nút tạo/xem trước từng tài liệu**; chỉ có cấu hình hàng loạt. Người dùng phải sang trang hợp đồng/báo giá/khách hàng | `DocumentActions` chỉ gắn ở `quote-detail-client.tsx:251`, `contract-detail-client.tsx:113`, `customer-detail-client.tsx:133`; `DEFAULT_OPTIONS.project = []` (`document-actions.tsx:42`); DocumentsPanel :939-1640 không dùng nó | Thêm nút "Tạo / Xem trước" trên từng thẻ loại tài liệu của kế hoạch hồ sơ, gọi `POST /documents/:type/:entityId/render` với entity đã resolve (:1025-1063) |
| F-02 | **Báo giá chỉ sinh từ dự án khi đã ACCEPTED**, trong khi báo giá cần gửi TRƯỚC khi được chấp nhận | `projects.service.ts:2423` (`status: "ACCEPTED"`), `project-detail-client.tsx:993`, `constants.ts:147` | Chọn báo giá mới nhất chưa hủy (DRAFT/SENT/ACCEPTED) cho QUOTATION; chỉ giữ ACCEPTED cho tài liệu sau ký |
| F-03 | **Dữ liệu bịa trong 7 loại**; kế hoạch hàng loạt tự sinh và đánh dấu "Hoàn tất" | `document-data-loader.service.ts:490-493, 546-550, 569-573, 592-597, 639-641, 718-722, 729, 749, 781-782`; sinh tự động ở `projects.service.ts:1162-1230`; huy hiệu :1205-1215 | Loader ném 422 liệt kê trường thiếu thay vì bịa; tắt `endUserEnabled` cho DOC_HANDOVER, MAINTENANCE_RECORD cho tới khi có model dữ liệu thật |
| F-04 | **STAFF thấy nút nhưng nhận 403** (chỉ có `documents.view`) | `migration.sql:48-52`; `projects.controller.ts:117` yêu cầu `documents.create`; `document-actions.tsx` và DocumentsPanel không kiểm quyền | Ẩn/vô hiệu nút theo `hasPermission("documents.create")` HOẶC cấp `documents.create` cho STAFF theo quyết định nghiệp vụ (cần Henry chốt) |
| F-05 | **Thanh toán**: không có entity `payment`; phiếu thu luôn lấy khoản mới nhất; không nút ở màn thanh toán; "missing" không cho sinh phiếu thứ hai | `document-data-loader.service.ts:773-782`; `projects.service.ts:1196-1219` (dedupe theo type+entity); `contract-payment-manager.tsx` không có tham chiếu tài liệu | Thêm `:type/payment/:paymentId` (hoặc `?paymentId=`), nút "In phiếu thu" cho từng dòng thanh toán, nút "In đề nghị" cho từng mốc |
| F-06 | **Biên bản giao hàng không nối phiếu xuất kho**; ngày giao = lúc bấm; số lượng = số đặt | `loadForDeliveryNote` :526-541; schema `StockIssue.projectId` (`schema.prisma:1198-1208`); grep `StockIssue` trong `backend/src/documents`: 0 kết quả | Cho chọn `StockIssue` đã CONFIRMED của dự án, lấy `items`/`date` |
| F-07 | **Bản sinh không nối `BusinessDocument`; trang `/documents` không liệt kê bản sinh** | `renderPdf` chỉ tạo `Document` (`documents.service.ts:214-227`); `generatedDocumentId` chỉ do client gửi (`business-documents.service.ts:153`); `/documents` chỉ dùng `useBusinessDocuments` (`documents-client.tsx:6`); `useDocuments` (`use-documents.ts:71`) không được gọi ở đâu | Sau khi render, tạo/ cập nhật `BusinessDocument` (source GENERATED, `generatedDocumentId`) và hiển thị chung một danh sách |
| F-08 | **Danh sách tài liệu dự án lẫn tài liệu cấp khách và đếm "đã sinh" sai** | `projects.service.ts:1076-1085` (entityIds có `customerId`); `project-detail-client.tsx:994-1000, 1205-1215` (đếm theo type, không theo thực thể/ngôn ngữ) | Lọc theo (type, entityType, entityId) mà dự án sở hữu; NDA/AR hiển thị riêng "cấp khách hàng" |
| F-09 | **Biên bản nghiệm thu không đọc mốc**; có đường thứ hai mồ côi | `loadForAcceptanceReport` :583-605; hook không dùng `contract-detail-client.tsx:33`; trang `/contracts/[id]/acceptance-preview` không có liên kết | Nạp `Milestone`(DONE/ACCEPTED, `completedAt`) vào ACCEPTANCE_REPORT; xóa hoặc nối đường `ContractsPdfService` |
| F-10 | `downloadLatest` không tìm thấy bản sinh từ nhánh báo giá-thay-hợp-đồng | `documents.service.ts:300-306` so với :191, `loadContractOrQuoteReference` :234, :305 | Tra theo `documentEntityType` thực lưu hoặc cả hai entityType |
| F-11 | Quyền xem chéo: `documents.view` xem được nội dung hợp đồng/báo giá; chuẩn phạm vi STAFF lệch `customer-scope.ts`; loader bỏ qua `deletedAt` | `documents.controller.ts:185-204`; `documents.service.ts:468-479`; loader dòng :166, :241, :312, :364, :504 | Kiểm thêm quyền theo `entry.entityType` (`contracts.view`...); dùng chung `scopeCustomerWhereToUser`; thêm `deletedAt: null` |
| F-12 | Nhiều nguồn sự thật cho "loại nào dùng entity nào": backend `PROJECT_DOCUMENT_ENTITY` (`projects.service.ts:56-73`), frontend `PROJECT_GENERATED_DOCUMENTS` (`constants.ts:142-163`), `TEMPLATE_REGISTRY.entityType` | các dòng trên | Một nguồn: lấy từ `GET /documents/template-registry` |
| F-13 | Mỗi lần bấm tạo là một Document và một số mới; không có "tải bản cũ" ngoài danh sách | `documents.service.ts:199-254`; `document-actions.tsx:283-288` ghi rõ "tạo mới" | Chấp nhận (có lịch sử); thêm nút "Tải bản đã tạo" cạnh nút "Tạo mới" |
| F-14 | Không có MCP tool sinh/liệt kê tài liệu | mục 1.3 | Thêm `list_documents`, `generate_document` (gọi đúng REST + quyền) |
| F-15 | Khoảng trống test | mục 1.5 | Xem bước 6 mục 4 |

## 3. Luồng người dùng từ trang chi tiết DỰ ÁN

Trang: `frontend/app/(dashboard)/projects/_components/project-detail-client.tsx` (tab "Tài liệu" = `DocumentsPanel` :939). Tất cả đọc từ code, chưa bấm thử.

| Tài liệu | Nút trực tiếp trên trang dự án? | Làm được thế nào | Phụ thuộc dữ liệu / khoảng trống |
|---|---|---|---|
| Báo giá (tạo bản ghi) | ✔ "Tạo báo giá" `:231` -> `/quotes/new?projectId=` | Tạo báo giá; (route tồn tại, việc đọc tham số `projectId`: chưa xác minh) | — |
| Báo giá (PDF) | ✘ | Trang báo giá `DocumentActions`; hoặc "Sinh còn thiếu" khi đã ACCEPTED | F-02 |
| Hợp đồng (tạo bản ghi) | ✔ "Tạo hợp đồng" `:227` -> `/contracts/new?projectId=` hoặc "Mở hợp đồng" :223 | Tạo/ mở hợp đồng | — |
| Hợp đồng, Phụ lục (PDF) | ✘ | Trang hợp đồng, hoặc hàng loạt | Phụ lục in nội dung bịa (F-03) |
| Biên bản giao hàng | ✘ | Trang hợp đồng / hàng loạt | Cần hợp đồng hoặc báo giá ACCEPTED; không cần phiếu xuất kho nhưng cũng không dùng (F-06) |
| Bàn giao hồ sơ | ✘ | như trên | Nội dung giả (F-03) |
| Lắp đặt | ✘ | như trên | Hạng mục hợp đồng; thiếu thì in giả |
| Nghiệm thu / Nghiệm thu giai đoạn | ✘ | như trên | Không đọc mốc (F-09); giai đoạn thiếu dữ liệu thì chèn 30% |
| Bảo hành | ✘ | như trên | 12 tháng cứng; ngày bắt đầu tự rơi về hôm nay |
| Bảo trì | ✘ | như trên | Nội dung giả (F-03) |
| Đề nghị thanh toán / Phiếu thu | ✘ (tab "Tài chính" `project-finance/` chưa xác minh có nút; grep `PAYMENT_` ngoài hằng số: không thấy) | Trang hợp đồng / hàng loạt | F-05 |
| Đối chiếu công nợ / NDA | ✘ | Trang khách hàng / hàng loạt | Cấp khách hàng, lẫn giữa các dự án (F-08) |
| Đề xuất dự án / Báo cáo khảo sát | ✘ | Chỉ hàng loạt; tab Khảo sát không có nút | Khảo sát chưa có thì in bản rỗng |

Nút trỏ sai/ chết: không thấy nút trỏ sai route tại trang dự án; hai hạng mục mồ côi ở nơi khác: trang `/contracts/[id]/acceptance-preview` và hook tải biên bản nghiệm thu (F-09). Cách duy nhất người dùng có tài liệu hệ thống ngay trong dự án: tích loại -> "Lưu cấu hình" -> "Sinh tài liệu còn thiếu" -> xem ở thẻ "Tài liệu hệ thống sinh ra" (:1620-1635; xem/tải đúng `/documents/:id/download`, `primitives.tsx:307`). Kết quả hàng loạt chỉ hiển thị toast "N tạo mới, M bỏ qua, K lỗi" (:1097-1100), không nêu loại nào lỗi hay vì sao.

## 4. Thứ tự triển khai đề xuất

1. **Chặn dữ liệu bịa (F-03)** — trước mọi việc khác, vì mọi nút mới sẽ sinh tài liệu sai. Loader ném 422 kèm danh sách trường thiếu; ẩn DOC_HANDOVER/MAINTENANCE_RECORD khỏi `endUserEnabled` tới khi có model.
2. **Quyền trên UI (F-04)** và khóa chéo quyền ở controller (F-11); chốt với Henry việc STAFF có được `documents.create`.
3. **Nút từng tài liệu trong tab Tài liệu của dự án (F-01) + sửa nguồn báo giá (F-02) + cho biết lý do lỗi từng loại ở kết quả hàng loạt.**
4. **Liên kết Document và BusinessDocument, liệt kê chung ở `/documents` (F-07) và sửa danh sách/ đếm theo dự án (F-08, F-10).**
5. **Dữ liệu thật cho tài chính và nghiệm thu:** entity `payment` (F-05); biên bản nghiệm thu đọc mốc (F-09); giao hàng nối `StockIssue` (F-06); bảo hành đọc `policies.warrantyPeriodMonths`.
6. **Test:** spec cho 15 loader còn lại; spec `DocumentsController`/`DocumentsService` với STAFF (chứng minh không IDOR cho preview, render, tải theo id, tải bản mới nhất, list); spec `generateDocumentPlan/getDocuments`; một e2e: tạo dự án -> chấp nhận báo giá -> sinh hợp đồng PDF -> thấy ở tab Tài liệu -> tải về.
7. **MCP tools (F-14)** và dọn đường trùng (`ContractsPdfService`/`acceptance-preview`, `loadForLiquidation`, `QUOTATION/*.hbs` mã chết).

## 5. Việc chưa xác minh (tóm tắt)

Hành vi UI trên trình duyệt; DB thật (quyền hiện hành, dữ liệu, 404/403 end-to-end); WeasyPrint/font production; `/quotes/new?projectId` và `/contracts/new?projectId` xử lý tham số; tab "Tài chính" của dự án có nút tài liệu hay không; nội dung `mcp-server/dist` (đã build) khớp `src`.
