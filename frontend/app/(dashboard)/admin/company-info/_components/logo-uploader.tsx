"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUploadLogo } from "@/hooks/use-upload";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_LOGO_SIZE = 5 * 1024 * 1024;

function isPreviewableImage(file?: File | null) {
  return Boolean(file && file.type !== "image/svg+xml");
}

export function LogoUploader({
  currentLogoUrl,
  isLoading
}: {
  currentLogoUrl?: string | null;
  isLoading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { error, success } = useToast();
  const uploadLogoMutation = useUploadLogo();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const previewUrl = useMemo(() => {
    if (!selectedFile || !isPreviewableImage(selectedFile)) {
      return null;
    }

    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const displayedLogoUrl = previewUrl ?? currentLogoUrl ?? null;

  const validateFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      error("Logo chỉ chấp nhận PNG, JPG, SVG hoặc WEBP");
      return false;
    }

    if (file.size > MAX_LOGO_SIZE) {
      error("Kích thước logo vượt quá 5MB");
      return false;
    }

    return true;
  };

  const handleFileSelect = (file?: File | null) => {
    if (!file || !validateFile(file)) {
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      error("Vui lòng chọn logo trước khi tải lên");
      return;
    }

    try {
      setProgress(0);
      await uploadLogoMutation.mutateAsync({
        file: selectedFile,
        onProgress: setProgress
      });
      success("Đã cập nhật logo");
      setSelectedFile(null);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      error("Không thể cập nhật logo");
    }
  };

  return (
    <Card className="border border-white/70 bg-white/88">
      <CardHeader>
        <CardTitle>Logo thương hiệu</CardTitle>
        <CardDescription>
          Kéo thả logo vào đây hoặc click để chọn. Hỗ trợ PNG, JPG, SVG, WEBP và tối đa 5MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />
        ) : (
          <div className="rounded-2xl border border-border/70 bg-bg-card p-4">
            <p className="mb-3 text-sm font-semibold text-text-primary">Logo hiện tại</p>
            <div className="flex h-40 items-center justify-center rounded-2xl bg-white">
              {displayedLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayedLogoUrl}
                  alt="Logo công ty"
                  className="max-h-24 max-w-full object-contain"
                />
              ) : (
                <span className="text-sm font-semibold tracking-[0.28em] text-text-secondary">AHSO</span>
              )}
            </div>
          </div>
        )}

        <div
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
            isDragging ? "border-primary bg-primary/5" : "border-border bg-bg-card/60"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFileSelect(event.dataTransfer.files?.[0] ?? null);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
          />
          <p className="text-sm font-semibold text-text-primary">
            Kéo thả logo vào đây hoặc click để chọn
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            {selectedFile ? `Đã chọn: ${selectedFile.name}` : "Chưa có file nào được chọn"}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>
              {selectedFile ? "Thay logo" : "Chọn logo"}
            </Button>
            <Button type="button" onClick={() => void handleUpload()} disabled={!selectedFile || uploadLogoMutation.isPending}>
              {uploadLogoMutation.isPending ? "Đang tải lên..." : "Tải logo"}
            </Button>
          </div>
        </div>

        {uploadLogoMutation.isPending ? (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-text-secondary">{progress}% hoàn tất</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
