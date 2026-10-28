# Audit mẫu tài liệu khách hàng (backend `documents/**`) — hướng tới chuẩn thống nhất

Ngày audit: 2026-10-28. Phạm vi: `backend/src/documents/**` (registry, catalog, `templates/**`, renderer, helper, loader) + `backend/src/contracts/contracts-pdf.service.ts` (biên bản nghiệm thu thứ hai) + đối chiếu `docs/VAT_PER_LINE_SPEC.md`, `docs/AHSO_STANDARD_CONTRACT_TEMPLATE_VN.md`, `docs/GLOSSARY_VI.md`.
Chỉ đọc code, KHÔNG sửa file nào có sẵn. Đây là file duy nhất được thêm vào repo.

## 0. Phương pháp và giới hạn

- Đọc toàn bộ: `template-registry.ts`, `document-data-loader.service.ts`, `documents.service.ts`, `document-number.service.ts`, `pdf-renderer.service.ts`, `quotation-flow-html-renderer.service.ts`, `document-layout-*.ts`, `helpers/*`, `i18n/*.json`, `templates/_partials`, `templates/styles`, và các `vi.hbs`/`vi-en.hbs`; đọc lướt `document-template-catalog.ts` (2386 dòng, chủ yếu layout mặc định cho trình sửa mẫu).
- RENDER THẬT: đã dựng lại đúng pipeline của `DocumentsService` (Handlebars + partial + helper thật + CSS bundle) và `QuotationFlowHtmlRendererService` thật (chạy bằng `tsx`), dữ liệu giả thực tế (khách Orion Vina, báo giá 4 dòng gồm VAT 8% và KCT, hợp đồng 3 mốc thanh toán), rồi WeasyPrint 70 -> PDF -> PNG (`pdftoppm`) và xem ảnh. Có thêm ca "thiếu dữ liệu" (không người liên hệ, không hạng mục, MST công ty chỉ có key `taxId` như settings thật) và một báo giá 28 dòng để xem ngắt trang.
- Sản phẩm render nằm NGOÀI repo: `/tmp/doc-samples/{*.html,pdf/,png/}` (VM cloud, mất khi hết phiên). Script dựng: `/tmp/claude-0/-home-claude/bb098b44-e69e-5cdb-bb8b-b8730a1883bb/scratchpad/render/render.mts`.
- Giới hạn render: VM không có font Noto Sans / FreeSerif nên WeasyPrint rơi về Liberation/DejaVu (độ rộng chữ hơi khác production Alpine: `font-noto`, `ttf-freefont`). Phiên bản WeasyPrint trên production CHƯA xác minh (Alpine 3.21 `apk add weasyprint`, VM dùng 70) — cần chạy `weasyprint --version` trong container backend trước khi tin kết quả ngắt trang/grid. 5 loại `DOC_HANDOVER, INSTALLATION_REPORT, PARTIAL_ACCEPTANCE, WARRANTY_CERT, MAINTENANCE_RECORD` mới render bản `vi`; bản `vi-en` của chúng chỉ đọc tĩnh (cùng kiểu lỗi với các loại khác).
- Mẫu tham chiếu BG-2026-059 (Orion): KHÔNG có file mẫu trong repo (grep `BG-2026-059` chỉ chạm `scripts/vat-correction/*`). So sánh theo bố cục mẫu chuẩn AHSO: 1 trang A4, logo trái + thông tin công ty phải, gạch navy `#073A66`; tiêu đề BÁO GIÁ; dòng "Số · Ngày · Hiệu lực 30 ngày"; hai khối KÍNH GỬI | DỰ ÁN; bảng 7 cột STT | HẠNG MỤC/QUY CÁCH | ĐVT | SL | ĐƠN GIÁ (VNĐ) | VAT | THÀNH TIỀN (VNĐ); "Cộng trước thuế / VAT 8% (trên X đ) / TỔNG CỘNG"; "Bằng chữ"; khung điều khoản nền vàng; chữ ký "ĐẠI DIỆN CÔNG TY TNHH AHSO" + "XÁC NHẬN CỦA KHÁCH HÀNG (Họ tên / Chức vụ)". Lưu ý mẫu này dùng cột VAT riêng; `VAT_PER_LINE_SPEC` quy định KHÔNG thêm cột VAT vào PDF — hai nguồn mâu thuẫn, cần Henry chốt (mục 2, Q-1).

## 1. Kiểm kê

### 1.1 Năm "đường ống" sinh tài liệu (cùng một nghiệp vụ, nhiều bản cài đặt)

| # | Đường ống | Dùng cho | Vấn đề |
|---|---|---|---|
| A | `quotation-flow-html-renderer.service.ts` (HTML dựng bằng template string TS, CSS px) | QUOTATION (preview, PDF, `QuotesPdfService`) | Là bản duy nhất chạy cho báo giá. `templates/QUOTATION/{vi,vi-en}.hbs` là MÃ CHẾT (`renderHtml` rẽ nhánh `type === "QUOTATION"` trước khi đọc hbs). Variant của QUOTATION trong trình sửa mẫu (`TEMPLATE_EDITOR_TYPES`) bị bỏ qua khi in. |
| B | Handlebars `templates/<TYPE>/{vi,vi-en}.hbs` + `_partials` + `styles/*.css` | 15 loại còn lại | Mặc định khi không có variant published. |
| C | `DocumentLayoutRendererService` (vị trí tuyệt đối theo mm) + `createXxxLayout()` trong `document-template-catalog.ts` | Mọi loại trừ QUOTATION, CHỈ khi có variant `PUBLISHED && isActive` (`getActiveVariant`) | Là bản sao nội dung thứ ba. Ví dụ hợp đồng: layout mặc định 4 trang, 23 Điều (catalog dòng 779–1312) khác hẳn `CONTRACT/vi.hbs` (6 Điều). Văn bản pháp lý thay đổi tuỳ có hay không có variant active. |
| D | `contracts/contracts-pdf.service.ts` (HTML cứng trong service) | "Biên bản nghiệm thu" nút trong hợp đồng (`generateAcceptancePdf`) | Không dùng registry/hbs/helper; có dữ liệu mốc + thanh toán nhưng không có văn bản pháp lý Bên A/Bên B. Khác hoàn toàn `ACCEPTANCE_REPORT`. |
| E | Frontend in trình duyệt: `quote-preview-client.tsx` (544 dòng), `contract-acceptance-preview-client.tsx` (353 dòng) | Xem/in từ UI | CHƯA audit chi tiết; là bản thứ 4–5 của báo giá và biên bản nghiệm thu. |

Hệ quả: 4 cài đặt `formatCurrency`, 4 cài đặt `formatDate`, 3 hàm `escape`, 3 bản `@font-face` (`base.css`, flow, `contracts-pdf`), 3 bản `.signature-*` CSS. Số lượng inline `style=` trong hbs: 6–35 mỗi file.

### 1.2 Bảng A — 4 tài liệu lõi (thuộc tính × mẫu)

