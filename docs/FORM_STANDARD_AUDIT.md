# Audit form frontend AHSO CRM — hướng tới chuẩn form thống nhất

Phạm vi: `frontend/app`, `frontend/components` (chỉ đọc, không sửa code). Số liệu lấy bằng grep + đọc mẫu, ký hiệu `~` = ước lượng.

## 0. Primitive hiện có

| Có | Ghi chú |
|---|---|
| `ui/form.tsx` (shadcn: Form, FormField, FormItem, FormLabel, FormControl, FormMessage) | Chỉ 3 nơi dùng: `activity-form-screen`, `survey-form-screen`, `survey-notes-section`. Không có dấu `*` tự động |
| `ui/input`, `ui/textarea`, `ui/label`, `ui/select`, `ui/dialog`, `ui/sheet`, `ui/alert-dialog`, `ui/checkbox` | `ui/select` là wrapper của `<select>` native. `ui/dialog` tự viết, KHÔNG portal (phải render dialog ngoài `<form>`) |
| `contracts/_components/form-primitives.tsx` (Field, Label, ErrorText) | Chỉ 3 file contracts dùng |
| `lib/format.ts` (`formatVND`, `formatDate`...) | Chỉ để hiển thị, không có parse/format khi nhập |
| Hai hệ toast: `@/hooks/use-toast` (~55 file) và `sonner` (~15 file) | Cả hai cùng được mount |

Bản sao cục bộ `Field/Label/ErrorText` (copy-paste, khác nhau chút ít): customer-form, contact-manager, material-form, supplier-form, quote-form, project-form, receipts, issues, transfers, counts, warehouses, custom-fields (12 bản). `FieldError`: company-form, role-form, policy-editor, notification-form (4 bản). Login/reset/users/project-cost/quick-create tự viết `<label>`/`<p>` lặp.

## 1. Bảng form × thuộc tính

Chú giải: Layout P=trang, D=dialog, I=panel inline, A=auth. Dấu `*` = hậu tố " *" trong text; `*span` = `<span class=text-danger>*</span>`; `*prop` = `Label required`. Lỗi: `ET`=ErrorText xs; `FM`=FormMessage; `p-sm`=`<p text-sm text-danger>`; `FE`=FieldError. Giá trị cột Tiền: `num`=`type=number step=1` không phân tách nghìn.

