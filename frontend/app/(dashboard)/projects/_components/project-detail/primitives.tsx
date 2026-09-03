"use client";

import { type ReactNode, useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { AppIcon } from "@/components/shared/app-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  BusinessDocument,
  BusinessDocumentSource,
  BusinessDocumentStatus,
  BusinessDocumentType,
  GeneratedProjectDocument,
  SurveyMedia
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_SOURCE_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  GENERATED_DOCUMENT_LABELS,
  type AppIconName
} from "./constants";
import { downloadSecureFile, formatFileSize, openSecureFile } from "./file-utils";

export function ActionSignal({
  icon,
  label,
  title,
  description,
  onClick
}: {
  icon: AppIconName;
  label: string;
  title: ReactNode;
  description: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <AppIcon name={icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
          <p className="mt-1 line-clamp-1 font-heading text-lg font-bold text-text-primary">{title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{description}</p>
        </div>
      </div>
      {onClick ? (
        <span className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Mở tab
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-3xl border border-white/70 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm">
      {content}
    </div>
  );
}

export function TimelineItemLink({ href }: { href: string }) {
  const className = "mt-3 inline-flex text-sm font-semibold text-primary hover:text-primary-hover";

  if (href.startsWith("/")) {
    return (
      <Link href={href as Route} className={className}>
        Mở liên kết
      </Link>
    );
  }

  return (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      Mở liên kết
    </a>
  );
}

export function DocumentStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-bg-hover/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <p className="mt-2 font-heading text-2xl font-extrabold text-text-primary">{value}</p>
    </div>
  );
}

export function SurveyMediaCard({ media }: { media: SurveyMedia }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    if (media.kind !== "IMAGE") {
      return undefined;
    }

    let objectUrl: string | null = null;
    let isMounted = true;

    apiClient
      .get(`/surveys/media/${media.id}/file`, { responseType: "blob" })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
        objectUrl = window.URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (isMounted) {
          setPreviewError(true);
        }
      });

    return () => {
      isMounted = false;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [media.id, media.kind]);

  const filePath = `/surveys/media/${media.id}/file`;
  const filename = media.filename ?? "survey-media";

  return (
    <div className="group overflow-hidden rounded-2xl border border-border/60 bg-bg-hover/60 text-sm transition hover:border-primary/40 hover:bg-white">
      {media.kind === "IMAGE" ? (
        <button
          type="button"
          className="block aspect-[4/3] w-full overflow-hidden bg-slate-100 text-left"
          onClick={() => {
            if (previewUrl) {
              window.open(previewUrl, "_blank", "noopener,noreferrer");
            }
          }}
        >
          {previewUrl ? (
            // Survey previews use object URLs created from authenticated blobs; Next Image cannot optimize these safely.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={media.caption ?? media.filename ?? "Ảnh khảo sát"}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-text-muted">
              {previewError ? "Không tải được ảnh" : "Đang tải ảnh..."}
            </div>
          )}
        </button>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-primary/5 text-primary">
          <AppIcon name={media.kind === "VIDEO" ? "activity" : "description"} className="h-8 w-8" />
        </div>
      )}
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={media.kind === "IMAGE" ? "success" : media.kind === "VIDEO" ? "warning" : "neutral"}>
            {media.kind === "IMAGE" ? "Ảnh" : media.kind === "VIDEO" ? "Video" : "File"}
          </Badge>
          {media.isImportant ? <Badge variant="warning">Quan trọng</Badge> : null}
        </div>
        <p className="line-clamp-2 font-semibold text-text-primary">{media.caption ?? filename}</p>
        <p className="text-text-secondary">{media.area ?? "Chưa gắn khu vực"}</p>
        {media.size ? <p className="text-xs text-text-muted">{formatFileSize(media.size)}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openSecureFile(filePath, filename).catch((error) => {
              toast({
                title: "Không mở được media",
                description: getApiErrorMessage(error, "Vui lòng thử lại."),
                variant: "destructive"
              });
            })}
          >
            Mở file
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => downloadSecureFile(filePath, filename).catch((error) => {
              toast({
                title: "Không tải được media",
                description: getApiErrorMessage(error, "Vui lòng thử lại."),
                variant: "destructive"
              });
            })}
          >
            Tải file
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FileActionButtons({
  documentId,
  fileUrl,
  filename,
  mimeType,
  size
}: {
  documentId: string;
  fileUrl?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  size?: number | null;
}) {
  const [isOpening, setIsOpening] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!fileUrl) {
    return <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">Chưa có file</span>;
  }

  const mightBeBrokenPdf = mimeType === "application/pdf" && typeof size === "number" && size > 0 && size < 1024;
  const safeFilename = filename ?? "business-document";

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isOpening}
        onClick={async () => {
          setIsOpening(true);
          try {
            await openSecureFile(`/business-documents/${documentId}/file`, safeFilename);
          } catch (error) {
            toast({
              title: "Không mở được file",
              description: getApiErrorMessage(error, "Vui lòng thử lại."),
              variant: "destructive"
            });
          } finally {
            setIsOpening(false);
          }
        }}
      >
        {isOpening ? "Đang mở..." : "Xem file"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isDownloading}
        onClick={async () => {
          setIsDownloading(true);
          try {
            await downloadSecureFile(`/business-documents/${documentId}/file`, safeFilename);
          } catch (error) {
            toast({
              title: "Không tải được file",
              description: getApiErrorMessage(error, "Vui lòng thử lại."),
              variant: "destructive"
            });
          } finally {
            setIsDownloading(false);
          }
        }}
      >
        {isDownloading ? "Đang tải..." : "Tải file"}
      </Button>
      {mightBeBrokenPdf ? (
        <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">
          PDF rất nhỏ, có thể là file test hoặc file lỗi
        </span>
      ) : null}
    </>
  );
}