| Thuộc tính | QUOTATION (đường ống A) | CONTRACT (B) | DELIVERY_NOTE (B) | ACCEPTANCE_REPORT (B) | "Biên bản nghiệm thu" nút trong HĐ (D) |
|---|---|---|---|---|---|
| Ngôn ngữ | `vi`; `vi-en` = CHỈ tiếng Anh (title "QUOTATION", nhãn EN), dữ liệu giữ nguyên. Không song ngữ thật. | `vi`; `vi-en` = xếp chồng VI + EN từng nhãn/đoạn | như CONTRACT | như CONTRACT | chỉ vi, một số nhãn tiếng Anh cứng ("Acceptance Record", "Completion rate") |
| Dữ liệu dùng | `quote.{quoteNo,version,validUntil,subtotal,taxBreakdown,taxRate(legacy),taxAmount,total,terms,deliveryTerms,tableColumnWidths}`, `items[]`, `project.name`, `customer.{name,address,phone,email}`, `primaryContact.name`, `company.{name,taxCode\|taxId,address,phone,email,website,representative,representativeTitle}`, `logo` | `contract.{contractNo,value}`, `project.{name,startDate,expectedEndDate}`, `customer.{name,address,taxCode}`, `primaryContact.{name,title}`, `company.{name,address,taxCode(!),bankAccount,bankName,bankBranch,representative,representativeTitle}`, `milestones[].{name,paymentAmount}`, `policies.warrantyPeriodMonths`, `generatedAt` | `contract.contractNo`, `deliveredItems[]` (= hạng mục hợp đồng, bỏ giá), `deliveryDate` (không in), `company`, `customer`, `primaryContact`, `generatedAt` | `contract.contractNo`, `testResults[]` (= hạng mục hợp đồng, trạng thái cứng "Chờ nghiệm thu"), `acceptanceDate` (không in), `company`, `customer`, `primaryContact` | `contract.{contractNo,value,status,notes,milestones[],payments[<=6],stats}`, `project.{code,name}`, `customer.{name,taxCode,address,primaryContact}`, `company` |
| Letterhead | logo + khung tiêu đề; thông tin công ty ở thẻ bên phải (từ settings, có MST). Không tên công ty trong header; `alt="AHSO"` và câu "AHSO trân trọng gửi" cứng | Quốc hiệu + tiêu đề; KHÔNG logo, KHÔNG thông tin công ty ở đầu trang | như CONTRACT | như CONTRACT | logo + tên công ty + "Acceptance Record" + meta công ty (từ settings) |
| Số tài liệu | `quote.quoteNo` = `BG-YYYY-NNN` (khoá advisory, ổn định) + "Phiên bản". Ngày lập KHÔNG in; "Hiệu lực" = `validUntil` | Header: `contract.contractNo` (`HD-YYYY-NNN`). Footer: `docNumber` kiểu `CO-2026-ORION-001-v1` (số khác, sinh mới mỗi lần render) | Header `BBGH-{contractNo}/{ngày dd/mm/yyyy}` (lỗi mode `"year"`, xem E-04) + footer `docNumber` khác | `BBNT-{contractNo}/{ngày}` + footer khác | không có số riêng; tên file `BBNT-{contractNo}.pdf` |
| Định dạng ngày | `Intl vi-VN` không đệm số 0 (`3/11/2026`), theo múi giờ máy chủ | helper: `ngày dd tháng MM năm yyyy` (lấy `generatedAt` = NGÀY RENDER, không phải `signDate`); `dd/MM/yyyy` | `ngày…` cứng placeholder (xem E-01) | như DELIVERY | `Intl vi-VN` không đệm; thiếu ngày in "Chưa cập nhật" |
| Khối các bên | Hai thẻ không tiêu đề: Khách hàng (tên, địa chỉ, ĐT, email, người liên hệ — thiếu MST khách) và "Công ty". Không khối DỰ ÁN (tên dự án nằm trong câu mở đầu) | Bên A = khách (primaryContact), Bên B = AHSO. Bảng "Tên công ty / Địa chỉ / MST / Đại diện: Ông/Bà … Chức vụ" | BÊN GIAO (BÊN B) = AHSO; BÊN NHẬN (BÊN A) = khách; "Địa điểm giao nhận" = địa chỉ khách | BÊN BÀN GIAO (BÊN B), BÊN NGHIỆM THU (BÊN A) | Khối "Thông tin khách hàng" + "Liên hệ chính"; KHÔNG có Bên A/Bên B, không khối AHSO |
| Bảng & tiền | STT / Hạng mục / Mô tả / SL (gộp ĐVT: "2 cái") / Đơn giá / Thành tiền; số không ký hiệu, tiêu đề cột không ghi "(VNĐ)"; thead lặp, `tr` không bị cắt | Không bảng hạng mục. Điều 2 in `88.410.000 VND`; Điều 3 liệt kê "Lần n: tên – số tiền" (số tiền null in `0 VND`) | STT / Mô tả / ĐVT / Số lượng (không giá; không so với số lượng đặt) | STT / Hạng mục-Kịch bản / Kết quả / Ghi chú | Bảng mốc: Hạng mục / Trạng thái / Hạn / Hoàn tất / Giá trị (`88.410.000 ₫`) |
| VAT | ĐÚNG SPEC: mỗi nhóm một dòng, KCT cuối, "VAT 8% (trên 70.750.000 đ)". Lệch nhỏ: 1 nhóm không KCT in "Thuế (8%)" thay vì "VAT 8%"; KCT hiện giá trị `0`; hậu tố "đ" (vi) / "VND" (vi-en) chỉ ở phần "trên …" | KHÔNG in VAT, dù loader đã chuẩn bị `linkedQuote.taxBreakdown`; câu cứng "Đã bao gồm thuế GTGT và mọi chi phí liên quan" | không có tiền | không có tiền | Không VAT; "Giá trị hợp đồng / đã thanh toán / còn phải thu" |
| Tổng + bằng chữ | Tạm tính / VAT / Tổng cộng. KHÔNG có "Bằng chữ" (mẫu 059 có) | `Tổng giá trị hợp đồng` + `Bằng chữ` (helper `numberToVietnameseWords`, có) | không | không | không có bằng chữ |
| Điều khoản | `quote.terms` / `quote.deliveryTerms` (sửa được theo từng báo giá). Dự phòng cứng "Theo thỏa thuận trong hợp đồng kinh tế." (kể cả vi-en). Không có hiệu lực/ghi chú VAT | 6 Điều cứng trong hbs (1,2,3,4,5 rồi NHẢY sang 12). Nhãn Điều 6–11 có trong i18n nhưng KHÔNG được dùng. Chuẩn AHSO (`docs/AHSO_STANDARD_CONTRACT_TEMPLATE_VN.md`) có 23 Điều | Đoạn "chất lượng" cứng: "Hàng hóa mới 100%, đúng quy cách…" in vô điều kiện; "02 bản" cứng | Đoạn xác nhận cứng "Hệ thống đáp ứng đầy đủ… nhất trí nghiệm thu bàn giao đưa vào sử dụng chính thức" in vô điều kiện, dù cột Kết quả = "Chờ nghiệm thu" | `contract.notes` (tự do) |
| Chữ ký | "ĐẠI DIỆN AHSO" (chức danh + tên) | "ĐẠI DIỆN BÊN A/B" + 2 vòng tròn "ĐÓNG DẤU" + tên; không chức danh dưới tên, không dòng "…, ngày … tháng … năm …" | 2 cột, KHÔNG ô đóng dấu, không ngày/nơi | như DELIVERY | 2 hộp nét đứt "Đại diện AHSO / Đại diện khách hàng — Ký, ghi rõ họ tên"; không tên/chức danh |
| Trang | A4, lề 14/12/16 mm; chân `Trang x / y` (8,5px ≈ 6,4pt) góc phải; thead lặp; chữ ký `avoid-break` | A4 lề 20/18/22/22; font serif 12pt justify; KHÔNG số trang (partial `footer-page` in `Trang:` rỗng, chỉ ở cuối văn bản); tiêu đề Điều có thể mồ côi cuối trang (render: "ĐIỀU 2" một mình cuối trang 1) | như CONTRACT; chữ ký có thể rơi trang riêng | như CONTRACT | A4 lề 14/12; không số trang |
| Font / màu | Noto Sans 10,5px (≈7,9pt); xám-xanh slate | Times/FreeSerif 12pt; `#111827` | như CONTRACT; bảng viền đen mặc định | như CONTRACT | Noto Sans 12px; navy `#1A5276` |
| Thiếu dữ liệu in ra | trường rỗng thì bỏ dòng (OK); không có "undefined" | `MST:` của AHSO RỖNG (E-02); `primaryContact` null -> `……`; `milestones[].paymentAmount` null -> `0 VND` | placeholder thô (E-01) | placeholder thô; ca không hạng mục -> bài kiểm thử GIẢ (E-05) | "Chưa thiết lập", "Chưa cập nhật" in thẳng vào văn bản gửi khách |

### 1.3 Bảng B — 11 loại còn lại (cùng đường ống B)

Tất cả có `vi.hbs` + `vi-en.hbs`; style `modern` cho PROPOSAL/SURVEY_REPORT, còn lại `classic` (Quốc hiệu, không logo).

| Loại | Số in ra ở header | Dữ liệu | Lỗi nổi bật (đã thấy trong render hoặc code) |
|---|---|---|---|
| PROPOSAL | `docNumber` (RỖNG khi xem trước) | project, milestones, `linkedQuote.total` thật | Nội dung quảng cáo cứng ("công nghệ hiện đại nhất…"); mốc thanh toán bị dùng làm "phạm vi công việc"; không VAT/ghi chú gồm VAT ở "Tổng giá trị đề xuất"; MST công ty trống (partial dùng `taxCode`); timeline bị ngắt cuối trang 2 trong render mẫu |
| SURVEY_REPORT | `docNumber` | khảo sát thật | `imageUrl` không có trong loader; `surveyorName` mặc định "Bộ phận Kỹ thuật AHSO", `surveyDate` mặc định ngày hôm nay khi chưa có khảo sát |
| CONTRACT_ADDENDUM | `{contractNo}/PL-{ngày}` | `modifications` GIẢ cứng ("Gia hạn 30 ngày", "tiền mặt -> chuyển khoản") | Nội dung pháp lý bịa in ra; "ký ngày" lấy `contract.createdAt` thay vì `signDate`; MST AHSO trống |
| NDA | `NDA-{customer.id}/{ngày}` (cuid) | customer | Bên A = AHSO (Bên tiết lộ) ngược quy ước hợp đồng (Bên A = khách); "03 năm" cứng dù có `policies.ndaDurationYears` (chưa dùng); MST AHSO trống |
| DOC_HANDOVER | `BGTL-{contractNo}/{ngày}` | 100% GIẢ ("User Manual", "System Architecture", "tài khoản quản trị") | In nguyên văn cho khách |
| INSTALLATION_REPORT | `BBCĐ-…` | hạng mục hợp đồng; nếu rỗng -> GIẢ ("Server OS & DB", "CRM hệ thống lõi", "SSL") | Ngôn ngữ phần mềm cho dự án thiết bị |
| PARTIAL_ACCEPTANCE | `BBNT-GĐ-…` | hạng mục hợp đồng (CẢ hợp đồng) hoặc mốc; nếu rỗng -> "Giai đoạn 1 30%" cứng | Tỷ lệ = `item.total / contract.value` (trước VAT / đã gồm VAT): render mẫu 42+28+14+10 = 94% (E-09) |
| WARRANTY_CERT | `BH-…` | `warrantyMonths = 12` CỨNG (hợp đồng dùng `policies.warrantyPeriodMonths`) | Tiêu đề in KEY thô `DOCUMENT_TITLE_WARRANTY_CERT`; "Ngày bắt đầu" RỖNG (đọc `contract.expectedEndDate`, không tồn tại; loader có `warrantyDate`) |
| MAINTENANCE_RECORD | `BBBT-…` | 100% GIẢ (CPU/RAM, "Cloud AWS", kỹ thuật viên "Nguyễn Văn Kỹ Thuật") | Tiêu đề key thô `DOCUMENT_TITLE_MAINTENANCE_RECORD` |
| PAYMENT_REQUEST | `DNTT-{contractNo}/{ngày}` | mốc PENDING gần nhất; nếu không có -> 30% giá trị HĐ (BỊA) | "Hạn thanh toán" = ngày lập; "…đồng đồng."; "CÔNG TY CÔNG TY TNHH…"; trang 2 chỉ có chân trang (trang trắng) |
| PAYMENT_RECEIPT | `PT-{contractNo}/{ngày}` | `Payment` mới nhất; nếu chưa có -> 30% HĐ + "Chuyển khoản" (BỊA) | Phiếu thu "Đã nhận đủ" cho khoản chưa thu; "…đồng đồng./" |
| AR_RECONCILIATION | `BBDC-{customer.code}/{ngày}` | hợp đồng theo khách; `invoiced = contract.value` (giả định) | Tiêu đề key thô `DOCUMENT_TITLE_AR_RECONCILIATION`; hàng tiêu đề bảng VÔ HÌNH (chữ trắng trên nền xám); nhãn "BÊN GIAO/BÊN NHẬN" cho biên bản đối chiếu; "Còn phải thu" in trên văn bản gửi khách |

