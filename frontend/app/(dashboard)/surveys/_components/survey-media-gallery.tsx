"use client";

import { useRef } from "react";
import { FileIcon, Star, Upload, VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadSurveyMedia } from "@/hooks/use-surveys";
import type { SurveyMedia } from "@/lib/types";

interface SurveyMediaGalleryProps {
  surveyId: string;
  projectId?: string | null;
  media: SurveyMedia[];
}

export function SurveyMediaGallery({ surveyId, projectId, media }: SurveyMediaGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadSurveyMedia(projectId ?? "");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      await upload.mutateAsync({ surveyId, file });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{media.length} tệp đính kèm</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload className="mr-2 h-4 w-4" />
          {upload.isPending ? "Đang tải..." : "Tải lên"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.docx,.xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {media.length === 0 && (
        <p className="py-8 text-center text-sm text-text-muted">Chưa có tệp đính kèm nào</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {media.map((item) => (
          <MediaCard key={item.id} media={item} />
        ))}
      </div>
    </div>
  );
}

function MediaCard({ media }: { media: SurveyMedia }) {
  const isImage = media.kind === "IMAGE";
  const isVideo = media.kind === "VIDEO";

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-lg border border-border bg-bg-subtle transition-colors hover:border-primary-light"
    >
      {isImage ? (
        <div className="aspect-square overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.url}
            alt={media.caption ?? media.filename ?? ""}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-square items-center justify-center bg-bg-hover">
          {isVideo ? (
            <VideoIcon className="h-10 w-10 text-text-muted" />
          ) : (
            <FileIcon className="h-10 w-10 text-text-muted" />
          )}
        </div>
      )}

      {media.isImportant && (
        <span className="absolute right-1 top-1 rounded-full bg-warning/20 p-0.5">
          <Star className="h-3 w-3 fill-warning text-warning" />
        </span>
      )}

      <div className="p-2">
        {media.caption ? (
          <p className="truncate text-xs font-medium text-text-primary">{media.caption}</p>
        ) : (
          <p className="truncate text-xs text-text-muted">{media.filename ?? "Xem tệp"}</p>
        )}
        {media.area && (
          <p className="truncate text-xs text-text-muted">{media.area}</p>
        )}
      </div>
    </a>
  );
}
