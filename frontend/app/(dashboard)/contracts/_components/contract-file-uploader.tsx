"use client";

import { useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { useUploadFile } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/auth";
import { cn } from "@/lib/utils";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg"
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function ContractFileUploader({
  value,
  disabled,
  error,
  onChange
}: {
  value?: string | null;
  disabled?: boolean;
  error?: string;
  onChange: (nextValue: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadMutation = useUploadFile();
  const { success, error: showError } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const assetUrl = resolveAssetUrl(value);
  const fileLabel = useMemo(() => {
    if (displayName) {
      return displayName;
    }

    if (!value) {
      return null;
    }

    try {
      const url = new URL(assetUrl ?? value);
      const lastSegment = url.pathname.split("/").filter(Boolean).at(-1);
      return lastSegment ? decodeURIComponent(lastSegment) : value;
    } catch {
      const lastSegment = value.split("/").filter(Boolean).at(-1);
      return lastSegment ? decodeURIComponent(lastSegment) : value;
    }
  }, [assetUrl, displayName, value]);

  const validateFile = (file: File) => {
    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      return "Tệp chỉ chấp nhận PDF, PNG, JPG, XLSX hoặc DOCX.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "Kích thước tệp vượt quá 10MB.";
    }

    return null;
  };

  const handleSelectedFile = (file?: File | null) => {
    if (!file || disabled) {
      return;
    }

    const validationMessage = validateFile(file);

    if (validationMessage) {
      showError(validationMessage);
      return;
    }

    setDisplayName(file.name);
    setProgress(0);

    uploadMutation.mutate(
      {
        file,
        onProgress: setProgress
      },
      {
        onSuccess: (result) => {
          onChange(result.url);
          setDisplayName(result.filename);
          setProgress(100);
          success("Đã tải file đính kèm.");
        },
        onError: (uploadError) => {
          setDisplayName(null);
          setProgress(0);
          showError(getApiErrorMessage(uploadError, "Không thể tải file đính kèm."));
        }
      }
    );
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
        disabled={disabled || uploadMutation.isPending}
        onChange={(event) => {
          handleSelectedFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div
        className={cn(
          "rounded-2xl border border-dashed p-5 transition",
          dragActive ? "border-primary bg-primary/5" : "border-border/70 bg-bg-hover/35",
          disabled ? "opacity-70" : ""
        )}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setDragActive(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragActive(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          handleSelectedFile(event.dataTransfer.files?.[0]);
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-text-primary">
              <AppIcon name="description" className="h-5 w-5" />
              <p className="font-semibold">Tệp đính kèm hợp đồng</p>
            </div>
            <p className="text-sm text-text-secondary">
              Kéo thả tệp vào đây hoặc chọn thủ công. Hỗ trợ PDF, PNG, JPG, XLSX, DOCX tối đa 10MB.
            </p>
            {fileLabel ? (
              <p className="text-sm font-medium text-text-primary">Tệp hiện tại: {fileLabel}</p>
            ) : (
              <p className="text-sm text-text-secondary">Chưa có tệp đính kèm.</p>
            )}
            {uploadMutation.isPending ? (
              <p className="text-sm text-primary">Đang tải lên... {progress}%</p>
            ) : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {assetUrl ? (
              <a href={assetUrl} target="_blank" rel="noreferrer">
                <Button type="button" variant="outline">
                  Mở file
                </Button>
              </a>
            ) : null}
            {value ? (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled || uploadMutation.isPending}
                onClick={() => {
                  onChange(null);
                  setDisplayName(null);
                  setProgress(0);
                }}
              >
                Xóa file
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={disabled || uploadMutation.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {value ? "Thay file" : "Chọn file"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