Loader mồ côi: `loadForLiquidation` (Biên bản thanh lý) không có registry/template/enum.

### 1.4 Dữ liệu cho Biên bản giao hàng và Biên bản nghiệm thu (trả lời câu hỏi nguồn dữ liệu)

- DELIVERY_NOTE: KHÔNG dùng phiếu xuất kho. `documents/**` không tham chiếu `StockIssue` (schema có `StockIssue.projectId/allocationId` + `StockIssueItem.{materialId,quantity}`). Danh sách giao = `contractItems` (hạng mục hợp đồng; nếu hợp đồng không có item thì lấy từ báo giá ACCEPTED đầu tiên). `deliveryDate = new Date()` (ngày render), thậm chí không được in ngoài placeholder hỏng. Không có số lượng đã giao vs đã đặt, không có số phiếu xuất kho, không có biển số xe/người nhận thực tế, không ghi chú tình trạng.
- ACCEPTANCE_REPORT: danh sách = hạng mục hợp đồng với trạng thái cứng "Chờ nghiệm thu"; không đọc `Milestone` (status, `completedAt`, `paymentAmount`) và không đọc `Payment`. Dự phòng khi hợp đồng không có item: 4 test case GIẢ "Đạt (Pass)" (đăng nhập/SSO, Load testing 1000 CCU…) in vào biên bản pháp lý.
- Dữ liệu mốc/thanh toán chỉ xuất hiện ở đường ống D (`ContractsPdfService`), không nối với ACCEPTANCE_REPORT.
- Dữ liệu mong manh (đọc được từ code): `primaryContact` lấy `contacts[isPrimary=true][0]` — null thì in dòng chấm; `customer` không có `representative` (partial `customer-info` đọc trường không tồn tại); `company.taxCode` vs settings lưu `taxId`; `milestones[].paymentAmount` null; ngày null -> chuỗi rỗng ("từ: đến:"); `currency(null|undefined|"abc")` -> `0 VND`; số >= 10^12 làm `numberToVietnameseWords` ném `RangeError` (render hỏng cả tài liệu).

## 2. Điểm không nhất quán / lỗi — xếp theo mức ảnh hưởng

Quy ước: **P0** = sai tiền hoặc sai/bịa nội dung pháp lý trên văn bản gửi khách; **P1** = văn bản hỏng hiển thị hoặc không dùng được; **P2** = thiếu nhất quán thuật ngữ/định dạng; **P3** = bảo trì. Cột "Duyệt" = có đụng chữ pháp lý / logic tiền / quy tắc đánh số, cần Henry duyệt trước khi sửa (xem mục 4).

### P0 — tiền và pháp lý

| ID | Vấn đề và bằng chứng | Tác động | Hướng xử lý | Duyệt |
|---|---|---|---|---|
| E-01 | Placeholder in thô: `i18n/vi.json` có 10 câu chứa `{{date}}`, `{{location}}`, `{{contractNo}}` (`agreement_statement`, `nda_agreement_statement`, `delivery_statement`, `handover_statement`, `installation_statement`, `acceptance_statement`, `partial_acceptance_statement`, `warranty_cert_statement`, `maintenance_statement`, `addendum_statement`). Template gọi `{{t "agreement_statement" date=… location=…}}` (vd `CONTRACT/vi.hbs:16`, `DELIVERY_NOTE/vi.hbs:11`) nhưng `helpers/bilingual.ts` chỉ đọc `key`, bỏ qua `options.hash` và KHÔNG nội suy. Render thật: "Hôm nay, ngày {{date}}, tại {{location}}, chúng tôi gồm:" (CONTRACT, DELIVERY, ACCEPTANCE… đều có). Ở `vi-en` dòng EN lại in đúng ngày/địa chỉ nên một văn bản có cả dòng hỏng lẫn dòng đúng | Câu mở đầu mọi hợp đồng/biên bản/NDA/phụ lục sai; không có ngày ký, không có nơi ký | Cho helper `t` nội suy `{{name}}` từ `options.hash` (HTML-escape), thêm kiểm thử "không còn `{{` trong HTML". Nguồn giá trị: ngày = `contract.signDate ?? ngày lập`, nơi = địa chỉ công ty (hiện ý định) | Có: nguồn ngày/nơi ký (L-01) |
| E-02 | MST bên B (AHSO) trống: settings lưu khoá `taxId` (`settings/dto/update-setting.dto.ts:25`) nhưng `CONTRACT/vi.hbs:50`, `CONTRACT/vi-en.hbs:55`, `CONTRACT_ADDENDUM/vi.hbs:47`, `…/vi-en.hbs:52`, `NDA/vi.hbs:25`, `NDA/vi-en.hbs:32`, `_partials/company-info.hbs:6` đọc `company.taxCode`. Chỉ renderer báo giá xử lý cả hai (`taxCode \|\| taxId`). Render thật: "MÃ SỐ THUẾ:" bên B để trống trong hợp đồng, phụ lục, NDA, và PROPOSAL | Hợp đồng không có MST của AHSO | Chuẩn hoá vào một `buildCompanyProfile()` (alias `taxId` -> `taxCode`) ở `loadBaseContext`; không đổi lời văn | Không |
| E-03 | Hợp đồng thiếu Điều 6–11 và nhảy số: hbs in Điều 1,2,3,4,5 rồi `article_12` (i18n có `article_6`…`article_11` nhưng không template nào dùng). Ba bản nội dung khác nhau: hbs (6 Điều) / layout mặc định trong `document-template-catalog.ts` (23 Điều, dòng 779–1312) / `docs/AHSO_STANDARD_CONTRACT_TEMPLATE_VN.md` (23 Điều). Điều 1 cứng "hệ thống phần mềm (hoặc cung cấp dịch vụ)"; Điều 5 cứng "lỗi do thiết kế, lập trình… 48h" (chỉ hợp lý cho phần mềm) cho hợp đồng thiết bị/máy | Hợp đồng in ra thiếu quyền–nghĩa vụ, phạt vi phạm, bất khả kháng, tranh chấp; nội dung phụ thuộc việc có variant active hay không | Chọn một nguồn pháp lý duy nhất (mục 3.8, 4 bước 7) | CÓ — từng điều (L-02…L-09) |
| E-04 | Số hiệu: header của 12 loại classic (24 file hbs) dùng `{{date generatedAt "year"}}` nhưng `helpers/format-date.ts` chỉ có `short/long/long-en/iso`; `"year"` rơi về `short` -> "BBGH-HD-2026-012/28/10/2026", "BBNT-…/28/10/2026"… (xem PNG). Header in số này, footer in `docNumber` KHÁC (`GH-2026-ORION-001-v1`); `renderPdf` luôn `reserveWithRetry(type, code, 1, …)` -> mỗi lần bấm xuất tạo số mới + bản ghi `Document` mới (`nextSequence` = đếm bản ghi/năm, không khoá). NDA dùng `customer.id` (cuid); xem trước (`renderPreview`) không có `docNumber` nên footer rỗng | Một tài liệu mang hai số; in lại ra số khác; số xấu | Một sơ đồ số duy nhất (mục 3.6) | Có (L-10) |
| E-05 | Dữ liệu bịa trong loader (`document-data-loader.service.ts`): `loadForContractAddendum` (dòng 475: "Gia hạn 30 ngày…"), `loadForDocHandover` (527–540 cứng), `loadForInstallationReport` fallback (554: Server OS/CRM/SSL), `loadForAcceptanceReport` fallback (577: "Đạt (Pass)", SSO, 1000 CCU) và trạng thái "Chờ nghiệm thu" (573), `loadForPartialAcceptance` (624: "Giai đoạn 1 – 30%"), `loadForWarrantyCert` (681: 12 tháng cứng), `loadForMaintenanceRecord` (713: "Nguyễn Văn Kỹ Thuật", CPU/AWS), `loadForPaymentRequest` (733: `contractValue * 0.3`), `loadForPaymentReceipt` (765: `0.3` + "Chuyển khoản" khi CHƯA có thanh toán) | Văn bản pháp lý/tài chính chứa số liệu và kết quả nghiệm thu không có thật | Bỏ fallback; thiếu dữ liệu -> trả lỗi 422 liệt kê trường thiếu (mục 3.7) | Có (L-11…L-14) |
| E-06 | Tiền: (a) `helpers/format-currency.ts` `toNumber` đổi null/undefined/"abc" thành 0 -> in `0 VND` (mốc thanh toán chưa có số tiền in "Lần 2: … – 0 VND"); (b) `formatWords` đã thêm " đồng" nhưng `PAYMENT_REQUEST/vi.hbs` và `PAYMENT_RECEIPT/vi.hbs` thêm " đồng." nữa -> "… nghìn đồng đồng." (thấy trong render); (c) số hiển thị làm tròn (`Intl`) còn bằng chữ cắt phần lẻ (`Math.floor`): 1234,6 -> "1.235 VND" vs "Một nghìn hai trăm ba mươi tư đồng"; (d) `numberToVietnameseWords` ném `RangeError` từ 10^12 làm hỏng cả PDF; (e) hợp đồng in cứng "Đã bao gồm thuế GTGT và mọi chi phí liên quan" nhưng không in VAT theo nhóm dù loader đã có `linkedQuote.taxBreakdown` (spec nói hợp đồng dùng cùng quy tắc nhóm); (f) không kiểm tổng các mốc = giá trị hợp đồng | Số tiền sai/gây hiểu nhầm trên hợp đồng, đề nghị thanh toán | Một `money()`/`amountInWords()` dùng chung, strict cho tài liệu pháp lý | Có (E-06e: L-03; còn lại là sửa lỗi, không đổi lời) |
| E-07 | `documents.service.ts` `buildRenderContext`: `{ ...base, ...extra, ...entityData }`, và `render-document.dto.ts`: `extra: z.record(z.unknown())` (không giới hạn khoá). Người có `documents.create` có thể ghi đè `company.bankAccount`, `company.name`, `policies`, `logo`… lên PDF chính thức được lưu; `logo` là URL tùy ý do WeasyPrint tải (SSRF/đọc ảnh cục bộ) | Rủi ro giả mạo tài khoản nhận tiền trên Đề nghị thanh toán; SSRF | Allowlist `extra` theo từng loại; `logo` chỉ lấy từ settings | Không đổi lời; cần security review |
| E-08 | Múi giờ: không có `TZ` trong `docker-compose*.yml`/`Dockerfile`; helper ngày dùng `getDate()` giờ máy. Thử `TZ=UTC`: `signDate` 20/10 00:00 (ICT) in "19/10/2026"; render lúc 05:00 ICT in "ngày 27 tháng 10". Hợp đồng dùng `generatedAt` (ngày render) làm ngày ký. Flow báo giá (`validUntil`) và `contracts-pdf` cũng dùng `Intl` giờ máy | Ngày hiệu lực/ký/giao lệch 1 ngày | Mọi định dạng ngày đặt `timeZone: "Asia/Ho_Chi_Minh"`; đặt `TZ` cho container | Có (nguồn "ngày" của từng văn bản, L-01) |
| E-09 | PARTIAL_ACCEPTANCE tính `item.total / contract.value`: `item.total` là tiền hàng chưa VAT, `contract.value` (tạo từ báo giá) đã gồm VAT theo nhóm. Render mẫu: 42%+28%+14%+10% = 94%. AR: `invoiced = contract.value` đặt nhãn "Đã xuất hóa đơn" (chưa có dữ liệu hóa đơn thật). `PAYMENT_REQUEST` "Hạn thanh toán" in `requestDate` dù có `policies.paymentDeadlineDays` | Tỷ lệ/ công nợ trình khách sai | Dùng giá trị mốc (`Milestone.paymentAmount`), đổi nhãn AR cho đúng nghĩa | Có (L-15) |
| E-10 | Hai "Biên bản nghiệm thu": `ACCEPTANCE_REPORT` (hbs, câu xác nhận vô điều kiện "Hệ thống đáp ứng đầy đủ… đưa vào sử dụng chính thức" nhưng cột Kết quả = "Chờ nghiệm thu") và `ContractsPdfService` (mốc + thanh toán, không văn bản pháp lý, nhãn Anh "Acceptance Record", "Completion rate", "Tổng milestone" trái `GLOSSARY_VI`, tiền kiểu `88.410.000 ₫`, ngày `3/11/2026`, "Chưa thiết lập/Chưa cập nhật" in vào bản gửi khách) | Khách nhận hai mẫu khác nhau cho cùng việc | Gộp về một `ACCEPTANCE_REPORT` lấy dữ liệu mốc/thanh toán | Có (L-13) |

