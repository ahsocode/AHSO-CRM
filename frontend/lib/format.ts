export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
const APP_TIME_ZONE_OFFSET = "+07:00";

export function formatVND(amount: number | string): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(amount));
}

export function formatDateTimeLocalInput(date: string | Date): string {
  const value = new Date(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`;
}

export function parseDateTimeLocalInput(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return undefined;
  }

  // datetime-local carries no timezone, so persist AHSO business time as Vietnam time.
  const parsed = new Date(`${value}:00${APP_TIME_ZONE_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function formatVNDShort(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)} tỷ`;
  }

  if (amount >= 1_000_000) {
    return `${Math.round(amount / 1_000_000)}M`;
  }

  return formatVND(amount);
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(date));
}

export function formatMonthYear(date: string | Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    month: "2-digit",
    year: "numeric"
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const value = new Date(date).getTime();
  const now = Date.now();
  const diffMs = value - now;
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (Math.abs(diffMinutes) < 60) {
    return `${Math.abs(diffMinutes)} phút ${diffMinutes >= 0 ? "nữa" : "trước"}`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return `${Math.abs(diffHours)} giờ ${diffHours >= 0 ? "nữa" : "trước"}`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) <= 7) {
    return `${Math.abs(diffDays)} ngày ${diffDays >= 0 ? "nữa" : "trước"}`;
  }

  return formatDate(date);
}