| Form (file) | Layout / section | Nhãn bắt buộc | Placeholder | Lỗi | Select / Date | Tiền/số | Nút (nhãn, vị trí) | Loading | Guard thoát | Toast / lỗi API | Enter / autofocus |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Khách hàng `customers/.../customer-form-screen` | P, lưới 2 cột `1.2fr/0.8fr`, Card 4 mục, rail phải | `*span` | nhiều (14) | ET xs | ui/Select; — | — | "Tạo khách hàng"/"Lưu…" (rail phải, h-11 rounded-xl, icon mũi tên); Hủy = Link outline đầu trang | "Đang tạo khách hàng..." | Không (chỉ confirm xóa) | Không toast; banner lỗi + `router.push` | Có Enter; không autofocus |
| Liên hệ `customers/.../contact-manager` | I (form thu gọn trong card) | `*` text | có | ET | text | — | "Lưu"/submitLabel + "Hủy" ghost (trái, cạnh nhau) | "Đang lưu..." | confirm xóa | không rõ | — |
| Quick-create KH `shared/customer-quick-create-dialog` | D, `sm:max-w-md` | `*` text ("Tên khách hàng *") | có | `<p xs>` | —; — | — | Hủy ghost + "Tạo khách hàng" (type=button + onClick, phải) | "Đang tạo..." | Esc/overlay đóng không hỏi | `useToast` | autoFocus có; Enter KHÔNG submit (type=button) |
| Dự án `projects/.../project-form-screen` | P, như KH, 3 Card + rail | `*` text ("...bán ra *") | 4 | ET | ui/Select; date x4 | `num`, `setValueAs`→undefined | "Tạo dự án"/"Lưu thay đổi" trong Card rail phải | "Đang lưu..." | Không | banner + push | Enter có |
| Chi phí dự án (tiền!) `project-finance/project-cost-dialog` | D, `max-w-2xl`, `noValidate` | **không dấu * ở nhãn nào** | 0 | `<p xs>` | ui/Select; date | `num` ₫ trước VAT, vat `step=0.1`, không setValueAs | "Đóng" outline + "Lưu chi phí" (phải) | `isBusy`, nhãn KHÔNG đổi | Không | `use-toast` "Đã thêm chi phí trực tiếp." | — |
| Báo giá (tiền!) `quotes/.../quote-form-screen` | P, `xl:[1fr_340px]`, Card nền `border-0 bg-bg-card`, rail tổng hợp | `*` text | 4 | ET | ui/Select + native `<option>` BOM; date; | `num`/`inputMode=decimal` trong bảng dòng; Enter ở ô giá bị chặn | "Tạo/Cập nhật báo giá" rail phải; Hủy = Link | "Đang tạo báo giá..." / "Đang cập nhật báo giá..." | có `isDirty` (chỉ để prefill điều khoản, KHÔNG guard) | banner + push | Enter chặn ở bảng dòng |
| Hợp đồng (tiền!) `contracts/.../contract-form-screen` | P, như dự án | dùng `form-primitives` (không dấu * tự động; text) | 2 | ET (bản contracts) | ui/Select; date x3 | `num`, `setValueAs`→0 (rỗng thành 0!) | "Tạo/Cập nhật hợp đồng" rail phải | "Đang tạo hợp đồng..." | Không | banner + push | — |
| Mốc HĐ `contract-milestone-manager` | I, nút phải (`justify-end`) | text | 3 | ET | ui/Select; date | `num` | "Thêm mốc"/"Cập nhật mốc" (variant khác nhau: default vs outline) | "Đang lưu..." / "Đang cập nhật..." | — | — | — |
| Thanh toán HĐ (tiền!) `contract-payment-manager` | I, nút phải | text | 3 | ET | —; date | `num` step=1, rỗng→0 | "Ghi nhận thanh toán" | "Đang ghi nhận..." | — | — | — |
| Hoạt động `activities/.../activity-form-screen` | P, 1 Card dọc `space-y-6`, nút "Quay lại" ghost trên | `*` text (FormLabel "…*") | 5 | **FM** (shadcn) | ui/Select; `datetime-local` | — | Hủy outline + submit (phải, màu `bg-primary-mid` riêng) | `isLoading` | Không | `use-toast` trong hook | Enter có |
| Khảo sát `surveys/.../survey-form-screen` | P, 1 Card `space-y-5` | `*` text, FormLabel | 8 | **FM** | ui/Select; date | — | Hủy outline + "Tạo khảo sát"/"Cập nhật" (`bg-primary` riêng) | "Đang lưu..." | Không | hook | Enter có |
| Ghi chú KS `survey-notes-section` | I | không | 1 | FM | — | — | "Lưu ghi chú" sm, phải | "Đang lưu..." | — | — | — |
| Task | KHÔNG có form riêng; chỉ `dashboard/task-checklist` + tab dự án (không dùng react-hook-form) | — | — | — | — | — | — | — | — | — | — |
| Vật tư `materials/.../material-form-screen` | P, 1 Card `border-0 bg-bg-card`, lưới 2 cột | `Label required` (*span, bản cục bộ) | 6 | ET | ui/Select; — | `num` x3 (giá bán/vốn/tồn tối thiểu) | Hủy + "Thêm vật tư"/"Lưu thay đổi" (variant="primary") | "Đang lưu..." | Không | **sonner** "Đã thêm vật tư thành công." / "Không thể thêm vật tư." (không dùng getApiErrorMessage) | Enter có |
| NCC `suppliers/.../supplier-form-screen` | P, như vật tư | `Label required` | 8 | ET | text | — | "Thêm nhà cung cấp"/"Lưu thay đổi" | "Đang lưu..." | Không | **sonner**, có getApiErrorMessage | Enter có |
| Kho `inventory/warehouses/...` | P, `max-w-2xl` 1 Card | `*` text ("Mã kho *") | 4 | ET | ui/Select; — | — | "Tạo/Lưu" h-11 rounded-xl + icon | "Đang tạo..."/"Đang lưu..." | Không | hook | Enter có |
| Phiếu nhập `inventory/receipts/...` | P, `xl:[1fr_300px]`, rail dính | `*` text | 2 | ET | **native `<select>` + `<option>` "Đang tải..."**; date | số lượng/đơn giá, tổng = `Math.round(q*p)` | nút full-width trong rail, h-11 | "Đang tạo..." | Không | hook | — |
| Phiếu xuất / chuyển / kiểm kê (3 file giống nhau) | P, như nhập | `*` text ("Kho xuất *", "Kho nguồn *"...) | 1-3 | ET | **native option** "Chọn kho..." | xuất: tổng giống nhập | như nhập | như nhập | Không | hook | — |
| Người dùng `users/.../users-client` | Panel bên phải (I) tạo/sửa chung file 847 dòng | không dấu *; text | 3 | `<p text-sm>` | ui/Select | — | "Tạo người dùng"+icon plus / "Lưu thay đổi"+mũi tên; Hủy outline | "Đang tạo..."/"Đang lưu..." | Không | hook | — |
| Vai trò `admin/roles/role-form` | P | không | 0 | FE | — | — | "Tạo role"/"Lưu thay đổi" + "Xoá role" ("Xoá" khác "Xóa") | "Đang lưu..." | Không | — | — |
| Công ty `admin/company-info` | P, mục "Bank Details" (tiếng Anh) | không | 6 | FE | — | — | "Lưu thông tin công ty" phải | "Đang lưu..." | Không | — | — |
| Chính sách / Thông báo / Custom-field (admin) | P | không / Label | 0-3 | FE / ET | native `<select>` (thông báo) | num | "Lưu chính sách", "Lưu cài đặt" (disabled khi `!isDirty` — chỉ nơi này), "Tạo trường" | "Đang lưu..." | chỉ doc-template có `isDirty` | — | — |
| Cài đặt email `settings/email` | P | — | — | — | — | — | — | — | — | sonner | — |
| Tài liệu `documents/.../document-upload-dialog` | Dialog tự dựng (h2 tay, không dùng `ui/dialog`) | `*span` | 3 | — | ui/Select; date | — | "Lưu tài liệu" (variant primary) | "Đang lưu..." | Không | hook | — |
| Đăng nhập `(auth)/login` | A, thẻ nhập, nút h-12 rounded-xl full | không (cả 2 trường bắt buộc, không dấu) | "ten@ahso.vn" | `<p text-sm>` | — | — | "Vào dashboard" (icon phải) | "Đang xác thực..." | — | khung lỗi `rounded-2xl` | autoComplete có |
| Quên MK `(auth)/forgot-password` | A | không | 1 | `<p text-sm>` | — | — | "Gửi hướng dẫn khôi phục" (icon mail trái) | "Đang gửi yêu cầu..." | — | khung lỗi `rounded-xl` | — |
| Đặt lại MK `(auth)/reset-password` | A | không | "••••••••" | `<p text-sm>` | — | — | "Cập nhật mật khẩu" | "Đang cập nhật..." | — | khung lỗi `rounded-xl`, thành công = text | — |