### P1 — hiển thị hỏng / không dùng được

| ID | Vấn đề và bằng chứng | Hướng xử lý |
|---|---|---|
| E-11 | Tiêu đề in KEY thô: `AR_RECONCILIATION` (`document_title_ar_reconciliation`), `WARRANTY_CERT` (`document_title_warranty_cert`), `MAINTENANCE_RECORD` (`document_title_maintenance_record`) không có trong `vi.json/en.json` (i18n có `…_reconciliation`, `…_warranty`, `…_maintenance`). Render: "DOCUMENT_TITLE_AR_RECONCILIATION" cỡ lớn | Đổi khoá cho khớp; kiểm thử quét khoá thiếu |
| E-12 | `vi-en` có 3 nghĩa khác nhau: (A) flow báo giá = chỉ tiếng Anh; (B) hbs = xếp chồng VI trên EN từng nhãn; (C) layout variant = `viEn ?? vi` thay thế. Ở (B) `.lang-vi,.lang-en {display:block}` (`styles/base.css`) làm mỗi nhãn một dòng: "BÊN GIAO / DELIVERING PARTY / DELIVERING PARTY / ( BÊN B / PARTY B )", "(" ")" ":" tách dòng, "03/11/2026 / đến / to / 15/12/2026", "ĐÓNG DẤU STAMP" chồng chữ; mẫu `<span class="lang-vi">{{t "…"}}</span><span class="lang-en">…</span>` bọc `t` hai lần nên EN lặp (đếm trong hbs: AR 15, PAYMENT_REQUEST 11, DELIVERY 10, ACCEPTANCE 8, PAYMENT_RECEIPT 8, NDA 5, ADDENDUM 2, CONTRACT 1). Hợp đồng `vi-en` 4 trang thay vì 2 | Một quy tắc song ngữ (mục 3.7); `t` trả inline |
| E-13 | Không đánh số trang trên văn bản classic/modern hbs: `base.css` `@page` không có margin box; `_partials/footer-page.hbs` chèn `<span class="pageNumber">` rỗng ở CUỐI nội dung ("CÔNG TY TNHH AHSO · … CO-2026-…-v1 Trang:" cuối văn bản). Chỉ flow báo giá có `@bottom-right "Trang x / y"` | `@page { @bottom-* }` + counter, chân trang chạy |
| E-14 | Ngắt trang/CSS: "ĐIỀU 2" mồ côi cuối trang 1 (không `break-after: avoid` ở `.classic-article__heading`); khối chữ ký cô lập trên trang 2 ở ca thiếu dữ liệu; PAYMENT_REQUEST có trang 2 trống (chỉ `footer-page`); AR: `<tr style="background-color:#1e3a8a;color:white">` bị `th{background:#f3f4f6}` đè nên chữ trắng trên nền xám — tiêu đề bảng gần như vô hình; `.classic-body{text-align:justify}` lan vào ô bảng ("Biến   tần   ABB"); CSS vô hiệu `border: 1pt solid text` (DELIVERY/ACCEPTANCE/PARTIAL…; WeasyPrint cảnh báo bỏ qua); `print-color-adjust` không được WeasyPrint hỗ trợ; số tiền `88.410.000 VND` tự xuống dòng trong cột hẹp | Sửa CSS dùng chung, thêm quy tắc ngắt trang |
| E-15 | Letterhead không đồng nhất: báo giá = logo + khung tiêu đề (không tên công ty); hợp đồng/biên bản classic = chỉ Quốc hiệu, KHÔNG logo/tên công ty ở đầu (kể cả Đề nghị thanh toán, Phiếu thu, Đối chiếu công nợ do AHSO phát hành); proposal/khảo sát = dải màu + logo; nghiệm thu D = logo + "Acceptance Record" | Một `letterhead` partial, biến thể `legal` (kèm Quốc hiệu) |
| E-16 | Báo giá so với mẫu BG-2026-059: thiếu "Bằng chữ"; thiếu ngày lập; khối khách thiếu MST; không khối DỰ ÁN; không cột ĐVT (SL gộp "2 cái"); tiêu đề cột không ghi VNĐ; không thông tin hiệu lực/ghi chú giá chưa gồm VAT (`vat_note` cũ "8-10% tùy loại" chỉ có ở hbs chết); nhãn "Tạm tính" (nghĩa tạm) so với "Cộng trước thuế"; đơn nhóm "Thuế (8%)" so với "VAT 8%"; dòng KCT hiện `0`; `renderInfoCard(title, …)` nhận `title` nhưng không in nên hai thẻ không có tiêu đề; cỡ chữ thân 10,5px ≈ 7,9pt (mẫu 059 dùng 9,5pt); vùng chữ ký khách trống, không "Họ tên / Chức vụ" | Mục 3.2–3.4 |
| E-17 | Tên vai trò: Bên giao, Bên nhận, Bên bàn giao, Bên nghiệm thu, Bên triển khai, Bên tiếp nhận, Bên tiết lộ, Đơn vị thụ hưởng, "Bên bán/mua" (báo giá) — quy ước Bên A/Bên B đảo ngược ở NDA (A = AHSO) so với hợp đồng (A = khách). AR dùng nhãn `delivery_sender/recipient` ("BÊN GIAO/BÊN NHẬN"). PAYMENT_REQUEST cứng "Kính gửi (To):" và "CÔNG TY {{customer.name}}" -> "CÔNG TY CÔNG TY TNHH…" | Bảng vai trò chuẩn (mục 3.3) |

### P2 — thuật ngữ và định dạng

| ID | Vấn đề |
|---|---|
| E-18 | Năm quy ước tiền: `currency` hbs -> "88.410.000 VND"; flow báo giá -> số trần + "đ"/"VND" chỉ ở dòng "trên …"; layout renderer -> số trần; `contracts-pdf` -> "88.410.000 ₫" (`Intl currency`); mẫu 059 -> "VNĐ" ở tiêu đề cột + " đ" ở tổng. Ba bản `Intl.NumberFormat("vi-VN")` độc lập |
| E-19 | Bốn quy ước ngày: helper (đệm 0: `03/11/2026`, `ngày 03 tháng 11 năm 2026`), flow và `contracts-pdf` (`Intl` không đệm: `3/11/2026`), layout (2-digit), `iso`; bản EN trong hbs dùng `short` "28/10/2026" (mode `long-en` "October 28, 2026" có nhưng không template nào dùng) |
| E-20 | Thuật ngữ: registry/label và tiêu đề lệch: "Phiếu bảo hành" (registry) vs "GIẤY CHỨNG NHẬN BẢO HÀNH" (i18n); "Biên bản nghiệm thu giai đoạn" vs "…TỪNG PHẦN"; "Biên bản bàn giao hồ sơ" vs "…TÀI LIỆU"; "Biên bản lắp đặt" vs "CÀI ĐẶT"; loader còn đặt `title` kiểu "GIẤY ĐỀ NGHỊ THANH TOÁN / PAYMENT REQUEST". `milestone` -> "mốc" theo `GLOSSARY_VI` nhưng PDF nghiệm thu in "Tổng milestone". `vi.json`: khoá trùng `warranty_period`, `bank_name`, `bank_account_name` (khoá sau thắng); typo "Số Hơp đồng" (`ar_contract_no`); "ĐVT" vs "Đơn vị" (layout catalog) vs "Đơn vị tính"; "Thành tiền" nhất quán ở báo giá nhưng "Giá trị" ở nghiệm thu; "Hạng mục" vs "Mô tả" làm tiêu đề cột tên hàng ở biên bản giao hàng |
| E-21 | Màu/CSS: navy `#1A5276` + cam `#E67E22` (`modern.css`, `contracts-pdf`), slate `#0f172a/#e2e8f0` (flow), `#1e3a8a` (AR), đỏ `#b91c1c` (phiếu), xám Tailwind; mẫu 059 dùng navy `#073A66`, xanh `#0B62A8`, nền `#F4F6F8`, khung điều khoản `#FFF6C9`/`#F8E81C`. Đơn vị: pt (base/classic) lẫn px (flow, contracts-pdf). `.signature-block` định nghĩa ở `base.css` (flex), flow (table-cell), `.signature-grid` ở `modern.css` |
| E-22 | PDF: font được nhúng và có ToUnicode (`pdffonts` -> emb/uni = yes), dấu tiếng Việt đúng; nhưng `<html lang="vi">` cả bản `vi-en`; `<title>` = `context.title` chung ("BÁO GIÁ / QUOTATION") thay vì số văn bản; không PDF/UA; độ tương phản thấp (chữ stamp/`legal-footer` `#9ca3af` ~2,5:1; chữ xám `#6b7280` cỡ 6,4–9pt); chân trang 6,4pt |

