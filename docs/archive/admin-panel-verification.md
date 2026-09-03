# Admin Panel Verification

Ngày kiểm tra: `2026-04-19`

## Build & runtime

- `docker compose up -d --build backend frontend`: PASS
- `docker logs ahso-crm-backend-1 --tail 30`: PASS, có log `Nest application successfully started`
- `docker exec ahso-crm-backend-1 npx prisma migrate status`: PASS, database schema up to date
- `npm run build` trong `backend/`: PASS
- `npm run build` trong `frontend/`: PASS

## API checklist

- [x] Login ADMIN lấy token: PASS
- [x] `GET /api/settings` trả object có `company`, `policies`, `logo`: PASS
- [x] `PATCH /api/settings/company` với `{"name":"AHSO Test","taxId":"0399"}`: PASS
- [x] `GET /api/settings/company` phản ánh thay đổi: PASS
- [x] `POST /api/upload/logo` trả `url` dạng `/uploads/logos/...`: PASS
- [x] `GET /api/settings/logo` trả đúng logo vừa upload: PASS
- [x] `GET /uploads/logos/...` serve file thành công: PASS
- [x] `GET /api/roles` trả đủ `ADMIN`, `MANAGER`, `STAFF`: PASS
- [x] `POST /api/roles` tạo custom role `VIEWER_*`: PASS
- [x] `PATCH /api/roles/<system_admin_id>` bị chặn với message role hệ thống: PASS
- [x] `DELETE /api/roles/<VIEWER_id>`: PASS
- [x] Login STAFF rồi `PATCH /api/settings/company` bị `403`: PASS

Script đã chạy pass: [scripts/test-admin-panel.sh](/Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM/scripts/test-admin-panel.sh)

## UI checklist

- [x] `/login` hiển thị company name động `AHSO Test`: PASS
- [x] Login ADMIN thấy mục `Quản trị` ở sidebar: PASS
- [x] `/admin` hiển thị đủ 4 card `Company Info`, `Policies`, `Roles`, `Users`: PASS
- [x] `/admin/company-info` load đúng dữ liệu, submit thành công, reload vẫn giữ dữ liệu: PASS
- [x] `/admin/company-info` upload logo thành công, có toast và topbar hiển thị logo: PASS
- [x] `/admin/policies` cho phép chỉnh sửa và lưu chính sách: PASS
- [x] `/admin/roles` hiển thị system role với badge `Hệ thống`, system role bị disable action, tạo/xoá custom role thành công: PASS
- [x] Login STAFF không thấy `Quản trị` ở sidebar, vào trực tiếp `/admin` bị redirect và có toast `Không có quyền truy cập`: PASS

## Screenshots

Ảnh chụp local phục vụ xác minh UI được lưu tại:

- `/tmp/ahso-admin-ui/admin-dashboard.png`
- `/tmp/ahso-admin-ui/admin-company-info.png`
- `/tmp/ahso-admin-ui/admin-policies.png`
- `/tmp/ahso-admin-ui/admin-roles.png`

Mô tả nhanh:

- `admin-dashboard.png`: màn dashboard quản trị với 4 card điều hướng.
- `admin-company-info.png`: form thông tin công ty + uploader logo cùng topbar đã có logo.
- `admin-policies.png`: editor 4 textarea chính sách.
- `admin-roles.png`: bảng role sau khi xác minh create/delete custom role.

## Deviations

- Ban đầu `GET /api/settings` trả flat key-value (`company:name`, `logo:url`). Đã chỉnh về contract nhóm `company / policies / logo` để khớp test plan và frontend admin.
- Snapshot dev hiện tại thiếu `staff@ahso.vn`. Đã sửa [backend/prisma/seed.ts](/Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM/backend/prisma/seed.ts) và `prisma:seed` để môi trường mới luôn có đủ `admin / manager / staff`.
- `backend/package.json` được chỉnh script seed để chạy ổn định trong container Node 20.
