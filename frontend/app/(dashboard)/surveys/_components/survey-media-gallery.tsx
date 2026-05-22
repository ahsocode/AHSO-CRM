"use client";

import { FileIcon, Star, Upload, VideoIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useUploadSurveyMedia } from "@/hooks/use-surveys";
import { toast } from "@/hooks/use-toast";
import type { SurveyMedia } from "@/lib/types";

interface SurveyMediaGalleryProps {
  surveyId: string;
  projectId?: string | null;
  media: SurveyMedia[];
}

const ACCEPT = {
  "image/*": [],
  "video/*": [],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

export function SurveyMediaGallery({ surveyId, projectId, media }: SurveyMediaGalleryProps) {
  const upload = useUploadSurveyMedia(projectId ?? "");

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPT,
    maxSize: 50 * 1024 * 1024,
    multiple: true,
    disabled: upload.isPending,
    noClick: true,   // we control click manually via the button / empty-state click
    onDrop: async (acceptedFiles) => {
      for (const file of acceptedFiles) {
        await upload.mutateAsync({ surveyId, file });
      }
    },
    onDropRejected: (rejections) => {
      const count = rejections.length;
      toast({
        title: `${count} tệp bị từ chối`,
        description: "Chỉ chấp nhận ảnh, video, PDF, DOCX, XLSX — tối đa 50MB/tệp.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{media.length} tệp đính kèm</p>
        <button
          type="button"
          onClick={open}
          disabled={upload.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {upload.isPending ? "Đang tải..." : "Tải lên"}
        </button>
      </div>

      {/* Drop zone (empty state) */}
      {media.length === 0 && (
        <button
          type="button"
          onClick={open}
          disabled={upload.isPending}
          className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition
            ${isDragActive
              ? "border-primary bg-primary-bg text-primary"
              : "border-border/60 text-text-secondary hover:border-primary/40 hover:bg-bg-subtle"}`}
        >
          <Upload className="mb-3 h-8 w-8 opacity-60" />
          <p className="text-sm font-medium">
            {isDragActive ? "Thả tệp vào đây..." : "Kéo thả hoặc click để tải lên"}
          </p>
          <p className="mt-1 text-xs text-text-muted">Ảnh · Video · PDF · DOCX · XLSX — tối đa 50MB/tệp</p>
        </button>
      )}

      {/* Compact drag overlay when there's already media */}
      {media.length > 0 && isDragActive && (
        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary-bg py-6 text-sm font-medium text-primary">
          <Upload className="mr-2 h-4 w-4" />
          Thả tệp để tải lên...
        </div>
      )}

      {/* Media grid */}
      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <MediaCard key={item.id} media={item} />
          ))}
        </div>
      )}
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