### P3 — bảo trì

- `QUOTATION/*.hbs` là mã chết nhưng vẫn nằm trong registry (`templateDir`); `vat_note`, `validity_period_note`, `quotation_intro` trong i18n chỉ phục vụ file chết.
- Ba nguồn nội dung cho mỗi loại (hbs, catalog layout, tài liệu .md) -> trôi lệch (E-03).
- i18n: 34/209 khoá không template nào dùng (quét tĩnh), gồm `article_6…article_11`, `signed_by`, `date_place` (dòng "Địa điểm, ngày" cho chữ ký), `witness`, `effective_date`, `basis_of_law` và 3 khoá tiêu đề đúng tên `document_title_warranty/maintenance/reconciliation` (template lại gọi khoá sai tên, E-11); `loadForLiquidation` mồ côi.
- Test thiếu (xem mục 5): không có test nào render hbs; helper tiền/ngày/chữ không có spec; `DocumentNumberService`, `ContractsPdfService` không có spec.

## 3. Chuẩn thống nhất đề xuất

Nguyên tắc: một sự thật cho mỗi thứ (một hàm tiền, một hàm ngày, một khối tổng/VAT, một khối chữ ký, một nguồn lời văn pháp lý); văn bản pháp lý thiếu dữ liệu thì CHẶN xuất chứ không điền bậy; mọi thay đổi chữ pháp lý và logic tiền đi qua phê duyệt của Henry (mục 4).

### 3.1 Kiến trúc

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| Giữ nguyên 4–5 đường ống | không rủi ro ngay | lệch nội dung vĩnh viễn (E-03, E-10, E-18/19) | Không |
| Handlebars + partial dùng chung + `document-kit` TS cho định dạng/khối số liệu | giữ được hbs dễ đọc cho lời văn; kit dùng chung cho cả renderer flow | cần migrate từng loại | **Khuyến nghị** |
| Chuyển tất cả sang template string TS như flow báo giá | kiểm soát chặt, test dễ | lời văn khó đọc/sửa, mất hbs | Không |

Giữ `QuotationFlowHtmlRendererService` cho bảng báo giá (colgroup theo `tableColumnWidths`, thead lặp, đã có spec VAT tốt) nhưng cho nó gọi chung kit: letterhead, khối bên, khối tổng, chữ ký, chân trang. Xóa `QUOTATION/*.hbs` ở bước dọn dẹp. Variant editor (layout tuyệt đối, đường ống C): chỉ giữ cho PROPOSAL và SURVEY_REPORT; văn bản pháp lý (CONTRACT, CONTRACT_ADDENDUM, NDA, giao hàng, nghiệm thu, thanh toán, đối chiếu) chỉ đọc lời văn từ thư viện điều khoản có phiên bản (Q-2).

### 3.2 Khung và partial dùng chung

```
doc-shell      @page A4 + chân trang chạy + CSS token
 ├─ letterhead     biến thể commercial (logo + tên + MST/địa chỉ/ĐT/email) | legal (thêm Quốc hiệu/tiêu ngữ)
 ├─ doc-title      tiêu đề VI [+EN], "Số:", "Ngày lập" / "Hiệu lực", nơi lập
 ├─ party-block    role A/B + nhãn chức năng, tên, địa chỉ, MST, đại diện (Ông/Bà … Chức vụ)
 ├─ project-block  Dự án / Hợp đồng số / Báo giá số (khối "DỰ ÁN" của mẫu 059)
 ├─ items-table    preset cột theo loại (báo giá, giao hàng, nghiệm thu, đối chiếu)
 ├─ totals-block   Cộng trước thuế / VAT theo nhóm (đúng SPEC) / Tổng cộng / Bằng chữ
 ├─ terms-block    điều khoản SỬA ĐƯỢC (bullet) | clause-set  lời văn pháp lý CỐ ĐỊNH
 ├─ signature-block  2–3 cột: chức danh, ô đóng dấu, họ tên; dòng "TP. …, ngày … tháng … năm …"
 └─ doc-footer     số văn bản (trái) · "Trang x / y" (phải) · "Bản xem trước" khi chưa phát hành
```

Bố cục báo giá theo mẫu 059 (đã chốt trong Q-1): header logo trái + thông tin công ty phải; tiêu đề BÁO GIÁ; dòng "Số · Ngày · Hiệu lực"; hai khối KÍNH GỬI | DỰ ÁN; bảng STT | Hạng mục/Quy cách (tên đậm + dòng phụ) | ĐVT | SL | Đơn giá (VNĐ) | Thành tiền (VNĐ) [+ cột VAT nếu Q-1 chọn]; khối tổng; "Bằng chữ"; khung điều khoản; chữ ký hai bên.

### 3.3 Vai trò và thuật ngữ chuẩn

| Khái niệm | Chuẩn | Thay thế |
|---|---|---|
| Hợp đồng, phụ lục, biên bản | Bên A = khách hàng (bên mua), Bên B = AHSO (bên bán/thực hiện) — như `docs/AHSO_STANDARD_CONTRACT_TEMPLATE_VN.md` | NDA đang đảo (A = AHSO) |
| Chức năng trong biên bản | "Bên giao (Bên B) / Bên nhận (Bên A)"; nghiệm thu: "Bên thực hiện (Bên B) / Bên nghiệm thu (Bên A)" | Bên bàn giao, Bên triển khai, Bên tiếp nhận, Đơn vị thụ hưởng… gộp về hai cặp trên |
| Tổng trước thuế | "Cộng trước thuế" | "Tạm tính" |
| Dòng thuế | "VAT 8%" / "VAT 8% (trên X đ)" / "Không chịu thuế (KCT) (trên X đ)" | "Thuế (8%)" |
| Đơn vị | cột "ĐVT" riêng | gộp vào SL |
| Giá | "Đơn giá", "Thành tiền" | "Giá trị" |
| Mốc | "mốc" (hợp đồng/thanh toán), "giai đoạn nghiệm thu" | "milestone", "Completion rate", "Acceptance Record" |
| Tên loại văn bản | một nhãn duy nhất giữa registry, i18n và UI (đề nghị: Báo giá · Đề xuất dự án · Báo cáo khảo sát · Hợp đồng · Phụ lục hợp đồng · Thỏa thuận bảo mật · Biên bản giao hàng · Biên bản bàn giao tài liệu · Biên bản lắp đặt · Biên bản nghiệm thu · Biên bản nghiệm thu giai đoạn · Phiếu bảo hành · Biên bản bảo trì · Đề nghị thanh toán · Phiếu thu · Biên bản đối chiếu công nợ) | lệch registry/i18n/loader (E-20) |

### 3.4 Khối tổng và VAT (không đổi logic)

- Chỉ đọc kết quả của `buildQuoteTaxBreakdown`/`buildQuoteTotals`; không tài liệu nào tự cộng/ làm tròn lại. Thêm kiểm tra bất biến: `Σ nhóm.base = subtotal`, `Σ nhóm.tax = taxAmount`, `subtotal + taxAmount = total`.
- Nhãn đúng `VAT_PER_LINE_SPEC`: nhóm có thuế "VAT 8%"; KCT "Không chịu thuế (KCT)"; "(trên X đ)" khi có >1 nhóm hoặc có KCT; KCT cuối; không thêm cột VAT vào PDF (Q-1 hỏi lại vì mẫu 059 có cột VAT).
- Dòng đơn nhóm không KCT: đề xuất "VAT 8%" thay "Thuế (8%)" cho khớp spec/mẫu (đổi nhãn, không đổi số).
- Chỗ chưa in VAT nhưng có số liên quan VAT (hợp đồng, nghiệm thu giai đoạn, đề nghị thanh toán, đối chiếu): thêm câu "Giá trị đã gồm VAT theo từng nhóm: …" lấy từ `taxBreakdown` — nội dung mới nên cần duyệt (L-03, L-15).

### 3.5 Token CSS chung (đề xuất, một file `styles/tokens.css`)

