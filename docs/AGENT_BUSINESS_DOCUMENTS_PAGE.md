# Agent Task: Trang quản lý Business Documents

## Mục tiêu
Xây dựng trang `/documents` (Hồ sơ tài liệu) — nơi xem và quản lý toàn bộ tài liệu thực tế trong vòng đời hợp đồng: file scan, hợp đồng đã ký, biên bản nghiệm thu, hóa đơn, v.v.

---

## Đọc trước khi làm

1. **`CLAUDE.md`** — quy tắc bắt buộc: font, color token, naming, no `any`, no hardcode hex
2. **`AHSO-CRM-PROJECT_STRUCTURE.md`** — cấu trúc thư mục, pattern code
3. Đọc các file tham chiếu bên dưới trước khi viết bất kỳ dòng code nào

---

## Hiện trạng — đã có sẵn (KHÔNG làm lại)

### Backend (KHÔNG sửa gì)
File `backend/src/business-documents/business-documents.controller.ts` có các endpoint:
- `POST /api/business-documents` — tạo record
- `PATCH /api/business-documents/:id` — cập nhật
- `DELETE /api/business-documents/:id` — xóa
- `POST /api/business-documents/:id/file` — upload file
- `GET /api/business-documents/:id/file` — download/preview file
- `POST /api/business-documents/:id/mark-signed` — đánh dấu đã ký
- `POST /api/business-documents/:id/supersede` — thay thế bằng phiên bản mới

**Chưa có endpoint GET list toàn bộ** — cần thêm `GET /api/business-documents` vào backend.

### Frontend — đã có
- Hook: `frontend/hooks/use-business-documents.ts` — có `useCreateBusinessDocument`, `useUploadBusinessDocumentFile`, `useMarkBusinessDocumentSigned`, `useUpdateBusinessDocument`, `useArchiveBusinessDocument`
- Types: `frontend/lib/types.ts` — `BusinessDocument`, `BusinessDocumentType`, `BusinessDocumentSource`, `BusinessDocumentStatus`, `BusinessDocumentCreateInput`
- Nút "Tạo tài liệu" đã có trên trang chi tiết Project — trang mới này là view riêng

---

## Việc cần làm

### Phần 1 — Backend: thêm GET list endpoint

**File:** `backend/src/business-documents/business-documents.service.ts`

Thêm method `findAll(query, user)` với:
- Filter: `type`, `status`, `source`, `customerId`, `projectId`, `search` (tìm theo `title`, `documentNo`)
- Phân trang: `page`, `limit` (default 20)
- Sort: `createdAt DESC`
- STAFF chỉ thấy tài liệu thuộc project mà họ được assign
- Trả về `{ items, total, page, limit, totalPages }`

**File:** `backend/src/business-documents/business-documents.controller.ts`

Thêm endpoint:
```typescript
@RequirePermissions("documents.view")
@ApiOperation({ summary: "GET /api/business-documents" })
@Get()
findAll(@Query() query: ListBusinessDocumentsDto, @CurrentUser() user: JwtUser) {
  return this.businessDocumentsService.findAll(query, user);
}
```

**File:** `backend/src/business-documents/dto/business-document.dto.ts`

Thêm `listBusinessDocumentsSchema` (Zod) + `ListBusinessDocumentsDto`:
```typescript
export const listBusinessDocumentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: businessDocumentTypeSchema.optional(),
  status: businessDocumentStatusSchema.optional(),
  source: businessDocumentSourceSchema.optional(),
  customerId: optionalString(80),
  projectId: optionalString(80),
  search: optionalString(200),
});
```

---

### Phần 2 — Frontend: Hook mới

**File:** `frontend/hooks/use-business-documents.ts`

Thêm vào cuối file (không xóa code cũ):

```typescript
export function useBusinessDocuments(filters: {
  page?: number;
  type?: BusinessDocumentType;
  status?: BusinessDocumentStatus;
  source?: BusinessDocumentSource;
  customerId?: string;
  projectId?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["business-documents", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") params.set(key, String(value));
      });
      const response = await apiClient.get<ApiListResponse<BusinessDocument>>(
        `/business-documents?${params.toString()}`
      );
      return response.data;
    }
  });
}

export function useDeleteBusinessDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/business-documents/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["business-documents"] });
      toast("Đã xóa tài liệu.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xóa tài liệu.",
        variant: "destructive"
      });
    }
  });
}
```

**Lưu ý imports cần thêm:** `useQuery` từ `@tanstack/react-query`, `ApiListResponse` từ `@/lib/types`.

---

### Phần 3 — Frontend: Trang và components

