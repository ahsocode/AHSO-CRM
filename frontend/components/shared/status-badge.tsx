import { Badge } from "@/components/ui/badge";
import { ContractStatus, CustomerStatus, ProjectStatus, QuoteStatus } from "@/lib/types";

const CUSTOMER_STATUS_CONFIG: Record<
  CustomerStatus,
  {
    label: string;
    variant: "neutral" | "info" | "warning" | "success" | "danger";
  }
> = {
  LEAD: { label: "Tiềm năng", variant: "neutral" },
  PROSPECT: { label: "Đang quan tâm", variant: "info" },
  ACTIVE: { label: "Hoạt động", variant: "success" },
  INACTIVE: { label: "Không HĐ", variant: "danger" }
};

const PROJECT_STATUS_CONFIG: Record<
  ProjectStatus,
  {
    label: string;
    variant: "neutral" | "info" | "warning" | "success" | "danger";
  }
> = {
  SURVEY: { label: "Khảo sát", variant: "neutral" },
  QUOTING: { label: "Báo giá", variant: "info" },
  NEGOTIATING: { label: "Đàm phán", variant: "warning" },
  WON: { label: "Đã ký HĐ", variant: "success" },
  LOST: { label: "Không thành", variant: "danger" },
  DELIVERING: { label: "Triển khai", variant: "info" },
  COMPLETED: { label: "Hoàn thành", variant: "success" }
};

const QUOTE_STATUS_CONFIG: Record<
  QuoteStatus,
  {
    label: string;
    variant: "neutral" | "info" | "warning" | "success" | "danger";
  }
> = {
  DRAFT: { label: "Bản nháp", variant: "neutral" },
  SENT: { label: "Đã gửi", variant: "info" },
  ACCEPTED: { label: "Chấp nhận", variant: "success" },
  REJECTED: { label: "Từ chối", variant: "danger" },
  EXPIRED: { label: "Hết hạn", variant: "warning" }
};

const CONTRACT_STATUS_CONFIG: Record<
  ContractStatus,
  {
    label: string;
    variant: "neutral" | "info" | "warning" | "success" | "danger";
  }
> = {
  ACTIVE: { label: "Hiệu lực", variant: "info" },
  SUSPENDED: { label: "Tạm dừng", variant: "warning" },
  COMPLETED: { label: "Hoàn tất", variant: "success" },
  CANCELLED: { label: "Hủy", variant: "danger" }
};

export function StatusBadge({
  status,
  kind
}: {
  status: CustomerStatus | ProjectStatus | QuoteStatus | ContractStatus;
  kind?: "customer" | "project" | "quote" | "contract";
}) {
  let config;

  if (kind === "customer") {
    config = CUSTOMER_STATUS_CONFIG[status as CustomerStatus];
  } else if (kind === "project") {
    config = PROJECT_STATUS_CONFIG[status as ProjectStatus];
  } else if (kind === "quote") {
    config = QUOTE_STATUS_CONFIG[status as QuoteStatus];
  } else if (kind === "contract") {
    config = CONTRACT_STATUS_CONFIG[status as ContractStatus];
  } else if (status in CUSTOMER_STATUS_CONFIG) {
    config = CUSTOMER_STATUS_CONFIG[status as CustomerStatus];
  } else if (status in PROJECT_STATUS_CONFIG) {
    config = PROJECT_STATUS_CONFIG[status as ProjectStatus];
  } else {
    config = QUOTE_STATUS_CONFIG[status as QuoteStatus];
  }

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