Ghi chú toàn cục: không có form nào bật guard rời trang chưa lưu (0 `beforeunload`/`useBlocker`); không form nào autofocus ngoài quick-create; không có component nhập tiền/ngày chung.

## 2. Top 10 bất nhất theo tác động người dùng

1. **Ô tiền là `type=number`** không phân tách nghìn; cuộn chuột đổi giá trị; rỗng bị ép về 0 (hợp đồng, thanh toán) nhưng `undefined` (dự án). Dễ nhập sai bậc 1000 ở tiền. Cao nhất.
2. **Không có guard rời trang/đóng dialog khi chưa lưu**: báo giá/hợp đồng/dự án mất dữ liệu khi back/Esc/click overlay.
3. **Dấu bắt buộc không đồng nhất**: `*span` đỏ, " *" nối chuỗi, `Label required`, hoặc không có (chi phí, user, auth, role, công ty). Người dùng không biết trường nào bắt buộc.
4. **Hai hệ toast** (`use-toast` vs `sonner`) và nhiều form không toast mà chỉ `router.push`; văn bản thành công/thất bại mỗi nơi một kiểu ("Đã thêm vật tư thành công." vs "Đã cập nhật chi phí."); sonner không dùng `getApiErrorMessage`.
5. **Vị trí/nhãn nút**: rail phải (KH, dự án, báo giá), cuối form phải (vật tư, NCC, role), full-width (nhập/xuất kho); Hủy là Link, nút ghost, hoặc không có; "Hủy"/"Huỷ"/"Đóng"/"Quay lại"; "Xóa"/"Xoá"; nhãn loading có nơi đổi có nơi không (chi phí).
6. **Lỗi nhập**: ErrorText xs vs `<p text-sm>` vs FormMessage vs FieldError; dialog tạo nhanh không hiển thị lỗi SĐT; lỗi cấp form (banner) khác kiểu giữa auth (`rounded-2xl` vs `rounded-xl`) và các màn khác.
7. **Select**: `ui/Select` (native bọc) vs `<select>` thô với option "Đang tải..." (phiếu kho); không có combobox cho danh sách dài ở kho/NCC (có `entity-combobox` nhưng không dùng ở đây).
8. **Ngày**: `type=date` khắp nơi nhưng hoạt động dùng `datetime-local`; hiển thị `formatDate` dd/MM còn input theo locale trình duyệt; message "Ngày không hợp lệ" vs "Ngày thanh toán không hợp lệ" vs "Ngày hiệu lực không hợp lệ".
9. **Thông điệp validation Vietnamese**: "X là bắt buộc" (KH, dự án, vật tư) vs "Chọn khách hàng" (khảo sát) vs "Vai trò không được để trống" (user) vs "Vui lòng xác nhận mật khẩu"; "Mật khẩu xác nhận không khớp" vs "Xác nhận mật khẩu không khớp"; còn tiếng Anh ("Bank Details", "role").
10. **Layout/spacing/độ rộng**: Card `border-white/70` vs `border-0 bg-bg-card`; lưới `1.2fr/0.8fr` vs `1fr/340px` vs `1fr/300px` vs `max-w-2xl`; gap-4/5/6; nút `h-11 rounded-xl` vs mặc định; màu nút riêng (`bg-primary-mid`, `bg-primary`) ở hoạt động/khảo sát; quick-create Enter không submit; 12 bản sao Field/Label/ErrorText.

