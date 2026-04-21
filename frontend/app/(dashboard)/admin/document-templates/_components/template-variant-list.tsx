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

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-2xl border px-4 py-3 text-left transition shadow-sm",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-white hover:border-primary/30 hover:bg-slate-50/80"
      )}
      onClick={() => onSelect(variant.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-text-primary">{variant.name}</p>
          <p className="mt-1 text-xs text-text-muted">
            Phiên bản {variant.version} • Cập nhật {new Date(variant.updatedAt).toLocaleString("vi-VN")}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {variant.status === "PUBLISHED" || variant.isActive
              ? "Bản dùng cho runtime hoặc đã sẵn sàng phát hành."
              : variant.status === "PENDING_APPROVAL"
                ? "Đang chờ duyệt trước khi publish."
                : variant.status === "ARCHIVED"
                  ? "Biến thể đã lưu trữ để đối chiếu về sau."
                  : "Bản nháp đang được chỉnh sửa trong editor."}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={variant.isActive ? "success" : variant.status === "PUBLISHED" ? "info" : "neutral"}>
            {variant.isActive ? "Đang dùng" : getStatusLabel(variant.status)}
          </Badge>
          {hasBlockingIssues ? <span className="text-xs font-medium text-rose-600">Có lỗi layout</span> : null}
        </div>
      </div>
    </button>
  );
}

function VariantSection({
  title,
  description,
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
          <p className="text-sm text-text-secondary">{description}</p>
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
                <div className="flex items-center gap-2">
                  <Badge variant={item.runtimeStatus === "production" ? "success" : "warning"}>
                    {item.runtimeStatus === "production" ? "Production" : "Beta"}
                  </Badge>
                  <Badge variant="neutral">Editor</Badge>
                </div>
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
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-text-primary">{item.label}</p>
                      <p className="text-xs text-text-muted">{item.type}</p>
                    </div>
                    <Badge variant="warning">Beta</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)] sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
            Bản chính thức
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{officialVariants.length}</p>
          <p className="mt-1 text-xs text-emerald-700">{activeCount} bản đang active trên runtime</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">
            Bản nháp
          </p>
          <p className="mt-2 text-2xl font-bold text-sky-900">{draftCount}</p>
          <p className="mt-1 text-xs text-sky-700">Các variant còn có thể chỉnh sửa trực tiếp</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">
            Chờ duyệt
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{pendingCount}</p>
          <p className="mt-1 text-xs text-amber-700">Biến thể đang chờ admin duyệt & publish</p>
        </div>
      </section>

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
