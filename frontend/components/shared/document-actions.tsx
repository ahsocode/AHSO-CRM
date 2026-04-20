"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppIcon } from "@/components/shared/app-icon";
import { cn } from "@/lib/utils";
import { useDownloadDocument } from "@/hooks/use-documents";
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
  contract: [
    { type: "CONTRACT", label: "Hợp đồng kinh tế" },
    { type: "CONTRACT_ADDENDUM", label: "Phụ lục hợp đồng" },
  ],
  project: [
    { type: "PROPOSAL", label: "Đề xuất dự án" },
    { type: "SURVEY_REPORT", label: "Báo cáo khảo sát" },
  ],
  customer: [
    { type: "NDA", label: "Thỏa thuận bảo mật (NDA)" },
    { type: "AR_RECONCILIATION", label: "Đối chiếu công nợ" },
  ],
};

export function DocumentActions({
  entityType,
  entityId,
  customerLanguage = "vi",
  options,
}: DocumentActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentActionOption | null>(null);
  const [language, setLanguage] = useState<"vi" | "vi-en">(
    customerLanguage === "vi-en" ? "vi-en" : "vi"
  );

  const { success, error, loading } = useToast();
  const downloadMutation = useDownloadDocument();

  const availableOptions = options || DEFAULT_OPTIONS[entityType] || [];

  const handleActionClick = (option: DocumentActionOption) => {
    setSelectedType(option);
    setIsOpen(true);
  };

  const handlePreview = () => {
    if (!selectedType) return;
    window.open(
      `/api/documents/${selectedType.type}/${entityId}/preview?lang=${language}`,
      "_blank"
    );
  };

  const handleDownload = async () => {
    if (!selectedType) return;
    loading(`Đang tạo ${selectedType.label}...`);
    try {
      await downloadMutation.mutateAsync({
        type: selectedType.type,
        entityId,
        lang: language,
        filename: `${selectedType.label}_${entityId}`,
      });
      success(`Đã tải xuống ${selectedType.label}`);
      setIsOpen(false);
    } catch (err) {
      error(`Không thể tạo tài liệu: ${(err as Error).message}`);
    }
  };

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

              <div className="rounded-xl bg-info-bg/50 p-4 text-sm text-info flex gap-3">
                <AppIcon name="clock" className="h-5 w-5 shrink-0" />
                <p>
                  Tài liệu sẽ được tạo mới với số hiệu và ngày tháng hiện tại. Các phiên bản cũ sẽ được lưu trong lịch sử.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border/60 bg-bg-hover/30 px-6 py-4">
              <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={downloadMutation.isPending}>
                Hủy
              </Button>
              <Button variant="outline" onClick={handlePreview} disabled={downloadMutation.isPending}>
                Xem trước (HTML)
              </Button>
              <Button onClick={handleDownload} disabled={downloadMutation.isPending}>
                {downloadMutation.isPending ? "Đang tạo..." : "Tải xuống PDF"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
