"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useBulkMailboxAction,
  useContactsAutocomplete,
  useDeleteDraft,
  useDeleteMessage,
  useMailboxFolders,
  useMailboxMessage,
  useMailboxMessages,
  useMailboxSignature,
  useMarkRead,
  useReplyEmail,
  useSaveDraft,
  useSendEmail,
  useStarMessage,
  useSyncMailbox,
  useUpdateSignature,
  useUploadAttachment,
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
  Settings,
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

// ─── Autocomplete email input ──────────────────────────────────────────────

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
  const [open, setOpen] = useState(false);
  const suggestions = useContactsAutocomplete(draft);

  const commit = (value?: string) => {
    const trimmed = (value ?? draft).trim();
    if (trimmed && !chips.includes(trimmed)) onAdd(trimmed);
    setDraft("");
    setOpen(false);
  };

  return (
    <div className="relative flex min-h-8 flex-wrap items-center gap-1 border-b border-border/30 px-3 py-1.5">
      <span className="text-xs font-medium text-text-muted">{label}:</span>
      {chips.map((chip) => (
        <span key={chip} className="flex items-center gap-1 rounded-full bg-primary-bg px-2 py-0.5 text-xs text-primary">
          {chip}
          <button type="button" onClick={() => onRemove(chip)} className="text-primary/60 hover:text-primary"><X size={10} /></button>
        </span>
      ))}
      <input
        className="min-w-32 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
        placeholder="Nhập email..."
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === "Tab") { e.preventDefault(); commit(); }
          else if (e.key === "Backspace" && !draft && chips.length) onRemove(chips[chips.length - 1]);
          else if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (suggestions.data?.length ?? 0) > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-border/50 bg-white shadow-lg">
          {suggestions.data!.map((s) => (
            <button
              key={s.email}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commit(s.email); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-hover"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {(s.name ?? s.email)[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-text-primary">{s.name}</p>
                <p className="text-xs text-text-muted">{s.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Signature editor ──────────────────────────────────────────────────────

function SignatureEditor({ onClose }: { onClose: () => void }) {
  const sigQuery = useMailboxSignature();
  const updateSig = useUpdateSignature();
  const [value, setValue] = useState(sigQuery.data ?? "");

  useEffect(() => { setValue(sigQuery.data ?? ""); }, [sigQuery.data]);

  const handleSave = async () => {
    await updateSig.mutateAsync(value);
    toast({ title: "Đã lưu chữ ký" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/70 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
          <h2 className="font-heading text-lg font-bold text-text-primary">Chữ ký email</h2>
          <button type="button" onClick={onClose}><X size={18} className="text-text-muted" /></button>
        </div>
        <div className="p-5">
          <RichTextEditor content={value} placeholder="Nhập chữ ký email của bạn..." onChange={setValue} />
        </div>
        <div className="flex justify-end gap-2 border-t border-border/30 px-5 py-3">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSave} disabled={updateSig.isPending}>
            {updateSig.isPending ? "Đang lưu..." : "Lưu chữ ký"}
          </Button>
        </div>
      </div>
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
  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteDraft();
  const uploadAttachment = useUploadAttachment();
  const sigQuery = useMailboxSignature();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftIdRef = useRef<string | undefined>(undefined);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [showCc, setShowCc] = useState(mode === "replyAll" && (replyTo?.ccAddresses.length ?? 0) > 0);
  const [showBcc, setShowBcc] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"" | "saving" | "saved">("");
  const [attachedFiles, setAttachedFiles] = useState<{ file: File; path?: string; uploading: boolean }[]>([]);

  const [to, setTo] = useState<string[]>(
    mode === "reply" || mode === "replyAll" ? [replyTo?.fromEmail ?? ""] : []
  );
  const [cc, setCc] = useState<string[]>(
    mode === "replyAll" ? (replyTo?.ccAddresses.map((a) => a.email) ?? []) : []
  );
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState(() => {
    if (!replyTo) return "";
    if (mode === "forward") return `Fwd: ${replyTo.subject ?? ""}`;
    return replyTo.subject?.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject ?? ""}`;
  });

  const sig = sigQuery.data;
  const sigHtml = sig ? `<br/><br/><div style="color:#5D6D7E;font-size:13px;border-top:1px solid #eee;padding-top:8px;margin-top:8px">${sig}</div>` : "";
  const quotedHtml = replyTo && (mode === "reply" || mode === "replyAll" || mode === "forward")
    ? buildQuotedHtml(replyTo)
    : "";
  const initialContent = sigHtml + quotedHtml;

  const [bodyHtml, setBodyHtml] = useState("");

  const scheduleAutoSave = useCallback((html: string) => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      if (!html && !subject && !to.length) return;
      setDraftStatus("saving");
      try {
        const result = await saveDraft.mutateAsync({ draftId: draftIdRef.current, to, cc, bcc, subject, bodyHtml: html });
        draftIdRef.current = result?.draftId;
        setDraftStatus("saved");
      } catch { setDraftStatus(""); }
    }, 30_000);
  }, [subject, to, cc, bcc, saveDraft]);

  const handleBodyChange = (html: string) => {
    setBodyHtml(html);
    scheduleAutoSave(html);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      const index = attachedFiles.length;
      setAttachedFiles((prev) => [...prev, { file, uploading: true }]);
      try {
        const result = await uploadAttachment.mutateAsync(file);
        setAttachedFiles((prev) => prev.map((a, i) => i === index ? { ...a, path: result?.path, uploading: false } : a));
      } catch {
        setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
        toast({ title: "Không tải được file đính kèm", variant: "destructive" });
      }
    }
  };

  const handleSend = async () => {
    if (!to.length || !subject.trim()) {
      toast({ title: "Vui lòng nhập người nhận và tiêu đề", variant: "destructive" });
      return;
    }
    const attachmentPaths = attachedFiles.filter((a) => a.path).map((a) => a.path!);
    try {
      if ((mode === "reply" || mode === "replyAll") && replyTo) {
        await replyEmail.mutateAsync({ messageId: replyTo.id, bodyHtml, replyAll: mode === "replyAll" });
      } else {
        const payload: SendEmailInput = { to, cc, bcc, subject, bodyHtml, attachments: attachmentPaths };
        await sendEmail.mutateAsync(payload);
      }
      if (draftIdRef.current) await deleteDraft.mutateAsync(draftIdRef.current).catch(() => {});
      toast({ title: "Đã gửi email thành công" });
      onClose();
    } catch (error) {
      toast({ title: "Không gửi được email", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDiscard = async () => {
    if (draftIdRef.current) await deleteDraft.mutateAsync(draftIdRef.current).catch(() => {});
    onClose();
  };

  const isPending = sendEmail.isPending || replyEmail.isPending;
  const titleMap = { new: "Soạn email mới", reply: "Trả lời", replyAll: "Trả lời tất cả", forward: "Chuyển tiếp" };

  return (
    <div className={cn(
      "fixed z-50 flex flex-col overflow-hidden rounded-t-2xl border border-white/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]",
      maximized ? "inset-4 rounded-2xl"
        : minimized ? "bottom-0 right-6 h-11 w-[500px]"
          : "bottom-0 right-6 h-[580px] w-[580px]"
    )}>
      <div
        className="flex cursor-pointer items-center justify-between bg-[var(--color-primary)] px-4 py-2.5"
        onClick={() => minimized && setMinimized(false)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{titleMap[mode]}</span>
          {draftStatus === "saving" && <span className="text-xs text-white/60">Đang lưu...</span>}
          {draftStatus === "saved" && <span className="text-xs text-white/60">Đã lưu nháp</span>}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={(e) => { e.stopPropagation(); setMinimized((v) => !v); }} className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white">
            {minimized ? <ChevronDown size={15} /> : <Minimize2 size={15} />}
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); setMaximized((v) => !v); setMinimized(false); }} className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white">
            <Maximize2 size={15} />
          </button>
          <button type="button" onClick={handleDiscard} className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white">
            <X size={15} />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <EmailChipsInput label="Đến" chips={to} onAdd={(e) => setTo((p) => [...p, e])} onRemove={(e) => setTo((p) => p.filter((x) => x !== e))} />
          {showCc && <EmailChipsInput label="CC" chips={cc} onAdd={(e) => setCc((p) => [...p, e])} onRemove={(e) => setCc((p) => p.filter((x) => x !== e))} />}
          {showBcc && <EmailChipsInput label="BCC" chips={bcc} onAdd={(e) => setBcc((p) => [...p, e])} onRemove={(e) => setBcc((p) => p.filter((x) => x !== e))} />}

          <div className="flex gap-3 border-b border-border/30 px-3 py-1">
            {!showCc && <button type="button" onClick={() => setShowCc(true)} className="text-xs text-text-muted hover:text-text-secondary">+ CC</button>}
            {!showBcc && <button type="button" onClick={() => setShowBcc(true)} className="text-xs text-text-muted hover:text-text-secondary">+ BCC</button>}
          </div>

          <input
            className="border-b border-border/30 px-3 py-2 text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
            placeholder="Tiêu đề"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <div className="flex-1 overflow-auto px-1 pt-1">
            <RichTextEditor content={initialContent} placeholder="Nội dung email..." onChange={handleBodyChange} />
          </div>

          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-border/20 px-3 py-2">
              {attachedFiles.map((a, i) => (
                <div key={i} className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs", a.uploading ? "bg-bg-hover text-text-muted" : "bg-bg-subtle text-text-secondary")}>
                  <Paperclip size={11} />
                  <span className="max-w-32 truncate">{a.file.name}</span>
                  <span className="text-text-muted">({formatSize(a.file.size)})</span>
                  {a.uploading
                    ? <span className="text-text-muted">↑</span>
                    : <button type="button" onClick={() => setAttachedFiles((p) => p.filter((_, j) => j !== i))} className="text-text-muted hover:text-danger"><X size={10} /></button>
                  }
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/20 px-3 py-2">
            <div className="flex items-center gap-1">
              <Button type="button" size="sm" onClick={handleSend} disabled={isPending} className="gap-1.5">
                <Send size={13} />
                {isPending ? "Đang gửi..." : "Gửi"}
              </Button>
              <button type="button" title="Đính kèm file" onClick={() => fileInputRef.current?.click()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-bg-hover hover:text-text-secondary">
                <Paperclip size={16} />
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
            </div>
            <button type="button" title="Huỷ bỏ" onClick={handleDiscard}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger">
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

function FolderPanel({ folders, activeFolder, isLoading, isSyncing, onSelect, onCompose, onSync, onSignature }: {
  folders: MailboxFolder[]; activeFolder: string; isLoading: boolean; isSyncing: boolean;
  onSelect: (f: string) => void; onCompose: () => void; onSync: () => void; onSignature: () => void;
}) {
  return (
    <aside className="flex h-full flex-col gap-3 overflow-hidden border-b border-border/30 p-3 md:border-b-0 md:border-r">
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
              <button key={f.path} type="button" onClick={() => onSelect(f.path)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                  activeFolder === f.path ? "bg-primary-bg text-primary" : "text-text-secondary hover:bg-bg-hover"
                )}>
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

      <div className="mt-auto flex flex-col gap-1">
        <button type="button" onClick={onSync} disabled={isSyncing}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border/50 px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-hover disabled:opacity-60">
          <RefreshCw size={13} className={cn(isSyncing && "animate-spin")} />
          {isSyncing ? "Đang đồng bộ..." : "Đồng bộ"}
        </button>
        <button type="button" onClick={onSignature}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border/50 px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-hover">
          <Settings size={13} />
          Chữ ký
        </button>
      </div>
    </aside>
  );
}

// ─── Message list ──────────────────────────────────────────────────────────

function MessageList({ messages, selectedIds, selectedMessageId, isLoading, search, total, onSearch, onSelect, onToggleSelect, onSelectAll, onBulkAction, onLoadMore }: {
  messages: EmailMessage[]; selectedIds: Set<string>; selectedMessageId: string | null;
  isLoading: boolean; search: string; total: number;
  onSearch: (v: string) => void; onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void; onSelectAll: () => void;
  onBulkAction: (action: "markRead" | "markUnread" | "star" | "unstar" | "delete") => void;
  onLoadMore: () => void;
}) {
  const allSelected = messages.length > 0 && messages.every((m) => selectedIds.has(m.id));

  return (
    <section className="flex h-full flex-col gap-2 overflow-hidden border-b border-border/30 p-3 md:border-b-0 md:border-r">
      <input
        className="w-full rounded-xl border border-border/40 bg-bg-subtle px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        placeholder="Tìm kiếm..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-1 rounded-xl bg-primary-bg px-2 py-1.5">
          <span className="mr-1 text-xs font-medium text-primary">{selectedIds.size} đã chọn</span>
          <button type="button" onClick={() => onBulkAction("markRead")} className="rounded px-2 py-0.5 text-xs text-text-secondary hover:bg-white">Đã đọc</button>
          <button type="button" onClick={() => onBulkAction("markUnread")} className="rounded px-2 py-0.5 text-xs text-text-secondary hover:bg-white">Chưa đọc</button>
          <button type="button" onClick={() => onBulkAction("star")} className="rounded px-2 py-0.5 text-xs text-text-secondary hover:bg-white">Gắn sao</button>
          <button type="button" onClick={() => onBulkAction("delete")} className="rounded px-2 py-0.5 text-xs text-danger hover:bg-danger-bg">Xóa</button>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {messages.length > 0 && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <input type="checkbox" checked={allSelected} onChange={onSelectAll} className="h-3.5 w-3.5 rounded accent-primary" />
            <span className="text-xs text-text-muted">{messages.length}/{total} email</span>
          </div>
        )}

        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <LoadingSkeleton key={i} className="h-20 w-full" />)
          : messages.length > 0
            ? messages.map((msg) => (
              <div key={msg.id} className={cn(
                "group relative flex w-full items-start gap-2 rounded-2xl border p-3 text-left transition",
                selectedMessageId === msg.id ? "border-primary/30 bg-primary-bg" : "border-transparent hover:bg-bg-hover",
                !msg.isRead ? "bg-primary-bg/40" : "bg-white",
                selectedIds.has(msg.id) && "border-primary/20 bg-primary-bg/60"
              )}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(msg.id)}
                  onChange={() => onToggleSelect(msg.id)}
                  className="mt-1 h-3.5 w-3.5 shrink-0 rounded accent-primary opacity-0 group-hover:opacity-100 data-[checked=true]:opacity-100"
                  data-checked={selectedIds.has(msg.id)}
                />
                <button type="button" onClick={() => onSelect(msg.id)} className="flex-1 text-left">
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
              </div>
            ))
            : <EmptyState title="Không có email" description="Thư mục này chưa có email hoặc bộ lọc chưa khớp." />
        }

        {messages.length < total && messages.length > 0 && (
          <button type="button" onClick={onLoadMore}
            className="w-full rounded-xl py-2 text-sm text-text-muted hover:bg-bg-hover">
            Tải thêm ({total - messages.length} còn lại)
          </button>
        )}
      </div>
    </section>
  );
}

// ─── Message viewer ────────────────────────────────────────────────────────

function MessageViewer({ message, isLoading, onReply, onReplyAll, onForward }: {
  message?: EmailMessage; isLoading: boolean;
  onReply: () => void; onReplyAll: () => void; onForward: () => void;
}) {
  const [showImages, setShowImages] = useState(false);
  const markRead = useMarkRead();
  const starMessage = useStarMessage();
  const deleteMessage = useDeleteMessage();
  const safeHtml = sanitizeEmailHtml(message?.bodyHtml, showImages);

  if (isLoading) return <div className="p-5"><LoadingSkeleton className="h-[520px] w-full" /></div>;
  if (!message) return (
    <div className="flex min-h-[520px] items-center justify-center p-6">
      <EmptyState title="Chọn một email" description="Nội dung email sẽ hiển thị ở khung này." />
    </div>
  );

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden">
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
              sandbox="allow-same-origin"
              className="h-[400px] min-h-[300px] w-full rounded-xl border border-border/40 bg-white"
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Be Vietnam Pro',sans-serif;font-size:14px;line-height:1.6;color:#1C2833;padding:16px;margin:0}img{max-width:100%}a{color:#1A5276}</style></head><body>${safeHtml}</body></html>`}
            />
          : <pre className="whitespace-pre-wrap rounded-xl bg-bg-subtle p-4 text-sm text-text-primary">{message.bodyText}</pre>
        }

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              File đính kèm ({message.attachments.length})
            </p>
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

// ─── Main page ─────────────────────────────────────────────────────────────

type ComposeMode = "new" | "reply" | "replyAll" | "forward";

export default function MailboxPage() {
  const searchParams = useSearchParams();
  const [folder, setFolder] = useState("INBOX");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [allMessages, setAllMessages] = useState<EmailMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compose, setCompose] = useState<{ mode: ComposeMode; replyTo?: EmailMessage } | null>(null);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);

  const LIMIT = 50;
  const foldersQuery = useMailboxFolders();
  const messagesQuery = useMailboxMessages({ folder, search: search || undefined, page, limit: LIMIT });
  const messageQuery = useMailboxMessage(selectedMessageId);
  const syncMutation = useSyncMailbox();
  const bulkAction = useBulkMailboxAction();

  const folders = foldersQuery.data ?? [];
  const pageItems = messagesQuery.data?.items ?? [];
  const total = messagesQuery.data?.meta.total ?? 0;

  // Accumulate pages
  useEffect(() => {
    if (page === 1) setAllMessages(pageItems);
    else setAllMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      return [...prev, ...pageItems.filter((m) => !ids.has(m.id))];
    });
  }, [pageItems, page]);

  // Reset on folder/search change
  useEffect(() => { setPage(1); setAllMessages([]); setSelectedIds(new Set()); }, [folder, search]);

  useEffect(() => {
    const id = searchParams.get("message");
    if (id) setSelectedMessageId(id);
  }, [searchParams]);

  const openCompose = useCallback((mode: ComposeMode, replyTo?: EmailMessage) => setCompose({ mode, replyTo }), []);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allMessages.every((m) => selectedIds.has(m.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allMessages.map((m) => m.id)));
    }
  };

  const handleBulkAction = async (action: "markRead" | "markUnread" | "star" | "unstar" | "delete") => {
    if (!selectedIds.size) return;
    await bulkAction.mutateAsync({ ids: Array.from(selectedIds), action });
    setSelectedIds(new Set());
    if (action === "delete" && selectedIds.has(selectedMessageId ?? "")) setSelectedMessageId(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Email" title="Hộp thư AHSO" description="Quản lý email iRedMail ngay trong CRM, tự động liên kết với khách hàng theo contact email." />

      <div className="grid h-[calc(100vh-220px)] min-h-[560px] overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_14px_35px_rgba(15,23,42,0.06)] md:grid-cols-[200px_360px_minmax(0,1fr)]">
        <FolderPanel
          folders={folders}
          activeFolder={folder}
          isLoading={foldersQuery.isLoading}
          isSyncing={syncMutation.isPending}
          onSelect={(f) => { setFolder(f); setSelectedMessageId(null); }}
          onCompose={() => openCompose("new")}
          onSync={() => { setPage(1); syncMutation.mutate(); }}
          onSignature={() => setShowSignatureEditor(true)}
        />
        <MessageList
          messages={allMessages}
          selectedIds={selectedIds}
          selectedMessageId={selectedMessageId}
          isLoading={messagesQuery.isLoading && page === 1}
          search={search}
          total={total}
          onSearch={(v) => setSearch(v)}
          onSelect={setSelectedMessageId}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onBulkAction={handleBulkAction}
          onLoadMore={() => setPage((p) => p + 1)}
        />
        <MessageViewer
          message={messageQuery.data}
          isLoading={messageQuery.isLoading}
          onReply={() => messageQuery.data && openCompose("reply", messageQuery.data)}
          onReplyAll={() => messageQuery.data && openCompose("replyAll", messageQuery.data)}
          onForward={() => messageQuery.data && openCompose("forward", messageQuery.data)}
        />
      </div>

      {compose && (
        <ComposeWindow mode={compose.mode} replyTo={compose.replyTo} onClose={() => setCompose(null)} />
      )}

      {showSignatureEditor && <SignatureEditor onClose={() => setShowSignatureEditor(false)} />}
    </div>
  );
}
