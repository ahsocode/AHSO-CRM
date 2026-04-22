"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppIcon } from "@/components/shared/app-icon";
import { cn } from "@/lib/utils";
import {
  useDocumentTemplateRegistry,
  useRuntimeDocumentTemplateVariants,
  useDownloadDocument,
  useRenderDocument
} from "@/hooks/use-documents";
import { useToast } from "@/hooks/use-toast";

export interface DocumentActionOption {
  type: string;
  label: string;
}

interface DocumentActionsProps {
  entityType: "quote" | "contract" | "customer" | "project";
  entityId: string;
  customerLanguage?: string;
  options?: DocumentActionOption[];
}

const DEFAULT_OPTIONS: Record<string, DocumentActionOption[]> = {
  quote: [{ type: "QUOTATION", label: "Báo giá" }],
  contract: [{ type: "CONTRACT", label: "Hợp đồng kinh tế" }],
  project: [],
  customer: [],
};

export function DocumentActions({
  entityType,
  entityId,
  customerLanguage = "vi",
  options,
}: DocumentActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentActionOption | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [language, setLanguage] = useState<"vi" | "vi-en">(
    customerLanguage === "vi-en" ? "vi-en" : "vi"
  );

  const { promise: toastPromise } = useToast();
  const renderMutation = useRenderDocument();
  const downloadMutation = useDownloadDocument();
  const templateRegistryQuery = useDocumentTemplateRegistry();
  const runtimeVariantsQuery = useRuntimeDocumentTemplateVariants(
    selectedType?.type,
    isOpen && Boolean(selectedType)
  );
  const isWorking = renderMutation.isPending || downloadMutation.isPending;

  const availableOptions = useMemo(() => {
    const dynamicOptions = (templateRegistryQuery.data ?? [])
      .filter((template) => template.entityType === entityType && template.endUserEnabled)
      .map((template) => ({
        type: template.type,
        label: template.label
      }));

    if (templateRegistryQuery.isSuccess) {
      return dynamicOptions;
    }

    return options || DEFAULT_OPTIONS[entityType] || [];
  }, [entityType, options, templateRegistryQuery.data, templateRegistryQuery.isSuccess]);

  const handleActionClick = (option: DocumentActionOption) => {
    setSelectedType(option);
    setSelectedVariantId("");
    setIsOpen(true);
  };

  const handlePreview = () => {
    if (!selectedType) return;
    const params = new URLSearchParams({
      type: selectedType.type,
      entityId,
      lang: language
    });
    if (selectedVariantId) {
      params.set("templateVariantId", selectedVariantId);
    }
    window.open(`/documents/preview?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  const handleDownload = async () => {
    if (!selectedType || isWorking) return;

    const downloadTask = (async () => {
      const rendered = await renderMutation.mutateAsync({
        type: selectedType.type,
        entityId,
        payload: {
          language,
          templateVariantId: selectedVariantId || undefined
        }
      });

      await downloadMutation.mutateAsync({
        downloadUrl: rendered.downloadUrl,
        filename: rendered.number
      });

      return rendered;
    })();

    try {
      await toastPromise(downloadTask, {
        loading: `Đang tạo ${selectedType.label}...`,
        success: `Đã tải xuống ${selectedType.label}`,
        error: `Không thể tạo ${selectedType.label}`,
      });
      setIsOpen(false);
    } catch {
      // Error toast is handled by Sonner promise lifecycle above.
    }
  };

  if (availableOptions.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <AppIcon name="description" className="h-4 w-4" />
            <span>Tạo tài liệu</span>
            <AppIcon name="plus" className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {availableOptions.map((option) => (
            <DropdownMenuItem
              key={option.type}
              onClick={() => handleActionClick(option)}
              className="cursor-pointer"
            >
              <AppIcon name="description" className="mr-2 h-4 w-4 opacity-70" />
              {option.label}
            </DropdownMenuItem>
          ))}
          {availableOptions.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-text-muted">Không có tùy chọn</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Simple Modal Implementation */}
      {isOpen && selectedType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-bg-card shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="border-b border-border/60 px-6 py-4">
              <h3 className="text-lg font-bold text-text-primary">Thiết lập tài liệu</h3>
              <p className="text-sm text-text-secondary">{selectedType.label}</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-text-primary">Ngôn ngữ hiển thị</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLanguage("vi")}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                      language === "vi"
                        ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                        : "border-border bg-transparent text-text-secondary hover:bg-bg-hover"
                    )}
                  >
                    <span className="text-2xl">🇻🇳</span>
                    <span className="text-sm font-medium">Tiếng Việt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("vi-en")}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                      language === "vi-en"
                        ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                        : "border-border bg-transparent text-text-secondary hover:bg-bg-hover"
                    )}
                  >
                    <div className="flex gap-1 text-2xl">
                      <span>🇻🇳</span>
                      <span>🇺🇸</span>
                    </div>
                    <span className="text-sm font-medium">Song ngữ VI-EN</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-text-primary" htmlFor="document-template-variant">
                  Template sử dụng
                </label>
                {runtimeVariantsQuery.isLoading ? (
                  <div className="rounded-xl border border-border bg-bg-hover/40 px-4 py-3 text-sm text-text-secondary">
                    Đang tải danh sách template...
                  </div>
                ) : (
                  <>
                    <select
                      id="document-template-variant"
                      value={selectedVariantId}
                      onChange={(event) => setSelectedVariantId(event.target.value)}
                      className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm font-medium text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Mẫu mặc định / active hiện tại</option>
                      {(runtimeVariantsQuery.data ?? []).map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.name} · v{variant.version}
                          {variant.isActive ? " · active" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-text-secondary">
                      {runtimeVariantsQuery.data?.length
                        ? "Chỉ các template đã publish mới có thể dùng để preview và tạo PDF cho khách."
                        : "Chưa có template đã publish; lựa chọn mặc định sẽ dùng active template nếu có, hoặc fallback mẫu hệ thống."}
                    </p>
                  </>
                )}
              </div>

              <div className="rounded-xl bg-info-bg/50 p-4 text-sm text-info flex gap-3">
                <AppIcon name="clock" className="h-5 w-5 shrink-0" />
                <p>
                  Tài liệu sẽ được tạo mới với số hiệu và ngày tháng hiện tại. Các phiên bản cũ sẽ được lưu trong lịch sử.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border/60 bg-bg-hover/30 px-6 py-4">
              <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isWorking}>
                Hủy
              </Button>
              <Button variant="outline" onClick={handlePreview} disabled={isWorking}>
                Xem trước (HTML)
              </Button>
              <Button onClick={handleDownload} disabled={isWorking}>
                {isWorking ? "Đang tạo..." : "Tải xuống PDF"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
