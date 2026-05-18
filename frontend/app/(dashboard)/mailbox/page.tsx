"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDeleteMessage,
  useMailboxFolders,
  useMailboxMessage,
  useMailboxMessages,
  useMarkRead,
  useReplyEmail,
  useSendEmail,
  useStarMessage,
  useSyncMailbox,
  type SendEmailInput
} from "@/hooks/use-mailbox";
import { toast } from "@/hooks/use-toast";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { EmailAttachment, EmailMessage, MailboxFolder } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./_components/rich-text-editor";
import {
  ChevronDown,
  Maximize2,
  Minimize2,
  Paperclip,
  RefreshCw,
  Reply,
  ReplyAll,
  RotateCcw,
  Send,
  Star,
  Trash2,
  X
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────

function sanitizeEmailHtml(html?: string | null, showImages = false) {
  if (!html || typeof window === "undefined") return html ?? "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, iframe, object, embed, form, meta").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.toLowerCase();
      if (name.startsWith("on") || value.startsWith("javascript:")) node.removeAttribute(attr.name);
      if (!showImages && node.tagName.toLowerCase() === "img" && name === "src" && /^https?:/.test(value)) {
        node.setAttribute("data-blocked-src", attr.value);
        node.removeAttribute("src");
      }
    });
  });
  return doc.body.innerHTML;
}

function formatSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function buildQuotedHtml(message: EmailMessage) {
  return `<br/><br/><div style="border-left:3px solid #CBD5E1;padding-left:12px;color:#5D6D7E;font-size:13px;margin-top:8px">
    <p style="margin:0 0 4px"><strong>${message.fromName ?? message.fromEmail}</strong> viết vào ${formatDateTime(message.receivedAt)}:</p>
    ${message.bodyHtml ?? `<p>${message.bodyText ?? ""}</p>`}
  </div>`;
}

// ─── Email chips input ────────────────────────────────────────────────────

