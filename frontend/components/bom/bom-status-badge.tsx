import { Badge } from "@/components/ui/badge";
import { BOM_STATUS_LABELS } from "@/lib/constants";
import type { BomStatus } from "@/types/bom";

const VARIANTS = {
  DRAFT: "neutral",
  APPROVED: "success",
  ARCHIVED: "default"
} as const;

export function BomStatusBadge({ status }: { status: BomStatus }) {
  return <Badge variant={VARIANTS[status]}>{BOM_STATUS_LABELS[status]}</Badge>;
}
