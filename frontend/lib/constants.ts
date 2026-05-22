import type { StockDocStatus, SurveyNoteType } from "./types";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "AHSO CRM";

export function normalizeBackendUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
}

export const BACKEND_URL = normalizeBackendUrl(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");
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
  { href: "/surveys", label: "Khảo sát", icon: "search" },
  { href: "/calendar", label: "Lịch công tác", icon: "calendar" },
  { href: "/mailbox", label: "Mailbox", icon: "mail" },
  { href: "/agents", label: "AI Agents", icon: "smart_toy" },
  { href: "/documents", label: "Hồ sơ", icon: "folder" },
  { href: "/suppliers", label: "Nhà cung cấp", icon: "truck" },
  { href: "/materials", label: "Vật tư", icon: "inventory" },
  { href: "/inventory", label: "Kho hàng", icon: "warehouse" },
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

export const STOCK_DOC_STATUS_LABELS: Record<StockDocStatus, string> = {
  DRAFT: "Bản nháp",
  CONFIRMED: "Đã xác nhận",
  CANCELLED: "Đã hủy",
};

export const STOCK_DOC_STATUS_COLORS: Record<StockDocStatus, string> = {
  DRAFT: "text-text-secondary bg-bg-hover",
  CONFIRMED: "text-success bg-success-bg",
  CANCELLED: "text-danger bg-danger-bg",
};

export const SURVEY_NOTE_TYPE_LABELS: Record<SurveyNoteType, string> = {
  GENERAL: "Chung",
  TECHNICAL_REQUIREMENT: "Yêu cầu kỹ thuật",
  COMMERCIAL_REQUIREMENT: "Yêu cầu thương mại",
  SITE_CONSTRAINT: "Ràng buộc thực địa",
  RISK: "Rủi ro",
  DECISION: "Quyết định",
  OPEN_QUESTION: "Câu hỏi mở",
};

export const SURVEY_NOTE_TYPE_COLORS: Record<SurveyNoteType, string> = {
  GENERAL: "text-text-secondary bg-bg-hover",
  TECHNICAL_REQUIREMENT: "text-primary-mid bg-primary-bg",
  COMMERCIAL_REQUIREMENT: "text-accent bg-accent-bg",
  SITE_CONSTRAINT: "text-warning bg-warning-bg",
  RISK: "text-danger bg-danger-bg",
  DECISION: "text-success bg-success-bg",
  OPEN_QUESTION: "text-text-muted bg-bg-subtle",
};