## 3. Chuẩn đề xuất

**Layout**: trang tạo/sửa = `FormPage` một cột chính + (tùy chọn) rail phải 320px chỉ chứa tóm tắt/tổng tiền; Card `border border-border bg-bg-card`; mỗi section `FormSection` (tiêu đề h2 + mô tả ngắn). Lưới trường `grid gap-4 md:grid-cols-2`, trường dài `md:col-span-2`. Dialog dùng cho form <= 6 trường (`max-w-lg`, 2 cột `max-w-2xl`); > 6 trường hoặc có bảng dòng = trang. Auth giữ riêng nhưng dùng cùng `FormField`.

**Nhãn**: Vietnamese, sentence case, không dấu hai chấm; bắt buộc = ` *` đỏ (`text-danger`, `aria-hidden`) do `FormField required` tự thêm, và `aria-required`. Trường tùy chọn không ghi "(tùy chọn)". Placeholder chỉ là ví dụ định dạng, không lặp nhãn.

**Lỗi**: dưới trường, `text-xs text-danger`, `role="alert"`, gắn `aria-describedby`; lỗi cấp form = `FormError` banner trên nút. Scroll + focus tới trường lỗi đầu tiên khi submit sai.

**Bản đồ thông điệp chuẩn** (`lib/validation-messages.ts`): `required(label)` -> "{label} là bắt buộc"; `select(label)` -> "Vui lòng chọn {label}"; `email` -> "Email không hợp lệ"; `phone` -> "Số điện thoại không hợp lệ"; `url` -> "Đường dẫn không hợp lệ"; `date` -> "Ngày không hợp lệ"; `dateAfter(a,b)` -> "{b} phải sau hoặc bằng {a}"; `min(label,n)` -> "{label} phải từ {n} trở lên"; `maxLen(label,n)` -> "{label} tối đa {n} ký tự"; `money` -> "Số tiền phải lớn hơn hoặc bằng 0"; `passwordMin` -> "Mật khẩu phải có ít nhất 8 ký tự"; `passwordMatch` -> "Mật khẩu xác nhận không khớp". Dùng "Xóa", "Hủy" (kiểu có dấu hỏi) thống nhất.

