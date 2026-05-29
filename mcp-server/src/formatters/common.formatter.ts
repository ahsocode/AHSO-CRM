export function formatVND(amount: number | string | null | undefined): string {
  if (amount == null || amount === "") return "0 ₫";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  }).format(num);
}

export function formatVNDShort(amount: number | string | null | undefined): string {
  if (amount == null || amount === "") return "0 ₫";
  const num = typeof amount === "string" ? parseFloat(amount) : (amount as number);
  if (isNaN(num)) return "0 ₫";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace(".0", "")} tỷ`;
  if (num >= 1_000_000) return `${Math.round(num / 1_000_000)} triệu`;
  return formatVND(num);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 0) {
    const futureDays = Math.abs(days);
    if (futureDays === 1) return "ngày mai";
    if (futureDays < 7) return `${futureDays} ngày nữa`;
    return formatDate(d);
  }
  if (days === 0) return "hôm nay";
  if (days === 1) return "hôm qua";
  if (days < 30) return `${days} ngày trước`;
  if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
  return `${Math.floor(days / 365)} năm trước`;
}

export function truncate(text: string | null | undefined, maxLength = 120): string {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function stageLabel(stage: string | null | undefined): string {
  const map: Record<string, string> = {
    SURVEY: "Khảo sát",
    QUOTING: "Báo giá",
    NEGOTIATING: "Đàm phán",
    DELIVERING: "Triển khai",
    COMPLETED: "Hoàn thành",
    LOST: "Thua",
  };
  return map[stage ?? ""] ?? stage ?? "—";
}

export function activityTypeLabel(type: string | null | undefined): string {
  const map: Record<string, string> = {
    CALL: "📞 Gọi điện",
    MEETING: "🤝 Gặp mặt",
    EMAIL: "✉️ Email",
    NOTE: "📝 Ghi chú",
    SURVEY: "🔍 Khảo sát",
    DEMO: "💻 Demo",
    FOLLOWUP: "🔔 Follow-up",
  };
  return map[type ?? ""] ?? type ?? "—";
}
