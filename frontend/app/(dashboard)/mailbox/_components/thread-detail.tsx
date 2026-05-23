"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Reply, Star, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { useDeleteMessage, useMailboxMessage, useMarkRead, useStarMessage } from "@/hooks/use-mailbox";
import { apiClient } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { EmailThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sanitizeEmailHtml } from "./email-sanitizer";

type ComposeMode = "reply" | "replyAll" | "forward";

function MessageBody({ messageId, showImages }: { messageId: string; showImages: boolean }) {
  const query = useMailboxMessage(messageId);
  const [resolvedHtml, setResolvedHtml] = useState<string | null>(null);

  useEffect(() => {
    setResolvedHtml(null);
    if (!query.data?.bodyHtml) return;

    const inlineAtts = (query.data.attachments ?? []).filter(
      (att) => att.cid && /cid:/i.test(query.data.bodyHtml ?? "")
    );
    if (inlineAtts.length === 0) {
      setResolvedHtml(query.data.bodyHtml);
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
      let html = query.data?.bodyHtml ?? "";
      for (const { cid, dataUrl } of cidMap) {
        const escaped = cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        html = html.replace(new RegExp(`src="cid:${escaped}"`, "gi"), `src="${dataUrl}"`);
        html = html.replace(new RegExp(`src='cid:${escaped}'`, "gi"), `src='${dataUrl}'`);
      }
      setResolvedHtml(html);
    });
  }, [query.data?.id, query.data?.bodyHtml, query.data?.attachments]);

  if (query.isLoading) return <LoadingSkeleton className="h-40 w-full" />;
  if (!query.data?.bodyHtml && !query.data?.bodyText) return null;

  const safeHtml = sanitizeEmailHtml(resolvedHtml ?? query.data?.bodyHtml, showImages);

  return safeHtml
    ? <iframe
        title="Email content"
        sandbox=""
        className="mt-3 h-[280px] min-h-[120px] w-full rounded-xl border border-border/40 bg-white"
        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Be Vietnam Pro',sans-serif;font-size:13px;line-height:1.6;color:#1C2833;padding:12px;margin:0}img{max-width:100%}a{color:#1A5276}</style></head><body>${safeHtml}</body></html>`}
      />
    : <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-bg-subtle p-4 text-sm text-text-primary">{query.data.bodyText}</pre>;
}

function ThreadMessageItem({
  id,
  fromName,
  fromEmail,
  receivedAt,
  snippet,
  isExpanded,
  isLatest,
  onToggle,
  onReply,
}: {
  id: string;
  fromName: string | null;
  fromEmail: string;
  receivedAt: string;
  snippet: string;
  isExpanded: boolean;
  isLatest: boolean;
  onToggle: () => void;
  onReply: (mode: ComposeMode, messageId: string) => void;
}) {
  const [showImages, setShowImages] = useState(false);
  const markRead = useMarkRead();
  const starMessage = useStarMessage();
  const deleteMessage = useDeleteMessage();
  const msgQuery = useMailboxMessage(isExpanded ? id : null);
  const sender = fromName || fromEmail || "Không rõ";
  const senderInitial = sender.trim().charAt(0).toUpperCase() || "?";
  const toAddresses = msgQuery.data?.toAddresses ?? [];

  return (
    <div className={cn(
      "overflow-hidden rounded-xl border transition",
      isExpanded ? "border-primary/20 bg-white shadow-sm" : "border-border/30 hover:bg-bg-hover/60",
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {senderInitial}
          </div>
          <div>
            <p className={cn("text-sm font-semibold text-text-primary", isLatest && "font-bold")}>
              {sender}
            </p>
            {!isExpanded && (
              <p className="mt-0.5 max-w-[240px] truncate text-xs text-text-muted">{snippet}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-text-muted">{formatDateTime(receivedAt)}</span>
          {isExpanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          {msgQuery.data && (
            <div className="mb-2 text-xs text-text-secondary">
              <span className="font-medium">Từ:</span> {fromName ? `${fromName} <${fromEmail}>` : sender}
              {toAddresses.length > 0 && (
                <span className="ml-3"><span className="font-medium">Đến:</span> {toAddresses.map((a) => a.email).join(", ")}</span>
              )}
            </div>
          )}

          <MessageBody messageId={id} showImages={showImages} />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => onReply("reply", id)} className="gap-1.5">
              <Reply size={12} /> Trả lời
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowImages((v) => !v)}>
              {showImages ? "Ẩn ảnh" : "Hiện ảnh"}
            </Button>
            {msgQuery.data && (
              <>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => starMessage.mutate({ messageId: id, isStarred: !msgQuery.data.isStarred })}
                  className={cn("gap-1.5", msgQuery.data.isStarred && "border-warning text-warning")}>
                  <Star size={12} className={cn(msgQuery.data.isStarred && "fill-warning")} />
                  {msgQuery.data.isStarred ? "Bỏ sao" : "Sao"}
                </Button>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => markRead.mutate({ messageId: id, isRead: !msgQuery.data.isRead })}>
                  {msgQuery.data.isRead ? "Chưa đọc" : "Đã đọc"}
                </Button>
              </>
            )}
            <Button type="button" size="sm" variant="destructive"
              onClick={() => deleteMessage.mutate(id)} className="gap-1.5">
              <Trash2 size={12} /> Xóa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ThreadDetail({
  thread,
  onReply,
}: {
  thread: EmailThread | null;
  onReply: (mode: ComposeMode, messageId: string) => void;
}) {
  const replies = Array.isArray(thread?.replies) ? thread.replies : [];
  const allItems = thread
    ? [{
        id: thread.id,
        fromName: thread.fromName ?? null,
        fromEmail: thread.fromEmail || "Không rõ",
        receivedAt: thread.receivedAt || thread.latestAt || new Date().toISOString(),
        isRead: thread.isRead,
        snippet: thread.snippet ?? "",
      }, ...replies]
    : [];

  const latestId = allItems.length > 0 ? allItems[allItems.length - 1].id : null;
  const [expandedId, setExpandedId] = useState<string | null>(latestId);

  useEffect(() => {
    if (thread) {
      const threadReplies = Array.isArray(thread.replies) ? thread.replies : [];
      const latest = [...threadReplies].pop()?.id ?? thread.id;
      setExpandedId(latest);
    }
  }, [thread]);

  if (!thread) {
    return (
      <div className="flex min-h-[520px] items-center justify-center p-6">
        <EmptyState title="Chọn một cuộc trò chuyện" description="Nội dung email sẽ hiển thị ở khung này." />
      </div>
    );
  }

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="border-b border-border/30 px-5 py-4">
        <h2 className="font-heading text-lg font-bold text-text-primary">{thread.subject || "(Không tiêu đề)"}</h2>
        <p className="mt-1 text-xs text-text-muted">
          {allItems.length} tin nhắn · Từ {thread.fromName || thread.fromEmail}
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {allItems.map((item) => (
          <ThreadMessageItem
            key={item.id}
            id={item.id}
            fromName={item.fromName}
            fromEmail={item.fromEmail}
            receivedAt={item.receivedAt}
            snippet={item.snippet}
            isExpanded={expandedId === item.id}
            isLatest={item.id === latestId}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onReply={onReply}
          />
        ))}
      </div>
    </article>
  );
}
