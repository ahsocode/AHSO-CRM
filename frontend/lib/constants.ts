export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "AHSO CRM";

export function normalizeBackendUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
}

const DEFAULT_BACKEND_URL = normalizeBackendUrl(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");

function resolveBackendUrl() {
  if (typeof window === "undefined") {
    return DEFAULT_BACKEND_URL;
  }

  try {
    const configuredUrl = new URL(DEFAULT_BACKEND_URL);
    const currentHostname = window.location.hostname;
    const isLoopbackHost =
      configuredUrl.hostname === "localhost" ||
      configuredUrl.hostname === "127.0.0.1";

    if (isLoopbackHost && currentHostname && currentHostname !== configuredUrl.hostname) {
      configuredUrl.hostname = currentHostname;
    }

    return normalizeBackendUrl(configuredUrl.toString());
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

export const BACKEND_URL = resolveBackendUrl();
export const API_URL = `${BACKEND_URL}/api`;
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const ACCESS_TOKEN_KEY = "ahso_access_token";
export const REFRESH_TOKEN_KEY = "ahso_refresh_token";
export const AUTH_USER_KEY = "ahso_auth_user";
export const SESSION_ID_KEY = "ahso_session_id";

export const ROLE_LABELS = {
  ADMIN: "Quản trị hệ thống",
  MANAGER: "Quản lý kinh doanh",
  STAFF: "Nhân viên phụ trách"
} as const;

type RoleLike =
  | string
  | {
      name?: string | null;
    }
  | null
  | undefined;

export function getRoleLabelByName(roleLike: RoleLike) {
  const roleName =
    typeof roleLike === "string"
      ? roleLike
      : typeof roleLike === "object" && roleLike
        ? roleLike.name
        : undefined;

  if (!roleName) {
    return "Chưa gán vai trò";
  }

  return ROLE_LABELS[roleName as keyof typeof ROLE_LABELS] ?? roleName;
}

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/customers", label: "Khách hàng", icon: "groups" },
  { href: "/projects", label: "Dự án", icon: "factory" },
  { href: "/quotes", label: "Báo giá", icon: "description" },
  { href: "/contracts", label: "Hợp đồng", icon: "contract" },
  { href: "/activities", label: "Hoạt động", icon: "history" },
  { href: "/calendar", label: "Lịch công tác", icon: "calendar" },
  { href: "/documents", label: "Hồ sơ", icon: "folder" },
  { href: "/reports", label: "Báo cáo", icon: "analytics" },
  { href: "/users", label: "Người dùng", icon: "briefcase" }
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
