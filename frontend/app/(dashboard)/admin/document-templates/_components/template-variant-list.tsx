"use client";

import type { ReactNode } from "react";
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

function sortVariants(left: DocumentTemplateVariant, right: DocumentTemplateVariant) {
  const leftScore = left.isActive ? 0 : left.status === "PUBLISHED" ? 1 : left.status === "PENDING_APPROVAL" ? 2 : left.status === "DRAFT" ? 3 : 4;
  const rightScore = right.isActive ? 0 : right.status === "PUBLISHED" ? 1 : right.status === "PENDING_APPROVAL" ? 2 : right.status === "DRAFT" ? 3 : 4;

  if (leftScore !== rightScore) {
    return leftScore - rightScore;
  }

  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function VariantCard({
  variant,
  selected,
  onSelect
}: {
  variant: DocumentTemplateVariant;
  selected: boolean;
  onSelect: (variantId: string) => void;
}) {
  const hasBlockingIssues = variant.validationIssues?.some((issue) => issue.severity === "error");
  const description =
    variant.status === "PUBLISHED" || variant.isActive
      ? "Bản đang dùng cho runtime hoặc sẵn sàng phát hành."
      : variant.status === "PENDING_APPROVAL"
        ? "Đang chờ duyệt trước khi publish."
        : variant.status === "ARCHIVED"
          ? "Biến thể lưu trữ để đối chiếu về sau."
          : "Bản nháp đang chỉnh sửa trong editor.";

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-2xl border px-3 py-2.5 text-left shadow-sm transition",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-white hover:border-primary/30 hover:bg-slate-50/80"
      )}
      onClick={() => onSelect(variant.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{variant.name}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            v{variant.version} · {new Date(variant.updatedAt).toLocaleDateString("vi-VN")}
          </p>
          {selected ? (
            <p className="mt-1 text-xs text-text-secondary">{description}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={variant.isActive ? "success" : variant.status === "PUBLISHED" ? "info" : "neutral"}>
            {variant.isActive ? "Đang dùng" : getStatusLabel(variant.status)}
          </Badge>
          {hasBlockingIssues ? (
            <span className="text-[11px] font-medium text-danger">Có lỗi</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function VariantSection({
  title,
  variants,
  selectedVariantId,
  onSelectVariant,
  emptyLabel,
  action
}: {
  title: string;
  description: string;
  variants: DocumentTemplateVariant[];
  selectedVariantId?: string;
  onSelectVariant: (variantId: string) => void;
  emptyLabel: string;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        </div>
        {action}
      </div>

      <div className="space-y-2">
        {variants.map((variant) => (
          <VariantCard
            key={variant.id}
            variant={variant}
            selected={selectedVariantId === variant.id}
            onSelect={onSelectVariant}
          />
        ))}

        {variants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-bg-hover/40 px-4 py-6 text-sm text-text-secondary">
            {emptyLabel}
          </div>
        ) : null}
      </div>
    </section>
  );
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
  const sortedVariants = [...variants].sort(sortVariants);
  const officialVariants = sortedVariants.filter((variant) => variant.isActive || variant.status === "PUBLISHED");
  const workingVariants = sortedVariants.filter(
    (variant) => variant.status === "DRAFT" || variant.status === "PENDING_APPROVAL"
  );
  const archivedVariants = sortedVariants.filter((variant) => variant.status === "ARCHIVED");

  const activeCount = officialVariants.filter((variant) => variant.isActive).length;
  const draftCount = workingVariants.filter((variant) => variant.status === "DRAFT").length;
  const pendingCount = workingVariants.filter((variant) => variant.status === "PENDING_APPROVAL").length;

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
        <h3 className="text-sm font-semibold text-text-primary">Loại tài liệu</h3>
        <select
          value={selectedType ?? ""}
          onChange={(event) => {
            const value = event.target.value as DocumentTemplateType;
            if (value) onSelectType(value);
          }}
          className="w-full rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm font-medium text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {enabledTypes.map((item) => (
            <option key={item.type} value={item.type}>
              {item.label}
            </option>
          ))}
          {passiveTypes.length > 0 && (
            <optgroup label="Fallback HBS (chưa mở editor)">
              {passiveTypes.map((item) => (
                <option key={item.type} value={item.type} disabled>
                  {item.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {selectedType ? (
          <div className="flex items-center gap-2">
            <Badge variant={registry.find(r => r.type === selectedType)?.runtimeStatus === "production" ? "success" : "warning"}>
              {registry.find(r => r.type === selectedType)?.runtimeStatus === "production" ? "Production" : "Beta"}
            </Badge>
            <span className="text-xs text-text-muted">{selectedType}</span>
          </div>
        ) : null}
      </section>

      <div className="flex gap-3 rounded-[28px] border border-white/70 bg-white/90 p-3 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-success-bg px-3 py-2.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-success">Chính thức</p>
          <p className="text-xl font-bold text-text-primary">{officialVariants.length}</p>
          <p className="text-[11px] text-success">{activeCount} active</p>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-primary-bg px-3 py-2.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Bản nháp</p>
          <p className="text-xl font-bold text-text-primary">{draftCount}</p>
          <p className="text-[11px] text-primary">có thể sửa</p>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-accent-bg px-3 py-2.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">Chờ duyệt</p>
          <p className="text-xl font-bold text-text-primary">{pendingCount}</p>
          <p className="text-[11px] text-accent">chờ admin</p>
        </div>
      </div>

      <VariantSection
        title="Phiên bản chính thức"
        description="Các bản đã publish hoặc đang được runtime sử dụng. Đây là khu vực quản trị bản dùng thật."
        variants={officialVariants}
        selectedVariantId={selectedVariantId}
        onSelectVariant={onSelectVariant}
        emptyLabel="Chưa có phiên bản chính thức nào cho loại tài liệu này."
      />

      <VariantSection
        title="Bản nháp đang làm việc"
        description="Tạo, chỉnh sửa và gửi duyệt các draft mới tại đây mà không ảnh hưởng đến bản chính thức đang chạy."
        variants={workingVariants}
        selectedVariantId={selectedVariantId}
        onSelectVariant={onSelectVariant}
        emptyLabel="Chưa có bản nháp nào cho loại tài liệu này."
        action={
          <Button type="button" size="sm" onClick={onCreateVariant} disabled={!selectedType}>
            Tạo draft
          </Button>
        }
      />

      {archivedVariants.length > 0 ? (
        <VariantSection
          title="Bản lưu trữ"
          description="Các biến thể đã khóa để đối chiếu lịch sử, không dùng cho chỉnh sửa hằng ngày."
          variants={archivedVariants}
          selectedVariantId={selectedVariantId}
          onSelectVariant={onSelectVariant}
          emptyLabel="Chưa có bản lưu trữ."
        />
      ) : null}
    </div>
  );
}