```css
:root {
  --font-sans: "Noto Sans", "DejaVu Sans", Arial, sans-serif;
  --font-serif: "Times New Roman", "FreeSerif", "DejaVu Serif", serif;
  --fs-body: 10pt;      /* thương mại; hiện flow 7,9pt */
  --fs-legal: 12pt;     /* văn bản pháp lý */
  --fs-table: 9.5pt;
  --fs-note: 8.5pt;     /* tối thiểu cho chữ phụ */
  --lh: 1.45;
  --c-ink: #1d252c;  --c-muted: #5a6672;  --c-line: #d9dee3;
  --c-brand: #073A66; --c-accent: #0B62A8; --c-surface: #F4F6F8;
  --c-note-bg: #FFF6C9; --c-note-line: #F8E81C;
  --c-danger: #b91c1c; --c-ok: #15803d;
  --page-commercial: 14mm 14mm 18mm 14mm;
  --page-legal: 20mm 18mm 22mm 24mm;
}
```
Quy tắc: chỉ dùng pt/mm (bỏ px); không inline `style=` (dùng class); tương phản chữ >= 4,5:1 (bỏ `#9ca3af`); chữ phụ >= 8,5pt; chữ trong bảng căn trái hoặc phải, KHÔNG `justify`; `th` luôn đặt màu chữ cùng nền (sửa E-14 AR). Màu thương hiệu: Henry chọn giữa `#073A66` (mẫu 059) và `#1A5276` (đang dùng ở `modern.css`/`contracts-pdf`) — Q-4.

Thiết lập trang: A4; `@page` có margin box: số văn bản trái + "Trang x / y" phải (`counter(page)`/`counter(pages)`); `thead { display: table-header-group }`; `tr, .avoid-break { break-inside: avoid }`; tiêu đề `h2/h3, .classic-article__heading { break-after: avoid }`; `orphans/widows: 3`; khối chữ ký `break-inside: avoid` và kèm đoạn liền trước (`break-before: avoid` ở đoạn cuối). Font: `font-noto` + `ttf-freefont` đã có trong Dockerfile; thêm `@font-face` một lần duy nhất ở `tokens.css`.

### 3.6 Đánh số tài liệu

| Loại | Quy tắc đề xuất | Ví dụ |
|---|---|---|
| Báo giá | giữ `BG-YYYY-NNN` (khoá advisory, đang chạy) | BG-2026-059 |
| Hợp đồng | giữ `HD-YYYY-NNN` | HD-2026-012 |
| Văn bản con của hợp đồng (giao hàng, lắp đặt, bàn giao tài liệu, nghiệm thu, nghiệm thu giai đoạn, bảo hành, bảo trì, đề nghị thanh toán, phiếu thu, phụ lục) | `{PREFIX}-{YYYY}-{NNN của hợp đồng}-{NN}` với NN tăng theo (loại, hợp đồng), cấp dưới khoá advisory giống báo giá | GH-2026-012-01, NT-2026-012-01, TT-2026-012-02 |
| Theo khách | `NDA-YYYY-NNN`; `DCN-YYYY-{mã KH}-NN` | NDA-2026-004 |
| Đề xuất | `DX-YYYY-NN` (mẫu 059 ghi "Mã đề xuất AHSO-2026-NN" — Q-5 chốt tiền tố) | DX-2026-07 |

Số do server cấp MỘT lần cho mỗi văn bản; in lại cùng nội dung giữ nguyên số; hậu tố `-v2`… chỉ khi nội dung đã phát hành bị sửa. Header và footer in cùng một số. Xem trước in "BẢN XEM TRƯỚC" thay vì để trống. Số đã phát hành theo kiểu cũ (`BG-2026-ORION-001-v1`) giữ nguyên, không đánh lại. Cần Henry duyệt (L-10).

### 3.7 Quy tắc định dạng, dữ liệu thiếu, song ngữ

Tiền: lưu số nguyên VND; hiển thị phân cách nghìn bằng dấu chấm, không thập phân; trong bảng số trần với tiêu đề "(VNĐ)"; trong dòng tổng/văn xuôi hậu tố " đ"; không dùng "₫" và không dùng "VND" trong tiếng Việt (trong cột EN dùng "VND"). `null/undefined` -> "—" (không bao giờ "0"); tài liệu pháp lý dùng chế độ strict (thiếu số tiền = lỗi). Bằng chữ: một hàm `amountInWords(n)`: làm tròn trùng với số hiển thị, thêm " đồng" MỘT lần (template không thêm), mở rộng tới 10^15 hoặc trả lỗi rõ ràng (không `RangeError` làm hỏng PDF); có/không "chẵn" do Q-6. Làm tròn: dòng `round(qty*price)`, nhóm VAT `round(base*rate/100)` (spec), không làm tròn khác.

Ngày: luôn `timeZone: "Asia/Ho_Chi_Minh"`; `dd/MM/yyyy` (đệm 0) trong bảng; "ngày dd tháng MM năm yyyy" trong lời văn; dòng EN "dd MMMM yyyy". Mỗi văn bản có `docDate` tường minh: báo giá = ngày lập; hợp đồng = `signDate` (thiếu thì chặn hoặc để trống chấm); biên bản = ngày nhập khi lập (mặc định hôm nay theo ICT); in lại không đổi ngày.

Dữ liệu thiếu: trường tùy chọn -> bỏ dòng; trường chữ ký tay (người liên hệ khách) -> `……………` đã có; trường bắt buộc (MST công ty, địa chỉ, người đại diện, số tiền, số hợp đồng) -> HTTP 422 liệt kê tên trường; tuyệt đối không "undefined/null/NaN/[object Object]" và không dữ liệu mẫu. Chuỗi "Chưa thiết lập", "Chưa cập nhật" không in vào bản gửi khách.

Nội suy chuỗi i18n: `{{t "key" a=b}}` thay `{{a}}` (đã escape); test CI báo lỗi nếu HTML ra còn `{{`.

Song ngữ `vi-en`: dòng VI chính, dòng EN phụ (nghiêng, nhỏ hơn, màu muted) trong CÙNG ô/đoạn cho nhãn, tiêu đề, điều khoản chuẩn; dữ liệu người dùng (tên, địa chỉ, tên hàng, điều khoản nhập tay) in MỘT lần; nhãn nội dòng dạng "Ông/Bà / Mr/Ms" (inline, không xuống dòng); `{{t}}` trả `<span class="bi"><span lang="vi">…</span><span class="en" lang="en">…</span></span>` và CHỈ `.bi--block` mới xuống dòng; template không tự viết thêm span EN cạnh `t`; báo giá `vi-en` phải có VI+EN (không EN-only; nếu cần bản chỉ-EN thì thêm ngôn ngữ `en`, Q-3); hợp đồng `vi-en` kèm điều khoản ưu tiên bản tiếng Việt (L-17); `<html lang="vi">` + `lang="en"` ở span EN; số/ngày vẫn theo định dạng Việt Nam, có chú thích "Amounts in VND; '.' is the thousands separator".

### 3.8 Phần sửa được và phần cố định

| Nội dung | Nơi lưu | Ai sửa |
|---|---|---|
| Điều khoản báo giá (thanh toán, giao hàng, hiệu lực, ghi chú), ghi chú, người ký/chức danh, ngày/nơi lập, kết luận và kết quả nghiệm thu từng hạng mục, số lượng thực giao, lý do thanh toán | dữ liệu từng văn bản | người lập |
| Thông tin công ty (kể cả MST, ngân hàng, đại diện), `paymentTerms`, `warrantyPeriodMonths`, `paymentDeadlineDays`, `ndaDurationYears`, `deliveryTerms` mặc định | Settings (`company:*`, `policies`) | admin; chỉ là THAM SỐ chèn vào lời văn cố định |
| Quốc hiệu/tiêu ngữ, căn cứ pháp lý, mọi Điều của hợp đồng/phụ lục/NDA, câu xác nhận nghiệm thu/giao hàng/biên lai, "lập thành … bản", điều kiện bảo hành | thư viện `templates/_clauses/<loại>.<ngôn ngữ>.v<N>.hbs` + `legalVersion` in nhỏ ở chân trang | CHỈ qua thay đổi có phê duyệt của Henry (phiên bản mới + changelog; test băm nội dung điều khoản) |
| Nhãn, tiêu đề cột | i18n (một khoá một nghĩa, không trùng) | dev, có test khoá |

## 4. Thứ tự di chuyển (ít rủi ro -> nhiều rủi ro)

QUY TẮC BẮT BUỘC cho mọi bước:

1. Logic tiền/VAT KHÔNG đổi nếu chưa có duyệt rõ ràng của Henry: `buildQuoteTaxBreakdown`, `buildQuoteTotals`, `calculateAcceptedQuoteTotal`, `calculateContractValueFromQuoteItems`, cách làm tròn theo dòng/nhóm. PR chạm các hàm này phải ghi "đã được Henry duyệt" + dẫn chiếu. Dòng VAT trong PDF báo giá phải giữ nguyên từng byte (snapshot) khi chỉ đổi giao diện.
2. Lời văn pháp lý của hợp đồng/phụ lục/NDA/biên bản KHÔNG đổi nếu chưa có duyệt TỪNG ĐIỀU (bảng 4.1). Không gộp nhiều điều vào một lần duyệt; không "tiện tay sửa chính tả" trong điều khoản.
3. Mỗi bước là một PR độc lập, revert được; không đánh lại số tài liệu đã phát hành; không đụng dữ liệu đã lưu (PDF cũ giữ nguyên).
4. Theo CLAUDE.md: `npm run typecheck && npm run lint && npm test` ở `backend/`; thay đổi liên quan tiền/quyền phải có test FAIL khi logic hỏng; mock thuần, không mock `PrismaService`.