function EmailChipsInput({
  label,
  chips,
  onAdd,
  onRemove
}: {
  label: string;
  chips: string[];
  onAdd: (email: string) => void;
  onRemove: (email: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && !chips.includes(trimmed)) onAdd(trimmed);
    setDraft("");
  };

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1 border-b border-border/30 px-3 py-1.5">
      <span className="text-xs font-medium text-text-muted">{label}:</span>
      {chips.map((chip) => (
        <span key={chip} className="flex items-center gap-1 rounded-full bg-primary-bg px-2 py-0.5 text-xs text-primary">
          {chip}
          <button type="button" onClick={() => onRemove(chip)} className="text-primary/60 hover:text-primary">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        className="min-w-32 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
        placeholder="Thêm địa chỉ email..."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && chips.length) {
            onRemove(chips[chips.length - 1]);
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

// ─── Compose window ────────────────────────────────────────────────────────

interface ComposeProps {
  mode: "new" | "reply" | "replyAll" | "forward";
  replyTo?: EmailMessage;
  onClose: () => void;
}

function ComposeWindow({ mode, replyTo, onClose }: ComposeProps) {
  const sendEmail = useSendEmail();
  const replyEmail = useReplyEmail();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [bodyHtml, setBodyHtml] = useState("");

  const initialTo = mode === "reply" || mode === "replyAll"
    ? [replyTo?.fromEmail ?? ""]
    : mode === "forward" ? [] : [];

  const initialCc = mode === "replyAll"
    ? (replyTo?.ccAddresses.map((a) => a.email) ?? [])
    : [];

  const [to, setTo] = useState<string[]>(initialTo);
  const [cc, setCc] = useState<string[]>(initialCc);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState(() => {
    if (!replyTo) return "";
    if (mode === "forward") return `Fwd: ${replyTo.subject ?? ""}`;
    if (mode === "reply" || mode === "replyAll")
      return replyTo.subject?.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject ?? ""}`;
    return "";
  });

  const initialContent = replyTo && (mode === "reply" || mode === "replyAll" || mode === "forward")
    ? buildQuotedHtml(replyTo)
    : "";

  const handleSend = async () => {
    if (!to.length || !subject) {
      toast({ title: "Vui lòng nhập người nhận và tiêu đề", variant: "destructive" });
      return;
    }

    try {
      if ((mode === "reply" || mode === "replyAll") && replyTo) {
        await replyEmail.mutateAsync({
          messageId: replyTo.id,
          bodyHtml,
          replyAll: mode === "replyAll"
        });
      } else {
        const payload: SendEmailInput = { to, cc, bcc, subject, bodyHtml };
        await sendEmail.mutateAsync(payload);
      }
      toast({ title: "Đã gửi email thành công" });
      onClose();
    } catch (error) {
      toast({ title: "Không gửi được email", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const titleMap = { new: "Soạn email mới", reply: "Trả lời", replyAll: "Trả lời tất cả", forward: "Chuyển tiếp" };

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-t-2xl border border-white/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]",
        maximized
          ? "inset-4 rounded-2xl"
          : minimized
            ? "bottom-0 right-6 h-11 w-[480px]"
            : "bottom-0 right-6 h-[560px] w-[560px]"
      )}
    >
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between bg-[var(--color-primary)] px-4 py-2.5"
        onClick={() => minimized && setMinimized(false)}
      >
        <span className="text-sm font-semibold text-white">{titleMap[mode]}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={(e) => { e.stopPropagation(); setMinimized((v) => !v); }} className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white">
            {minimized ? <ChevronDown size={15} /> : <Minimize2 size={15} />}
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); setMaximized((v) => !v); setMinimized(false); }} className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white">
            <Maximize2 size={15} />
          </button>
          <button type="button" onClick={onClose} className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white">
            <X size={15} />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Recipients */}
          <EmailChipsInput label="Đến" chips={to} onAdd={(e) => setTo((p) => [...p, e])} onRemove={(e) => setTo((p) => p.filter((x) => x !== e))} />

          {showCc && (
            <EmailChipsInput label="CC" chips={cc} onAdd={(e) => setCc((p) => [...p, e])} onRemove={(e) => setCc((p) => p.filter((x) => x !== e))} />
          )}
          {showBcc && (
            <EmailChipsInput label="BCC" chips={bcc} onAdd={(e) => setBcc((p) => [...p, e])} onRemove={(e) => setBcc((p) => p.filter((x) => x !== e))} />
          )}

          {/* CC/BCC toggles */}
          <div className="flex gap-3 border-b border-border/30 px-3 py-1">
            {!showCc && (
              <button type="button" onClick={() => setShowCc(true)} className="text-xs text-text-muted hover:text-text-secondary">
                + CC
              </button>
            )}
            {!showBcc && (
              <button type="button" onClick={() => setShowBcc(true)} className="text-xs text-text-muted hover:text-text-secondary">
                + BCC
              </button>
            )}
          </div>

          {/* Subject */}
          <input
            className="border-b border-border/30 px-3 py-2 text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
            placeholder="Tiêu đề"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          {/* Body editor */}
          <div className="flex-1 overflow-auto px-1 pt-1">
            <RichTextEditor
              content={initialContent}
              placeholder="Nội dung email..."
              onChange={setBodyHtml}
            />
          </div>

          {/* Attachments list */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-border/20 px-3 py-2">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg bg-bg-subtle px-2 py-1 text-xs text-text-secondary">
                  <Paperclip size={11} />
                  <span className="max-w-32 truncate">{file.name}</span>
                  <span className="text-text-muted">({formatSize(file.size)})</span>
                  <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-text-muted hover:text-danger">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer toolbar */}
          <div className="flex items-center justify-between border-t border-border/20 px-3 py-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                onClick={handleSend}
                disabled={sendEmail.isPending || replyEmail.isPending}
                className="gap-1.5"
              >
                <Send size={13} />
                {sendEmail.isPending || replyEmail.isPending ? "Đang gửi..." : "Gửi"}
              </Button>
              <button
                type="button"
                title="Đính kèm file"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-bg-hover hover:text-text-secondary"
              >
                <Paperclip size={16} />
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
            </div>
            <button
              type="button"
              title="Huỷ bỏ"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Folder panel ──────────────────────────────────────────────────────────

const FOLDER_ICONS: Record<string, string> = {
  INBOX: "📥", Sent: "📤", Drafts: "📝", Trash: "🗑️", Junk: "🚫", "Junk Email": "🚫", Spam: "🚫", Archive: "📦"
};

function FolderPanel({
  folders, activeFolder, isLoading, isSyncing, onSelect, onCompose, onSync
}: {
  folders: MailboxFolder[];
  activeFolder: string;
  isLoading: boolean;
  isSyncing: boolean;
  onSelect: (folder: string) => void;
  onCompose: () => void;
  onSync: () => void;
}) {
  return (
    <aside className="flex flex-col gap-3 border-b border-border/30 p-3 md:border-b-0 md:border-r">
      <Button type="button" onClick={onCompose} className="w-full gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Soạn email
      </Button>

      <div className="space-y-0.5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <LoadingSkeleton key={i} className="h-9 w-full" />)
          : folders.length > 0
            ? folders.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => onSelect(f.path)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                  activeFolder === f.path ? "bg-primary-bg text-primary" : "text-text-secondary hover:bg-bg-hover"
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="text-base">{FOLDER_ICONS[f.name] ?? "📁"}</span>
                  {f.name}
                </span>
                {f.unread > 0 && <Badge variant="info" className="text-[10px]">{f.unread}</Badge>}
              </button>
            ))
            : <p className="px-2 text-sm text-text-muted">Chưa kết nối mailbox.</p>
        }
      </div>

      <button
        type="button"
        onClick={onSync}
        disabled={isSyncing}
        className="mt-auto flex items-center justify-center gap-1.5 rounded-xl border border-border/50 px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-hover disabled:opacity-60"
      >
        <RefreshCw size={13} className={cn(isSyncing && "animate-spin")} />
        {isSyncing ? "Đang đồng bộ..." : "Đồng bộ"}
      </button>
    </aside>
  );
}

// ─── Message list ──────────────────────────────────────────────────────────

function MessageList({
  messages, selectedId, isLoading, search, onSearch, onSelect
}: {
  messages: EmailMessage[];
  selectedId: string | null;
  isLoading: boolean;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-2 border-b border-border/30 p-3 md:border-b-0 md:border-r">
      <input
        className="w-full rounded-xl border border-border/40 bg-bg-subtle px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        placeholder="Tìm theo người gửi, tiêu đề..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div className="flex-1 space-y-1 overflow-auto">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <LoadingSkeleton key={i} className="h-20 w-full" />)
          : messages.length > 0
            ? messages.map((msg) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => onSelect(msg.id)}
                className={cn(
                  "w-full rounded-2xl border p-3 text-left transition",
                  selectedId === msg.id ? "border-primary/30 bg-primary-bg" : "border-transparent hover:bg-bg-hover",
                  !msg.isRead ? "bg-primary-bg/40" : "bg-white"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-sm text-text-primary", !msg.isRead && "font-bold")}>
                    {msg.fromName || msg.fromEmail}
                  </p>
                  <span className="shrink-0 text-[11px] text-text-muted">{formatDateTime(msg.receivedAt)}</span>
                </div>
                <p className={cn("mt-0.5 truncate text-sm", !msg.isRead ? "font-semibold text-text-primary" : "text-text-secondary")}>
                  {msg.subject || "(Không tiêu đề)"}
                </p>
                <p className="mt-0.5 truncate text-xs text-text-muted">{msg.snippet}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  {msg.hasAttachments && <Paperclip size={11} className="text-text-muted" />}
                  {msg.isStarred && <Star size={11} className="fill-warning text-warning" />}
                  {!msg.isRead && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
              </button>
            ))
            : <EmptyState title="Không có email" description="Thư mục này chưa có email hoặc bộ lọc chưa khớp." />
        }
      </div>
    </section>
  );
}

// ─── Message viewer ────────────────────────────────────────────────────────

function MessageViewer({
  message, isLoading, onReply, onReplyAll, onForward
}: {
  message?: EmailMessage;
  isLoading: boolean;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
}) {
  const [showImages, setShowImages] = useState(false);
  const markRead = useMarkRead();
  const starMessage = useStarMessage();
  const deleteMessage = useDeleteMessage();
  const safeHtml = sanitizeEmailHtml(message?.bodyHtml, showImages);

  if (isLoading) {
    return <div className="p-5"><LoadingSkeleton className="h-[520px] w-full" /></div>;
  }

  if (!message) {
    return (
      <div className="flex min-h-[520px] items-center justify-center p-6">
        <EmptyState title="Chọn một email" description="Nội dung email sẽ hiển thị ở khung này." />
      </div>
    );
  }

  return (
    <article className="flex min-h-[520px] flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/30 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <h2 className="font-heading text-xl font-bold text-text-primary">{message.subject || "(Không tiêu đề)"}</h2>
            <div className="mt-2 space-y-1 text-sm text-text-secondary">
              <p><span className="font-medium">Từ:</span> {message.fromName ? `${message.fromName} <${message.fromEmail}>` : message.fromEmail}</p>
              {message.toAddresses.length > 0 && (
                <p className="truncate"><span className="font-medium">Đến:</span> {message.toAddresses.map((a) => a.name ? `${a.name} <${a.email}>` : a.email).join(", ")}</p>
              )}
              {message.ccAddresses.length > 0 && (
                <p className="truncate"><span className="font-medium">CC:</span> {message.ccAddresses.map((a) => a.email).join(", ")}</p>
              )}
              {message.customer && (
                <p><span className="font-medium">Khách hàng:</span> <span className="text-primary">{message.customer.name}</span></p>
              )}
            </div>
          </div>
          <span className="shrink-0 text-xs text-text-muted">{formatDateTime(message.receivedAt)}</span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onReply} className="gap-1.5">
            <Reply size={13} /> Trả lời
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onReplyAll} className="gap-1.5">
            <ReplyAll size={13} /> Trả lời tất cả
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onForward} className="gap-1.5">
            <RotateCcw size={13} /> Chuyển tiếp
          </Button>
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => starMessage.mutate({ messageId: message.id, isStarred: !message.isStarred })}
            className={cn("gap-1.5", message.isStarred && "border-warning text-warning")}
          >
            <Star size={13} className={cn(message.isStarred && "fill-warning")} />
            {message.isStarred ? "Bỏ sao" : "Gắn sao"}
          </Button>
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => markRead.mutate({ messageId: message.id, isRead: !message.isRead })}
          >
            {message.isRead ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
          </Button>
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => setShowImages((v) => !v)}
          >
            {showImages ? "Ẩn ảnh" : "Hiện ảnh"}
          </Button>
          <Button
            type="button" size="sm" variant="destructive"
            onClick={() => deleteMessage.mutate(message.id)}
            className="gap-1.5"
          >
            <Trash2 size={13} /> Xóa
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-auto p-5">
        {safeHtml
          ? <iframe
              title="Nội dung email"
              sandbox="allow-same-origin"
              className="h-[400px] min-h-[300px] w-full rounded-xl border border-border/40 bg-white"
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Be Vietnam Pro',sans-serif;font-size:14px;line-height:1.6;color:#1C2833;padding:16px;margin:0}img{max-width:100%}</style></head><body>${safeHtml}</body></html>`}
            />
          : <pre className="whitespace-pre-wrap rounded-xl bg-bg-subtle p-4 text-sm text-text-primary">{message.bodyText}</pre>
        }

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">File đính kèm ({message.attachments.length})</p>
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((att) => <AttachmentChip key={att.id} attachment={att} />)}
            </div>
          </div>
        )}
      </div>
    </article>
  );
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
    <button
      type="button"
      onClick={handleDownload}
      className="flex items-center gap-2 rounded-xl border border-border/50 bg-bg-subtle px-3 py-2 text-left transition hover:bg-bg-hover"
    >
      <Paperclip size={13} className="shrink-0 text-text-muted" />
      <div>
        <p className="max-w-[160px] truncate text-sm font-medium text-text-primary">{attachment.filename}</p>
        <p className="text-xs text-text-muted">{formatSize(attachment.size)}</p>
      </div>
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

