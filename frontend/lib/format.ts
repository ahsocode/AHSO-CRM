export function formatVND(amount: number | string): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(amount));
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
