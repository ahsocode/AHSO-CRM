import { ContractStatus, ProjectStatus, QuoteStatus, Role } from "./types";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "AHSO CRM";

// Normalise: strip trailing slash, ensure `/api` suffix (backend uses setGlobalPrefix("api"))
function normaliseApiUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, "");
  return /\/api$/.test(trimmed) ? trimmed : `${trimmed}/api`;
}

export const API_URL = normaliseApiUrl(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");
export const ACCESS_TOKEN_KEY = "ahso_access_token";
export const REFRESH_TOKEN_KEY = "ahso_refresh_token";
export const AUTH_USER_KEY = "ahso_auth_user";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Tổng quan", icon: "dashboard" },
  { href: "/customers", label: "Khách hàng", icon: "groups" },
  { href: "/projects", label: "Dự án", icon: "factory" },
  { href: "/quotes", label: "Báo giá", icon: "description" },
  { href: "/contracts", label: "Hợp đồng", icon: "contract" },
  { href: "/calendar", label: "Lịch & Công việc", icon: "calendar" },
  { href: "/reports", label: "Báo cáo", icon: "analytics" }
] as const;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  STAFF: "Nhân viên"
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  SURVEY: "Khảo sát",
  QUOTING: "Báo giá",
  NEGOTIATING: "Đàm phán",
  WON: "Đã ký HĐ",
  LOST: "Không thành",
  DELIVERING: "Triển khai",
  COMPLETED: "Hoàn thành"
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Bản nháp",
  SENT: "Đã gửi",
  ACCEPTED: "Chấp nhận",
  REJECTED: "Từ chối",
  EXPIRED: "Hết hạn"
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  ACTIVE: "Hiệu lực",
  SUSPENDED: "Tạm dừng",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Hủy"
};