**Nút (`FormActions`)**: hàng cuối form, căn phải, thứ tự `[Hủy (outline)] [Hành động chính (primary)]`; chính ở bên phải. Nhãn: tạo = "Tạo {đối tượng}", sửa = "Lưu thay đổi"; loading = giữ nhãn + spinner + disabled ("Đang lưu..."). Hủy luôn có (Link/`router.back()` trang, đóng dialog). Trang dài: thanh dính dưới (`sticky bottom-0`). Không màu nút riêng.

**Toast (chỉ sonner)**: thành công "Đã tạo {đối tượng}." / "Đã cập nhật {đối tượng}." / "Đã xóa {đối tượng}."; thất bại `toast.error(getApiErrorMessage(err, "Không thể {hành động} {đối tượng}."))`. Gói trong `useFormToast(entityLabel)`. Phase sau gỡ `use-toast` dần.

**Phím/UX**: Enter submit (không dùng `type=button+onClick` để submit); autofocus trường đầu khi mở dialog/trang tạo; Enter trong ô của bảng dòng không submit (giữ nguyên hành vi quote-items); guard `useUnsavedChangesGuard(isDirty)` (beforeunload + chặn điều hướng + xác nhận khi đóng dialog).

**Component cần thêm** (`components/ui/` hoặc `components/form/`):

| Tên | Props chính | Thay thế |
|---|---|---|
| `FormField` (wrapper RHF-free) | `label, required, hint, error, htmlFor, children` (bọc Label+control+ErrorText+aria) | 12 bản Field/Label/ErrorText, FieldError, label tay ở auth/users/cost dialog |
| `FormSection` | `title, description, aside?, children, columns?: 1\|2` | Card+CardHeader+CardTitle lặp |
| `FormActions` | `onCancel \| cancelHref, submitLabel, isSubmitting, disabled, sticky?, extra?` | ~25 khối nút |
| `FormError` | `message` | banner lỗi mỗi nơi một kiểu |
| `MoneyInput` | `value:number\|null, onChange(number\|null), currency="VND", min=0, allowEmptyAsNull` — hiển thị `1.234.567`, lưu số nguyên, `inputMode=numeric`, tắt wheel; dùng với `Controller` | mọi ô tiền `type=number` |
| `NumberInput` | `value, onChange, min, max, step, decimals` | số lượng, VAT %, tồn tối thiểu |
| `DateInput` | `value:"YYYY-MM-DD"`, `onChange`, `min/max`, `withTime?` | `type=date`/`datetime-local` rải rác |
| `SelectField` | bọc `ui/Select` với `placeholder`, `loading` (không còn `<option>Đang tải...`) | native select thô |
| `ConfirmDiscardDialog` + `useUnsavedChangesGuard` | `isDirty` | không có |
| `useFormToast`, `lib/validation-messages.ts` | như trên | hai hệ toast, message lệch |
| `FormDialog` (bọc ui/dialog) | `title, description, size, onSubmit, submitLabel, ...` kèm FormActions + guard | dialog tay |

## 4. Thứ tự migrate (ít rủi ro -> nhiều)

Nguyên tắc: mỗi bước một PR nhỏ, có test hiện có chạy xanh (`npm run typecheck && lint && test:unit`, E2E khi đụng luồng); component mới thêm trước, chưa thay form nào ở bước 0.