#### Cấu trúc thư mục tạo mới:
```
frontend/app/(dashboard)/documents/
├── page.tsx
└── _components/
    ├── documents-client.tsx       # Shell: state, filter, data fetching
    ├── document-table.tsx         # Bảng danh sách
    ├── document-filters.tsx       # Filter bar
    ├── document-upload-dialog.tsx # Dialog upload + tạo mới
    └── document-type-badge.tsx    # Badge màu theo loại tài liệu
```

---

#### `page.tsx`
```typescript
import { DocumentsClient } from "./_components/documents-client";

export const metadata = {
  title: "Hồ sơ tài liệu",
  description: "Quản lý tài liệu thực tế: hợp đồng đã ký, biên bản, hóa đơn",
};

export default function DocumentsPage() {
  return <DocumentsClient />;
}
```

---

#### `documents-client.tsx`
State quản lý:
- `search: string` — debounce 300ms
- `type: BusinessDocumentType | ""` — filter loại
- `status: BusinessDocumentStatus | ""` — filter trạng thái
- `page: number` — phân trang

Dùng hook `useBusinessDocuments(filters)`.

Layout:
```
PageHeader (title="Hồ sơ tài liệu", action=Button "Thêm tài liệu")
DocumentFilters (search, type, status)
DocumentTable (items, meta, isLoading, onPageChange)
DocumentUploadDialog (open/close state)
```

---

#### `document-filters.tsx`
- Input search (placeholder: "Tìm theo tên, số hiệu tài liệu...")
- Select loại (`type`): Tất cả / RFQ / Báo giá / Hợp đồng / Biên bản bàn giao / ...
- Select trạng thái (`status`): Tất cả / Nháp / Đã phát hành / Đã nhận / Đã ký / ...
- Nút Reset filter

**Labels tiếng Việt cho từng giá trị:**

```typescript
// Dùng trong component — không cần export ra constants.ts
const DOCUMENT_TYPE_LABELS: Record<BusinessDocumentType, string> = {
  RFQ: "Yêu cầu báo giá (RFQ)",
  CUSTOMER_PO: "Đơn đặt hàng (PO)",
  QUOTATION: "Báo giá",
  SIGNED_QUOTATION: "Báo giá đã ký",
  PROPOSAL: "Đề xuất / Proposal",
  CONTRACT: "Hợp đồng",
  SIGNED_CONTRACT: "Hợp đồng đã ký",
  CONTRACT_ADDENDUM: "Phụ lục hợp đồng",
  NDA: "Thỏa thuận bảo mật (NDA)",
  DELIVERY_NOTE: "Biên bản bàn giao",
  DOC_HANDOVER: "Bàn giao tài liệu",
  INSTALLATION_REPORT: "Biên bản lắp đặt",
  ACCEPTANCE_REPORT: "Biên bản nghiệm thu",
  PARTIAL_ACCEPTANCE: "Nghiệm thu từng phần",
  WARRANTY_CERT: "Giấy bảo hành",
  MAINTENANCE_RECORD: "Biên bản bảo trì",
  PAYMENT_REQUEST: "Đề nghị thanh toán",
  PAYMENT_RECEIPT: "Biên lai thu tiền",
  INVOICE: "Hóa đơn",
  AR_RECONCILIATION: "Đối soát công nợ",
  OTHER: "Khác",
};

const DOCUMENT_STATUS_LABELS: Record<BusinessDocumentStatus, string> = {
  DRAFT: "Nháp",
  ISSUED: "Đã phát hành",
  RECEIVED: "Đã nhận",
  SIGNED: "Đã ký",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Từ chối",
  SUPERSEDED: "Đã thay thế",
  CANCELLED: "Đã hủy",
  ARCHIVED: "Lưu trữ",
};

const DOCUMENT_SOURCE_LABELS: Record<BusinessDocumentSource, string> = {
  GENERATED: "Tạo từ hệ thống",
  UPLOADED: "Upload lên",
  RECEIVED: "Nhận từ khách",
  SIGNED_UPLOAD: "Bản đã ký (scan)",
};
```

---

#### `document-table.tsx`
Mỗi row hiển thị:

| Cột | Nội dung |
|-----|---------|
| Tài liệu | Icon loại file + `title` (bold) + `documentNo` (nhỏ, muted) |
| Loại | `DocumentTypeBadge` |
| Liên kết | Customer → Project → Contract (dạng breadcrumb nhỏ, link) |
| Trạng thái | Badge màu theo status |
| Ngày | `documentDate` hoặc `createdAt` |
| Thao tác | Download (nếu có file) · Đánh dấu đã ký · Xóa |

**Mobile:** card layout (title + loại + status + ngày), ẩn cột Liên kết.

**Desktop:** grid `lg:grid-cols-[2fr_160px_220px_120px_100px_120px]`

**Empty state:** "Chưa có tài liệu nào. Nhấn 'Thêm tài liệu' để bắt đầu."

