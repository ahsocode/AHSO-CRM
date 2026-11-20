# Hướng dẫn triển khai production — Kho & giá vốn

Migration: `20261120090000_inventory_invoice_supplier_type` (PR1) và `20261121090000_inventory_controls_and_costing_schema`.
Cả hai chỉ cộng thêm (additive); riêng `ProjectCost.projectId` được nới thành nullable. Chưa được chạy thử trên Postgres thật — bắt buộc thử trên bản sao.

## Trước khi chạy
1. Sao lưu DB (`pg_dump -Fc`), kiểm tra khôi phục được.
2. Khôi phục bản sao vào DB tạm, chạy `npx prisma migrate deploy` trên bản sao; kiểm tra `62` phiếu nhập, `119` vật tư, `58` NCC vẫn mở/sửa được.
3. Trên bản sao: thử UPDATE/DELETE bảng `AuditLog` phải bị trigger chặn.

## Sau khi deploy
1. MANAGER mất quyền xác nhận/hủy chứng từ kho (cần `inventory.approve`). Tạo vai trò tùy chỉnh có `inventory.approve` / `inventory.view_cost` nếu cần.
2. Đặt `Setting company.taxCode` = `0316896939` (nếu khác mặc định).
3. Tạo API token cho tài khoản máy (ADMIN): scope `inventory.read`, `inventory.receipt_draft`, `inventory.alias_write`; đặt `CRM_API_TOKEN` cho MCP server. Không dán token vào chat/log.
4. Phân loại NCC (bulk-type) → bổ sung hóa đơn cho 62 phiếu cũ (invoices/bulk) → `get_receipts_without_invoice` phải bằng 0.
5. Chọn phương pháp giá vốn: mặc định bình quân gia quyền; đổi sang FIFO chỉ áp dụng từ năm tài chính sau (PUT /inventory/costing-config).
6. Chỉ sau các bước trên mới bắt đầu lập phiếu xuất theo dự án.
7. Khi chốt kỳ: PUT /inventory/period-lock (ADMIN, có lý do).

## Hạn chế đã biết
- Tồn kho quá khứ (valuation) dựng lại từ chứng từ; nên truyền `materialId` khi dữ liệu lớn.
- Hủy phiếu xuất FIFO: lô hoàn đúng số lượng/giá lô, `costPrice` giữ nguyên.
- Phân bổ vật tư dùng chung ghi ProjectCost nhóm OTHER.
- Chi phí chỉ-chi-phí từ hóa đơn (PENDING_REVIEW) chưa có route duyệt riêng.
