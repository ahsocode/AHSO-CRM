"use client";

import { useEffect, useState } from "react";
import { Paperclip, Reply, ReplyAll, RotateCcw, Star, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { useDeleteMessage, useMarkRead, useStarMessage } from "@/hooks/use-mailbox";
import { toast } from "@/hooks/use-toast";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { EmailAttachment, EmailMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sanitizeEmailHtml } from "./email-sanitizer";

function formatSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function AttachmentChip({ attachment }: { attachment: EmailAttachment }) {
  const handleDownload = async () => {
    try {
      const response = await apiClient.get(`/mailbox/attachments/${attachment.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Không tải được file", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <button type="button" onClick={handleDownload}
      className="flex items-center gap-2 rounded-xl border border-border/50 bg-bg-subtle px-3 py-2 text-left transition hover:bg-bg-hover">
      <Paperclip size={13} className="shrink-0 text-text-muted" />
      <div>
        <p className="max-w-[160px] truncate text-sm font-medium text-text-primary">{attachment.filename}</p>
        <p className="text-xs text-text-muted">{formatSize(attachment.size)}</p>
      </div>
    </button>
  );
}

export function MessageDetail({
  message,
  isLoading,
  onReply,
  onReplyAll,
  onForward,
}: {
  message?: EmailMessage;
  isLoading: boolean;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
}) {
  const [showImages, setShowImages] = useState(false);
  const [resolvedHtml, setResolvedHtml] = useState<string | null>(null);
  const markRead = useMarkRead();
  const starMessage = useStarMessage();
  const deleteMessage = useDeleteMessage();

  // Replace cid: inline image references with base64 data URLs so they render in the iframe.
  useEffect(() => {
    setResolvedHtml(null);
    if (!message?.bodyHtml) return;

    const inlineAtts = (message.attachments ?? []).filter(
      (att) => att.cid && /cid:/i.test(message.bodyHtml ?? "")
    );
    if (inlineAtts.length === 0) {
      setResolvedHtml(message.bodyHtml);
      return;
    }

    void Promise.all(
      inlineAtts.map(async (att) => {
        try {
          const res = await apiClient.get<ArrayBuffer>(`/mailbox/attachments/${att.id}/download`, {
            responseType: "arraybuffer"
          });
          const bytes = new Uint8Array(res.data as ArrayBuffer);
          const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), "");
          const base64 = btoa(binary);
          const cleanCid = (att.cid ?? "").replace(/^<|>$/g, "");
          return { cid: cleanCid, dataUrl: `data:${att.mimeType};base64,${base64}` };
        } catch {
          return null;
        }
      })
    ).then((results) => {
      const cidMap = results.filter((r): r is { cid: string; dataUrl: string } => r !== null);
      let html = message.bodyHtml ?? "";
      for (const { cid, dataUrl } of cidMap) {
        const escaped = cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        html = html.replace(new RegExp(`src="cid:${escaped}"`, "gi"), `src="${dataUrl}"`);
        html = html.replace(new RegExp(`src='cid:${escaped}'`, "gi"), `src='${dataUrl}'`);
      }
      setResolvedHtml(html);
    });
  }, [message?.attachments, message?.bodyHtml, message?.id]);

  const safeHtml = sanitizeEmailHtml(resolvedHtml ?? message?.bodyHtml, showImages);

  if (isLoading) return <div className="p-5"><LoadingSkeleton className="h-[520px] w-full" /></div>;
  if (!message) return (
    <div className="flex min-h-[520px] items-center justify-center p-6">
      <EmptyState title="Chọn một email" description="Nội dung email sẽ hiển thị ở khung này." />
    </div>
  );

  const toAddresses = Array.isArray(message.toAddresses) ? message.toAddresses : [];
  const ccAddresses = Array.isArray(message.ccAddresses) ? message.ccAddresses : [];
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const fromLabel = message.fromName ? `${message.fromName} <${message.fromEmail}>` : (message.fromEmail || "Không rõ người gửi");

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="border-b border-border/30 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <h2 className="font-heading text-xl font-bold text-text-primary">{message.subject || "(Không tiêu đề)"}</h2>
            <div className="mt-2 space-y-1 text-sm text-text-secondary">
              <p><span className="font-medium">Từ:</span> {fromLabel}</p>
              {toAddresses.length > 0 && (
                <p className="truncate"><span className="font-medium">Đến:</span> {toAddresses.map((a) => a.name ? `${a.name} <${a.email}>` : a.email).join(", ")}</p>
              )}
              {ccAddresses.length > 0 && (
                <p className="truncate"><span className="font-medium">CC:</span> {ccAddresses.map((a) => a.email).join(", ")}</p>
              )}
              {message.customer && (
                <p><span className="font-medium">Khách hàng:</span> <span className="text-primary">{message.customer.name}</span></p>
              )}
            </div>
          </div>
          <span className="shrink-0 text-xs text-text-muted">{formatDateTime(message.receivedAt)}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onReply} className="gap-1.5"><Reply size={13} /> Trả lời</Button>
          <Button type="button" size="sm" variant="outline" onClick={onReplyAll} className="gap-1.5"><ReplyAll size={13} /> Trả lời tất cả</Button>
          <Button type="button" size="sm" variant="outline" onClick={onForward} className="gap-1.5"><RotateCcw size={13} /> Chuyển tiếp</Button>
          <Button type="button" size="sm" variant="outline"
            onClick={() => starMessage.mutate({ messageId: message.id, isStarred: !message.isStarred })}
            className={cn("gap-1.5", message.isStarred && "border-warning text-warning")}>
            <Star size={13} className={cn(message.isStarred && "fill-warning")} />
            {message.isStarred ? "Bỏ sao" : "Gắn sao"}
          </Button>
          <Button type="button" size="sm" variant="outline"
            onClick={() => markRead.mutate({ messageId: message.id, isRead: !message.isRead })}>
            {message.isRead ? "Chưa đọc" : "Đã đọc"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowImages((v) => !v)}>
            {showImages ? "Ẩn ảnh" : "Hiện ảnh"}
          </Button>
          <Button type="button" size="sm" variant="destructive"
            onClick={() => deleteMessage.mutate(message.id)} className="gap-1.5">
            <Trash2 size={13} /> Xóa
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {safeHtml
          ? <iframe
              title="Email content"
              sandbox=""
              className="h-[400px] min-h-[300px] w-full rounded-xl border border-border/40 bg-white"
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Be Vietnam Pro',sans-serif;font-size:14px;line-height:1.6;color:#1C2833;padding:16px;margin:0}img{max-width:100%}a{color:#1A5276}</style></head><body>${safeHtml}</body></html>`}
            />
          : <pre className="whitespace-pre-wrap rounded-xl bg-bg-subtle p-4 text-sm text-text-primary">{message.bodyText}</pre>
        }

        {attachments.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              File đính kèm ({attachments.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => <AttachmentChip key={att.id} attachment={att} />)}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