0. **Nền tảng** (không đổi hành vi): thêm primitives + `validation-messages` + `useFormToast` + test đơn vị.
1. **Auth** (login, forgot, reset): rủi ro thấp, ít trường; kiểm tra autoComplete, E2E login giữ nguyên.
2. **Admin/settings**: company-info, policy-editor, notification-form, role-form, custom-fields, settings/email.
3. **Danh mục tham chiếu**: kho, NCC, vật tư (nhưng giá bán/giá vốn dùng `MoneyInput` — kiểm tra giá trị gửi API không đổi), người dùng (tách file 847 dòng).
4. **Hoạt động, khảo sát, ghi chú KS, liên hệ, tạo nhanh KH, tài liệu**.
5. **Khách hàng, dự án** (dự án có `estimatedValue` -> `MoneyInput`, giữ `undefined` khi rỗng như cũ).
6. **Phiếu kho**: nhập, xuất, chuyển, kiểm kê (có tính tổng `Math.round(q*p)`: chỉ đổi giao diện, không đổi công thức).
7. **Tiền — CUỐI CÙNG, từng form một**: chi phí dự án (cost-dialog), thanh toán HĐ, mốc HĐ, hợp đồng, báo giá.

**Quy tắc cho nhóm 7 (bắt buộc)**: KHÔNG đụng logic tổng tiền/VAT/công nợ (`quote-items-table`, tính subtotal/tax/total, `lib/vat.ts`, schema `form-schemas.ts` phần số tiền, payload gửi API). Chỉ thay lớp vỏ (Field/Section/Actions/Toast/Guard). `MoneyInput` chỉ được áp sau khi có test khẳng định: cùng chuỗi nhập -> cùng số gửi API như `type=number` hiện tại (gồm rỗng, 0, số thập phân VAT, số lớn 1e10). Mọi thay đổi chạm tổng tiền/thanh toán phải có test đỏ khi logic hỏng (CLAUDE.md). Chạy E2E tạo báo giá/hợp đồng/ghi nhận thanh toán trên Docker stack trước khi merge; ghi chú rollback = revert PR từng form.

## 5. File dự kiến theo bước

- **Bước 0**: thêm `components/form/{form-field,form-section,form-actions,form-error,money-input,number-input,date-input,select-field,form-dialog,confirm-discard-dialog}.tsx`, `hooks/use-unsaved-changes-guard.ts`, `hooks/use-form-toast.ts`, `lib/validation-messages.ts` (+ test `*.test.tsx`). ~13 file mới.
- **Bước 1**: `app/(auth)/{login,forgot-password,reset-password}/page.tsx` (3).
- **Bước 2**: `admin/company-info/_components/company-form.tsx`, `admin/policies/_components/policy-editor.tsx`, `admin/notifications/_components/notification-form.tsx`, `admin/roles/_components/role-form.tsx`, `admin/custom-fields/page.tsx`, `settings/email/page.tsx` (6).
- **Bước 3**: `inventory/warehouses/_components/warehouse-form-screen.tsx`, `suppliers/_components/{supplier-form-screen,form-schemas}.ts*`, `materials/_components/{material-form-screen,form-schemas}.ts*`, `users/_components/users-client.tsx` (+ tách file mới) (~7).
- **Bước 4**: `activities/_components/{activity-form-screen,form-schemas}`, `surveys/_components/{survey-form-screen,survey-notes-section,form-schemas}`, `customers/_components/contact-manager.tsx`, `components/shared/customer-quick-create-dialog.tsx`, `documents/_components/document-upload-dialog.tsx` (~9).
- **Bước 5**: `customers/_components/{customer-form-screen,form-schemas}`, `projects/_components/{project-form-screen,form-schemas}` (4).
- **Bước 6**: `inventory/{receipts,issues,transfers,counts}/_components/*-form-screen.tsx` (4).
- **Bước 7**: `projects/_components/project-finance/project-cost-dialog.tsx`, `contracts/_components/{contract-payment-manager,contract-milestone-manager,contract-form-screen,form-primitives(xóa),form-schemas}`, `quotes/_components/{quote-form-screen,quote-items-table(chỉ vỏ),form-schemas}` (~9).
- **Dọn cuối**: xóa các `Field/Label/ErrorText/FieldError` cục bộ, `form-primitives.tsx`; chuyển `use-toast` -> sonner dần (~55 file, PR riêng).
- **Cũng ngoài phạm vi form nhưng liên quan**: `components/ui/dialog.tsx` (thiếu portal/focus trap/aria-modal) nên sửa riêng trước bước `FormDialog`.