export function GeneratedDocumentRow({ document }: { document: GeneratedProjectDocument }) {
  const [isOpening, setIsOpening] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadPath = `/documents/${document.id}/download`;
  const documentNumber = document.number || document.id;
  const filename = `${documentNumber}.pdf`;

  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-semibold text-text-primary">{documentNumber}</p>
          <p className="text-text-secondary">
            {GENERATED_DOCUMENT_LABELS[document.type] ?? document.type} · {document.renderedAt ? formatDateTime(document.renderedAt) : formatDateTime(document.createdAt)}
          </p>
          <p className="mt-1 text-xs text-text-muted">Nguồn chuẩn: endpoint tải lại document đã render, không sinh version mới.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isOpening}
            onClick={async () => {
              setIsOpening(true);
              try {
                await openSecureFile(downloadPath, filename);
              } catch (error) {
                toast({
                  title: "Không mở được PDF",
                  description: getApiErrorMessage(error, "Vui lòng render lại tài liệu hoặc thử tải lại."),
                  variant: "destructive"
                });
              } finally {
                setIsOpening(false);
              }
            }}
          >
            {isOpening ? "Đang mở..." : "Xem PDF"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isDownloading}
            onClick={async () => {
              setIsDownloading(true);
              try {
                await downloadSecureFile(downloadPath, filename);
              } catch (error) {
                toast({
                  title: "Không tải được PDF",
                  description: getApiErrorMessage(error, "Vui lòng thử lại."),
                  variant: "destructive"
                });
              } finally {
                setIsDownloading(false);
              }
            }}
          >
            {isDownloading ? "Đang tải..." : "Tải PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DocumentRow({
  document,
  compact = false
}: {
  document: Pick<
    BusinessDocument,
    "id" | "type" | "source" | "status" | "title" | "documentNo" | "documentDate" | "fileUrl" | "filename" | "size"
  >;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-white/80 p-4", compact && "p-3")}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-semibold text-text-primary">{document.title || "Tài liệu chưa đặt tên"}</p>
          <p className="text-sm text-text-secondary">
            {DOCUMENT_TYPE_LABELS[document.type as BusinessDocumentType] ?? document.type}
            {document.documentNo ? ` · ${document.documentNo}` : ""}
            {document.documentDate ? ` · ${formatDate(document.documentDate)}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
            <span className="rounded-full bg-bg-hover px-2 py-1">
              {DOCUMENT_SOURCE_LABELS[document.source as BusinessDocumentSource] ?? document.source}
            </span>
            {document.filename ? <span className="rounded-full bg-bg-hover px-2 py-1">{document.filename}</span> : null}
            {document.size ? <span className="rounded-full bg-bg-hover px-2 py-1">{formatFileSize(document.size)}</span> : null}
          </div>
        </div>
        <Badge variant={document.status === "SIGNED" || document.status === "ACCEPTED" ? "success" : "neutral"}>
          {DOCUMENT_STATUS_LABELS[document.status as BusinessDocumentStatus] ?? document.status}
        </Badge>
      </div>
    </div>
  );
}

export function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="metric-sheen noise-edge border border-white/70">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{label}</p>
        <p className="mt-3 font-heading text-3xl font-extrabold text-text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}

export function MiniPanel({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{label}</p>
      <p className="mt-2 font-semibold text-text-primary">{value}</p>
    </div>
  );
}

export function MiniInfo({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <p className="mt-2 font-semibold text-text-primary">{value}</p>
    </div>
  );
}
