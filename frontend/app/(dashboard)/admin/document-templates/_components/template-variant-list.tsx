"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  DocumentTemplateRegistryItem,
  DocumentTemplateType,
  DocumentTemplateVariant
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface TemplateVariantListProps {
  registry: DocumentTemplateRegistryItem[];
  selectedType?: DocumentTemplateType;
  variants: DocumentTemplateVariant[];
  selectedVariantId?: string;
  onSelectType: (type: DocumentTemplateType) => void;
  onSelectVariant: (variantId: string) => void;
  onCreateVariant: () => void;
}

function getStatusLabel(status: DocumentTemplateVariant["status"]) {
  switch (status) {
    case "DRAFT":
      return "Bản nháp";
    case "PENDING_APPROVAL":
      return "Chờ duyệt";
    case "PUBLISHED":
      return "Đã publish";
    case "ARCHIVED":
      return "Lưu trữ";
    default:
      return status;
  }
}

export function TemplateVariantList({
  registry,
  selectedType,
  variants,
  selectedVariantId,
  onSelectType,
  onSelectVariant,
  onCreateVariant
}: TemplateVariantListProps) {
  const enabledTypes = registry.filter((item) => item.editorEnabled);
  const passiveTypes = registry.filter((item) => !item.editorEnabled);

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Loại tài liệu</h3>
          <p className="text-sm text-text-secondary">
            Chọn loại tài liệu cần thiết kế. Hiện editor mở cho Quotation và Contract, các loại khác vẫn dùng fallback `.hbs`.
          </p>
        </div>

        <div className="grid gap-2">
          {enabledTypes.map((item) => (
            <button
              key={item.type}
              type="button"
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition shadow-sm",
                selectedType === item.type
                  ? "border-primary bg-primary/5"
                  : "border-border bg-white hover:border-primary/30 hover:bg-slate-50/80"
              )}
              onClick={() => onSelectType(item.type)}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-text-primary">{item.label}</p>
                  <p className="text-xs text-text-muted">{item.type}</p>
                </div>
                <Badge variant="success">Editor</Badge>
              </div>
            </button>
          ))}
        </div>

        {passiveTypes.length > 0 ? (
          <div className="space-y-2 border-t border-border/70 pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
              Fallback HBS
            </p>
            <div className="grid gap-2">
              {passiveTypes.map((item) => (
                <div
                  key={item.type}
                  className="rounded-2xl border border-border/70 bg-bg-hover/40 px-4 py-3"
                >
                  <p className="font-medium text-text-primary">{item.label}</p>
                  <p className="text-xs text-text-muted">{item.type}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Danh sách variant</h3>
            <p className="text-sm text-text-secondary">
              Mỗi loại có thể có nhiều variant, nhưng runtime chỉ dùng một bản published và active.
            </p>
          </div>
          <Button type="button" size="sm" onClick={onCreateVariant} disabled={!selectedType}>
            Tạo draft
          </Button>
        </div>

        <div className="space-y-2">
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              className={cn(
                "w-full rounded-2xl border px-4 py-3 text-left transition shadow-sm",
                selectedVariantId === variant.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-white hover:border-primary/30 hover:bg-slate-50/80"
              )}
              onClick={() => onSelectVariant(variant.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-text-primary">{variant.name}</p>
                  <p className="text-xs text-text-muted">
                    Phiên bản {variant.version} • Cập nhật {new Date(variant.updatedAt).toLocaleString("vi-VN")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={variant.isActive ? "success" : "neutral"}>
                    {variant.isActive ? "Đang dùng" : getStatusLabel(variant.status)}
                  </Badge>
                  {variant.validationIssues?.some((issue) => issue.severity === "error") ? (
                    <span className="text-xs font-medium text-rose-600">Có lỗi layout</span>
                  ) : null}
                </div>
              </div>
            </button>
          ))}

          {variants.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-bg-hover/40 px-4 py-6 text-sm text-text-secondary">
              Chưa có variant nào cho loại tài liệu này.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