| Bước | Nội dung | Rủi ro | Cần duyệt |
|---|---|---|---|
| 0 | Lưới an toàn: fixtures, test khoá i18n, test render mọi loại, snapshot HTML "trước khi sửa", script render PDF (chưa sửa template) | rất thấp | không |
| 1 | Sửa hiển thị thuần, không đổi chữ/số: `border: 1pt solid text`, tiêu đề bảng AR, bỏ `text-align: justify` trong bảng, `break-after: avoid` cho tiêu đề Điều, trang trắng ở PAYMENT_REQUEST, `@page` + số trang chạy (thay `.pageNumber` rỗng), `.lang-*` inline; sửa 3 khoá tiêu đề thô, typo "Hơp", khoá i18n trùng, bỏ " đồng" thứ hai ở bằng chữ phiếu/đề nghị | thấp | không (thêm "Trang x/y" là hiển thị) |
| 2 | Hạ tầng dùng chung, không đổi lời: `t` nội suy `{{date}}`… đúng với tham số template đã truyền sẵn (E-01); alias `taxId` -> `taxCode` (E-02); `date` mode `year` hoặc đổi header số văn bản thành `docNumber` tạm thời; ngày theo `Asia/Ho_Chi_Minh` + `TZ` container (E-08); `money()` không trả `0` cho giá trị thiếu; `amountInWords` không ném lỗi; allowlist `extra` (E-07) | thấp–trung bình | không đổi lời; E-07 qua security review |
| 3 | Partial/CSS token dùng chung cho văn bản không phải hợp đồng: SURVEY_REPORT, PROPOSAL, DOC_HANDOVER, INSTALLATION_REPORT, MAINTENANCE_RECORD, WARRANTY_CERT (chỉ bố cục/letterhead/chữ ký/chân trang); xóa `QUOTATION/*.hbs` mã chết | trung bình | không |
| 4 | QUOTATION flow dùng kit: letterhead/khối bên/chữ ký/chân trang; thêm trường thiếu so với mẫu 059 (ngày lập, MST khách, khối DỰ ÁN, ĐVT, "Bằng chữ", "VNĐ" ở tiêu đề cột, cỡ chữ 9,5pt) và `vi-en` song ngữ thật; dòng VAT giữ nguyên byte | trung bình (hiển thị tiền) | Q-1, Q-3, Q-4, L-19 |
| 5 | Dữ liệu thật cho văn bản vận hành: bỏ mọi fallback bịa (E-05), thiếu dữ liệu -> 422 + danh sách trường; `PAYMENT_REQUEST`/`PAYMENT_RECEIPT` theo mốc/`Payment` thật; `WARRANTY_CERT` dùng `policies.warrantyPeriodMonths` + ngày bắt đầu đúng; `PARTIAL_ACCEPTANCE` theo giá trị mốc | trung bình–cao | L-11, L-12, L-14, L-15, L-20 |
| 6 | DELIVERY_NOTE nối `StockIssue`/số lượng thực giao; hợp nhất hai biên bản nghiệm thu về `ACCEPTANCE_REPORT` có mốc + thanh toán (bỏ HTML cứng ở `contracts-pdf.service.ts`) | cao (thay đổi dữ liệu/schema) | L-12, L-13, L-18 |
| 7 | Đánh số mới (3.6): bảng/khoá duy nhất, khoá advisory, giữ số khi in lại, header = footer | cao (DB + số pháp lý) | L-10 |
| 8 | Hợp đồng, phụ lục, NDA: thư viện điều khoản có phiên bản (`templates/_clauses`), in VAT theo nhóm ở Điều giá trị, điều khoản song ngữ, đánh số Điều liên tục. Làm TỪNG ĐIỀU sau khi Henry duyệt | rất cao (pháp lý) | L-01…L-09, L-16, L-17 |
| 9 | Dọn: bỏ layout mặc định trùng trong `document-template-catalog.ts` cho loại pháp lý, khoá i18n không dùng, `loadForLiquidation` mồ côi; khoá variant editor trên loại pháp lý (Q-2) | thấp nhưng phụ thuộc bước 8 | Q-2 |

### 4.1 Danh sách thay đổi cấp điều khoản (mỗi dòng là MỘT mục duyệt riêng; chưa làm gì khi chưa tích)

| ID | Vị trí | Hiện tại | Đề xuất | Duyệt (Henry) |
|---|---|---|---|---|
| L-01 | CONTRACT + 9 biên bản: câu "Hôm nay, ngày …, tại …" | in thô `{{date}}/{{location}}` (bước 2 chỉ làm nó hiển thị đúng với ngày render + địa chỉ công ty) | đổi nguồn ngày thành `contract.signDate` (hoặc ngày lập nhập tay) và nơi ký có thể chọn | [ ] |
| L-02 | CONTRACT phần căn cứ | "Căn cứ BLDS 91/2015/QH13; Luật Thương mại 36/2005/QH11; Căn cứ theo nhu cầu và khả năng của hai bên" | bổ sung "Căn cứ báo giá số … / đề xuất …" nếu có; rà soát văn bản còn hiệu lực | [ ] |
| L-03 | CONTRACT Điều 2 | "Tổng giá trị hợp đồng: X (Bằng chữ: …). Đã bao gồm thuế GTGT và mọi chi phí liên quan." | in thêm VAT theo nhóm (KCT/8%/10%) từ `taxBreakdown`; câu "đã bao gồm" chỉ khi đúng thực tế dữ liệu | [ ] |
| L-04 | CONTRACT Điều 1 | "Bên A đồng ý mua và Bên B đồng ý bán hệ thống phần mềm (hoặc cung cấp dịch vụ) theo… dự án: {tên}" | "…thiết bị, phần mềm và dịch vụ theo Phụ lục 01 (danh mục hàng hóa)" kèm bảng hạng mục | [ ] |
| L-05 | CONTRACT Điều 3 | liệt kê "Lần n: tên – số tiền", TK nhận ở phần thông tin bên | thêm hạn thanh toán, kiểm tổng mốc = giá trị hợp đồng, lưu ý chứng từ/hóa đơn | [ ] |
| L-06 | CONTRACT Điều 4 | "bàn giao… từ {start} đến {end}. Tại địa chỉ của Bên A." | tách ngày giao hàng / lắp đặt / chạy thử, địa điểm cụ thể | [ ] |
| L-07 | CONTRACT Điều 5 | "bảo hành {n|12} tháng kể từ ngày ký biên bản nghiệm thu… lỗi thiết kế, lập trình trong 48h làm việc" | bảo hành phần cứng/phần mềm tách riêng, thống nhất mốc bắt đầu với Phiếu bảo hành | [ ] |
| L-08a…f | CONTRACT thiếu Điều 6–11 (nhãn có trong i18n, không có nội dung trong hbs) | không in | thêm: 6 quyền/nghĩa vụ Bên A; 7 Bên B; 8 phạt vi phạm/bồi thường; 9 bảo mật; 10 bất khả kháng; 11 giải quyết tranh chấp. Hoặc chuyển cả hợp đồng sang bộ 23 Điều chuẩn AHSO. Duyệt từng điều a…f | [ ] a [ ] b [ ] c [ ] d [ ] e [ ] f |
| L-09 | CONTRACT Điều 12 | "có hiệu lực kể từ ngày ký… 04 bản… mỗi bên giữ 02 bản" (nhảy từ Điều 5) | đánh số liên tục, giữ/đổi số bản | [ ] |
| L-10 | Số văn bản | `BBGH-HD-…/dd/mm/yyyy` + `GH-2026-ORION-001-v1` | sơ đồ ở 3.6 | [ ] |
| L-11 | DOC_HANDOVER / INSTALLATION / MAINTENANCE | danh mục và kết quả mẫu in sẵn | danh mục nhập tay; không có thì không xuất | [ ] |
| L-12 | ACCEPTANCE_REPORT câu xác nhận | "Hệ thống đáp ứng đầy đủ… nhất trí nghiệm thu bàn giao đưa vào sử dụng chính thức" luôn in | chọn kết luận Đạt / Đạt có điều kiện / Không đạt và in câu tương ứng; bỏ test case giả | [ ] |
| L-13 | Hai biên bản nghiệm thu | ACCEPTANCE_REPORT (hbs) và nghiệm thu D | một biên bản, có mốc + thanh toán + Bên A/Bên B | [ ] |
| L-14 | PAYMENT_REQUEST / RECEIPT | 30% hợp đồng khi thiếu dữ liệu; "Đã nhận đủ số tiền nêu trên"; hạn thanh toán = ngày lập | bắt buộc có mốc/Payment thật; hạn = ngày lập + `paymentDeadlineDays` | [ ] |
| L-15 | PARTIAL_ACCEPTANCE tỷ lệ; AR "Đã xuất hóa đơn", "Còn phải thu" | tỷ lệ = tiền hàng / giá trị HĐ (đã VAT); invoiced = giá trị HĐ | tỷ lệ theo giá trị mốc; đổi nhãn đúng nghĩa hoặc bỏ cột | [ ] |
| L-16 | NDA vai trò và thời hạn | A = AHSO (Bên tiết lộ), B = khách; "03 năm" cứng | A = khách, B = AHSO, bảo mật hai chiều; thời hạn lấy `policies.ndaDurationYears` | [ ] |
| L-17 | Hợp đồng `vi-en` | không có điều khoản ưu tiên ngôn ngữ | thêm "Bản tiếng Việt có giá trị ưu tiên khi có khác biệt" | [ ] |
| L-18 | DELIVERY_NOTE đoạn chất lượng | "Hàng hóa mới 100%, đúng quy cách, chủng loại và tiêu chuẩn kỹ thuật theo Hợp đồng." luôn in | cho phép ghi nhận tình trạng thực tế / chọn câu | [ ] |
| L-19 | Báo giá: câu mặc định | "Theo thỏa thuận trong hợp đồng kinh tế."; thiếu hiệu lực/ghi chú VAT | thêm mặc định: hiệu lực 30 ngày, giá chưa gồm phần ngoài danh mục, báo giá có thể điều chỉnh theo khảo sát (như mẫu 059) | [ ] |
| L-20 | WARRANTY_CERT | "hệ thống phần mềm… 12 tháng" cứng; điều kiện bảo hành loại trừ lỗi phần cứng/mạng khách | tham số hóa, tách thiết bị/phần mềm | [ ] |

### 4.2 Câu hỏi cho Henry (chặn bước tương ứng)