**Download file:** `window.open(\`${process.env.NEXT_PUBLIC_API_URL}/business-documents/${id}/file\`, "_blank")` với Authorization header — dùng `apiClient.get(..., { responseType: "blob" })` rồi tạo object URL.

---

#### `document-type-badge.tsx`
Badge màu theo nhóm loại tài liệu:

```typescript
function getDocumentTypeTone(type: BusinessDocumentType) {
  if (["RFQ", "CUSTOMER_PO"].includes(type)) return "info";           // từ khách hàng
  if (["CONTRACT", "SIGNED_CONTRACT", "NDA", "CONTRACT_ADDENDUM"].includes(type)) return "warning"; // pháp lý
  if (["INVOICE", "PAYMENT_REQUEST", "PAYMENT_RECEIPT", "AR_RECONCILIATION"].includes(type)) return "success"; // tài chính
  if (["ACCEPTANCE_REPORT", "PARTIAL_ACCEPTANCE", "WARRANTY_CERT"].includes(type)) return "neutral"; // nghiệm thu
  return "neutral";
}
```

Dùng `<Badge variant={tone}>` từ shadcn/ui.

---

#### `document-upload-dialog.tsx`
Dialog tạo tài liệu mới (upload file hoặc chỉ tạo record):

Form fields (React Hook Form + Zod):
- `title` — text input, bắt buộc
- `type` — Select (dùng `DOCUMENT_TYPE_LABELS`)
- `source` — Select: UPLOADED / RECEIVED / SIGNED_UPLOAD (bỏ GENERATED)
- `documentNo` — text input, không bắt buộc
- `documentDate` — date input, không bắt buộc
- `projectId` — Select projects (optional, dùng `useProjects()` hook đã có)
- `file` — `<input type="file">` (PDF, Word, Excel, image) — optional

Flow:
1. `useCreateBusinessDocument("")` để tạo record (không gắn projectId mặc định)
2. Nếu có file → `useUploadBusinessDocumentFile("")` upload tiếp
3. Sau thành công → invalidate `["business-documents"]` → đóng dialog

**Lưu ý:** Hook `useCreateBusinessDocument` hiện nhận `projectId` string — cần sửa hook hoặc tạo overload chấp nhận `""` (empty string). Xem file `use-business-documents.ts` hiện tại để quyết định cách xử lý phù hợp nhất.

---

### Phần 4 — Thêm vào Navigation

**File:** `frontend/lib/constants.ts`

Tìm mảng `NAV_ITEMS`, thêm sau Activities:
```typescript
{ href: "/documents" as Route, label: "Hồ sơ", icon: "folder" as const }
```

**File:** `frontend/components/layout/mobile-bottom-nav.tsx`

`MOBILE_ITEMS` hiện có 5 tab: Dashboard, Khách hàng, Dự án, Lịch, Báo cáo.
**Không thêm Documents vào mobile nav** — đã đủ 5 tab, tránh tràn.

---

## Pattern tham khảo

Xem các file sau để giữ đúng coding style:
- `frontend/app/(dashboard)/contracts/_components/contracts-client.tsx` — shell pattern
- `frontend/app/(dashboard)/contracts/_components/contract-table.tsx` — table pattern
- `frontend/app/(dashboard)/contracts/_components/contract-filters.tsx` — filter pattern
- `frontend/app/(dashboard)/customers/_components/customer-table.tsx` — mobile card layout

---

## Quy tắc bắt buộc

1. **Không dùng `any`** — kiểm tra types từ `frontend/lib/types.ts`
2. **Không hardcode màu hex** — dùng Tailwind token (`text-primary`, `bg-success`, v.v.)
3. **Text hiển thị cho user: tiếng Việt** — labels, placeholder, empty state
4. **Không tạo CSS tay** — chỉ Tailwind utility
5. **Không sửa file trong `components/ui/`** — shadcn source
6. **Không cài npm package mới**
7. **Mobile responsive** — card layout dưới `lg`, table từ `lg` trở lên

---

## Verify sau khi hoàn thành

```bash
# Backend
cd backend && npm run typecheck && npm run build

# Frontend  
cd frontend && npm run typecheck && npm run lint && npm run build
```

Kiểm tra thủ công:
- [ ] `GET /api/business-documents` trả về `{ data: [...], meta: { total, page, limit, totalPages } }`
- [ ] Trang `/documents` load được, hiện danh sách (hoặc empty state)
- [ ] Filter theo loại, trạng thái hoạt động
- [ ] Dialog "Thêm tài liệu" tạo được record mới
- [ ] Upload file hoạt động, nút Download xuất hiện
- [ ] Nút "Đánh dấu đã ký" chuyển status → SIGNED
- [ ] Sidebar có link "Hồ sơ" dẫn đúng `/documents`
- [ ] Mobile (375px): card layout, không vỡ layout