type ComposeMode = "new" | "reply" | "replyAll" | "forward";

export default function MailboxPage() {
  const searchParams = useSearchParams();
  const [folder, setFolder] = useState("INBOX");
  const [search, setSearch] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [compose, setCompose] = useState<{ mode: ComposeMode; replyTo?: EmailMessage } | null>(null);

  const foldersQuery = useMailboxFolders();
  const messagesQuery = useMailboxMessages({ folder, search: search || undefined, page: 1, limit: 50 });
  const messageQuery = useMailboxMessage(selectedMessageId);
  const syncMutation = useSyncMailbox();

  const folders = foldersQuery.data ?? [];
  const messages = messagesQuery.data?.items ?? [];
  const message = messageQuery.data;

  useEffect(() => {
    const id = searchParams.get("message");
    if (id) setSelectedMessageId(id);
  }, [searchParams]);

  const openCompose = useCallback((mode: ComposeMode, replyTo?: EmailMessage) => {
    setCompose({ mode, replyTo });
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Email"
        title="Hộp thư AHSO"
        description="Quản lý email iRedMail ngay trong CRM, tự động liên kết với khách hàng theo contact email."
      />

      <div className="grid min-h-[680px] overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_14px_35px_rgba(15,23,42,0.06)] md:grid-cols-[200px_360px_minmax(0,1fr)]">
        <FolderPanel
          folders={folders}
          activeFolder={folder}
          isLoading={foldersQuery.isLoading}
          isSyncing={syncMutation.isPending}
          onSelect={(f) => { setFolder(f); setSelectedMessageId(null); }}
          onCompose={() => openCompose("new")}
          onSync={() => syncMutation.mutate()}
        />
        <MessageList
          messages={messages}
          selectedId={selectedMessageId}
          isLoading={messagesQuery.isLoading}
          search={search}
          onSearch={setSearch}
          onSelect={setSelectedMessageId}
        />
        <MessageViewer
          message={message}
          isLoading={messageQuery.isLoading}
          onReply={() => message && openCompose("reply", message)}
          onReplyAll={() => message && openCompose("replyAll", message)}
          onForward={() => message && openCompose("forward", message)}
        />
      </div>

      {compose && (
        <ComposeWindow
          mode={compose.mode}
          replyTo={compose.replyTo}
          onClose={() => setCompose(null)}
        />
      )}
    </div>
  );
}