- Q-1: báo giá có cột VAT trong PDF (mẫu 059) hay không (spec hiện cấm)? Quyết định trước bước 4.
- Q-2: còn cho phép sửa bố cục văn bản pháp lý bằng variant editor (đường ống C) không?
- Q-3: báo giá `vi-en` là song ngữ VI+EN (đề xuất) hay chỉ-EN như hiện nay (khi đó thêm ngôn ngữ `en`)?
- Q-4: màu thương hiệu: `#073A66` (mẫu 059) hay `#1A5276` (code hiện tại)?
- Q-5: tiền tố đề xuất: `DX-` (code) hay `AHSO-` (mẫu 059)?
- Q-6: bằng chữ có thêm "chẵn" không ("Tám mươi tám triệu bốn trăm mười nghìn đồng chẵn")?
- Q-7: văn bản pháp lý do AHSO phát hành (đề nghị thanh toán, phiếu thu, đối chiếu công nợ) có dùng letterhead logo + thông tin công ty không (hiện chỉ có Quốc hiệu)?

## 5. Kế hoạch kiểm thử

### 5.1 Hiện có (và mở rộng)

| Spec hiện có | Phủ | Mở rộng đề xuất |
|---|---|---|
| `quotation-flow-html-renderer.service.spec.ts` (8 test: bảng, colgroup, CSS lặp thead, nhóm VAT, KCT, nhiều nhóm) | VAT tốt | snapshot toàn HTML với fixture BG-2026-059; `vi-en` có đủ VI+EN; có "Bằng chữ"; không `undefined`; chân trang `Trang x / y` |
| `helpers/quote-tax-breakdown.spec.ts` | nhóm, làm tròn nhóm, KCT vs 0% | thêm bất biến Σ base/tax; ca 8,00 vs 8 |
| `document-data-loader.service.spec.ts` (3 test VAT hợp đồng) | VAT hợp đồng | loader giao hàng/nghiệm thu/đề nghị TT/phiếu thu/đối chiếu với mock thuần: không còn fallback bịa; thiếu dữ liệu -> lỗi có tên trường |
| `documents.service.spec.ts` (render 1 lần, tải) | luồng render | `it.each` mọi loại × {vi, vi-en} render HTML từ hbs thật; số văn bản ổn định khi in lại; `extra` không ghi đè `company/logo` |
| `pdf-renderer.service.spec.ts` | mock `execFile` | thêm test tích hợp tuỳ chọn (bỏ qua khi không có `weasyprint`) |
| `document-layout-renderer.service.spec.ts`, `document-template-variants.service.spec.ts` | layout tuyệt đối, variant | variant bị từ chối trên loại pháp lý (Q-2) |
| KHÔNG có spec | helper `currency/date/number-to-words`, `i18n`, hbs, `DocumentNumberService`, `ContractsPdfService` | xem 5.2 |

### 5.2 Test mới

- `helpers/number-to-words.spec.ts`, `format-currency.spec.ts`, `format-date.spec.ts`: bảng ca (0, 15, 21, 101, 1005, 1.050.000, 1e9+5, 1e12 không ném, lẻ làm tròn khớp số hiển thị, null/NaN -> "—"), ngày với `TZ=UTC` và `TZ=Asia/Ho_Chi_Minh` (20/10 00:00 ICT phải ra 20/10).
- `i18n.keys.spec.ts`: quét mọi `{{t "…"}}`, khoá phải có ở vi và en, vi và en cùng bộ khoá, không khoá trùng, khoá chứa `{{x}}` phải được gọi với tham số `x`.
- `templates.render.spec.ts` (golden): fixture đầy đủ + fixture tối thiểu (không người liên hệ, không hạng mục, MST công ty chỉ `taxId`) × {vi, vi-en} × 16 loại, ghim `TZ=Asia/Ho_Chi_Minh`, `generatedAt` và `docNumber` cố định; snapshot HTML (bỏ CSS bundle); khẳng định cấm: `{{`, `undefined`, `null`, `NaN`, `[object`, `DOCUMENT_TITLE_`, "đồng đồng", "0 VND" cho giá trị thiếu, chuỗi EN lặp liền kề; khẳng định phải có: MST công ty, "Bằng chữ", số hiệu, nhãn Bên A/Bên B theo bảng 3.3, dòng VAT theo nhóm.
- Test tiền phải FAIL khi logic hỏng (CLAUDE.md): `totals-block` so với `buildQuoteTotals`; đổi `Math.round` theo nhóm thành theo dòng phải làm test đỏ.
- `document-number.service.spec.ts`: không trùng khi gọi song song (`P2002` retry), in lại giữ số, `-vN` chỉ khi đổi nội dung.
- `clauses.hash.spec.ts`: băm từng file điều khoản cố định; đổi nội dung mà không tăng phiên bản/changelog là test đỏ.
- `render-check` (CI, container có WeasyPrint, không chạy ở máy dev): xuất PDF từ fixtures; `pdfinfo` số trang <= baseline; `pdffonts` mọi font `emb=yes uni=yes`; `pdftotext` chứa chuỗi bắt buộc và không chứa chuỗi cấm; tuỳ chọn `pdftoppm` + so điểm ảnh ngưỡng 0,5% (chạy hằng đêm, không chặn merge).
- Lệnh: `cd backend && npx jest --runInBand src/documents` rồi `npm run typecheck && npm run lint && npm test`; thay snapshot chỉ qua `-u` và phải review diff trong PR (đặc biệt phần pháp lý).

## 6. Danh sách file theo bước

| Bước | File (đường dẫn từ `backend/src/documents/`) |
|---|---|
| 0 | MỚI: `__fixtures__/*.ts` (ngữ cảnh đầy đủ/tối thiểu), `templates.render.spec.ts`, `i18n.keys.spec.ts`, `helpers/*.spec.ts`; script CI `scripts/render-check.sh` (ngoài `documents/`) |
| 1 | `templates/styles/base.css`, `classic.css`, `modern.css`; `templates/_partials/footer-page.hbs`; `i18n/vi.json`, `i18n/en.json`; `templates/AR_RECONCILIATION/{vi,vi-en}.hbs`, `PAYMENT_REQUEST/{vi,vi-en}.hbs`, `PAYMENT_RECEIPT/{vi,vi-en}.hbs`, `DELIVERY_NOTE`, `ACCEPTANCE_REPORT`, `PARTIAL_ACCEPTANCE` (chỉ thuộc tính CSS inline lỗi) |
| 2 | `helpers/bilingual.ts`, `helpers/format-currency.ts`, `helpers/format-date.ts`, `helpers/number-to-words.ts`, `helpers/index.ts`; `document-data-loader.service.ts` (`loadBaseContext`); `documents.service.ts` (`buildRenderContext`); `dto/render-document.dto.ts`; `docker-compose*.yml` + `backend/Dockerfile` (`TZ`) |
| 3 | `templates/_partials/*` (thêm `letterhead`, `party-block`, `doc-footer`), `templates/styles/tokens.css` (mới) + các CSS hiện có; `templates/SURVEY_REPORT`, `PROPOSAL`, `DOC_HANDOVER`, `INSTALLATION_REPORT`, `MAINTENANCE_RECORD`, `WARRANTY_CERT` (`vi`, `vi-en`); XÓA `templates/QUOTATION/*.hbs` |
| 4 | `quotation-flow-html-renderer.service.ts` (+ `.spec.ts`), kit dùng chung (mới: `document-kit/*.ts`), `quotes/quotes-pdf.service.ts` (không đổi logic) |
| 5 | `document-data-loader.service.ts` (`loadForAcceptanceReport`, `loadForPartialAcceptance`, `loadForWarrantyCert`, `loadForPaymentRequest`, `loadForPaymentReceipt`, `loadForDocHandover`, `loadForInstallationReport`, `loadForMaintenanceRecord`, `loadForContractAddendum`), các hbs tương ứng, `i18n/*.json`, `document-data-loader.service.spec.ts` |
| 6 | `document-data-loader.service.ts` (`loadForDeliveryNote`, hợp nhất nghiệm thu), `templates/DELIVERY_NOTE`, `templates/ACCEPTANCE_REPORT`, `../contracts/contracts-pdf.service.ts` (+ nơi gọi trong `contracts.controller.ts`), `../frontend/.../contract-acceptance-preview-client.tsx`; có thể cần `prisma/schema.prisma` + migration (bản ghi giao hàng/nghiệm thu) |
| 7 | `document-number.service.ts`, `documents.service.ts` (`renderPdf`), `prisma/schema.prisma` + migration (khoá duy nhất `Document`), mọi `templates/*/vi*.hbs` dòng `doc_number` |
| 8 | MỚI: `templates/_clauses/*`; `templates/CONTRACT/*`, `CONTRACT_ADDENDUM/*`, `NDA/*`; `i18n/*.json` (điều khoản); `document-data-loader.service.ts` (`loadContractOrQuoteReference`: truyền `taxBreakdown`, `signDate`); `document-template-catalog.ts` (đồng bộ hoặc bỏ layout trùng) |
| 9 | `document-template-catalog.ts`, `document-template.types.ts` (`TEMPLATE_EDITOR_TYPES`), `document-template-variants.service.ts`, `template-registry.ts` (nhãn), `i18n/*.json` (khoá không dùng), `document-data-loader.service.ts` (`loadForLiquidation`) |

## Phụ lục A — Bằng chứng render (ngoài repo, trong VM cloud)

`/tmp/doc-samples/` gồm `*.html` (30 file + ca `_edge` + `QUOTATION_long.vi.html`), `pdf/*.pdf`, `png/*.png` (bản xem tổng hợp `png/sheet_*.png`). Số trang khi render: báo giá 1 (28 dòng: 4); hợp đồng vi 2 / vi-en 4; giao hàng vi 2 / vi-en 3; nghiệm thu vi 2 / vi-en 3; đề nghị thanh toán 2 (trang 2 trống); phiếu thu 1; đối chiếu công nợ 2.

## Phụ lục B — Chưa làm / ngoài phạm vi

- Chưa audit frontend `quote-preview-client.tsx` và `contract-acceptance-preview-client.tsx` (hai bản in trình duyệt), `BusinessDocument`, bộ chọn mẫu và quyền `documents.*`.
- Chưa chạy được WeasyPrint đúng phiên bản production; font thay thế (Liberation/DejaVu) nên khoảng cách dòng/ngắt trang thật có thể lệch nhẹ.
- Không kiểm tra e2e `scripts/test-documents-v1.sh` với stack thật.
