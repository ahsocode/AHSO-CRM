export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "AHSO CRM";
export const API_URL = `${(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")}/api`;

export const ACCESS_TOKEN_KEY = "ahso_access_token";
export const REFRESH_TOKEN_KEY = "ahso_refresh_token";
export const AUTH_USER_KEY = "ahso_auth_user";

export const ROLE_LABELS = {
  ADMIN: "Quản trị hệ thống",
  MANAGER: "Quản lý kinh doanh",
  STAFF: "Nhân viên phụ trách"
} as const;

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/customers", label: "Khách hàng", icon: "groups" },
  { href: "/projects", label: "Dự án", icon: "factory" },
  { href: "/quotes", label: "Báo giá", icon: "description" },
  { href: "/contracts", label: "Hợp đồng", icon: "contract" },
  { href: "/activities", label: "Hoạt động", icon: "history" },
  { href: "/calendar", label: "Lịch công tác", icon: "calendar" },
  { href: "/reports", label: "Báo cáo", icon: "analytics" },
  { href: "/users", label: "Người dùng", icon: "settings" }
] as const;

export const PROJECT_STATUS_LABELS = {
  SURVEY: "Khảo sát",
  QUOTING: "Báo giá",
  NEGOTIATING: "Đàm phán",
  WON: "Đã ký HĐ",
  LOST: "Không thành",
  DELIVERING: "Triển khai",
  COMPLETED: "Hoàn thành"
} as const;

export const PRIORITY_LABELS = {
  LOW: "Thấp",
  NORMAL: "Chuẩn",
  HIGH: "Cao"
} as const;

export const QUOTE_STATUS_LABELS = {
  DRAFT: "Bản nháp",
  SENT: "Đã gửi",
  ACCEPTED: "Chấp nhận",
  REJECTED: "Từ chối",
  EXPIRED: "Hết hạn"
} as const;

export const CONTRACT_STATUS_LABELS = {
  ACTIVE: "Hiệu lực",
  SUSPENDED: "Tạm dừng",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Hủy"
} as const;

export const ACTIVITY_TYPE_LABELS = {
  CALL: "Gọi điện",
  EMAIL: "Email",
  MEETING: "Họp",
  SURVEY: "Khảo sát",
  DEMO: "Demo",
  NOTE: "Ghi chú",
  FOLLOWUP: "Theo dõi"
} as const;
