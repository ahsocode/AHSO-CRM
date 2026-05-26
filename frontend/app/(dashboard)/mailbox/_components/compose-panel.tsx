"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronDown, Maximize2, Minimize2, Paperclip, Send, Settings, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useContactsAutocomplete,
  useDeleteDraft,
  useMailboxSignature,
  useReplyEmail,
  useSaveDraft,
  useSendEmail,
  useUpdateSignature,
  useUploadAttachment,
  type SendEmailInput,
} from "@/hooks/use-mailbox";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { EmailMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./rich-text-editor";

export type ComposeMode = "new" | "reply" | "replyAll" | "forward";

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

function EmailChipsInput({
  label,
  chips,
  onAdd,
  onRemove,
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
        onBlur={() => {
          if (draft.trim()) flushSync(() => commit());
          setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && (suggestions.data?.length ?? 0) > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-border/50 bg-white shadow-lg">
          {suggestions.data?.map((s) => (
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

export function SignatureEditor({ onClose }: { onClose: () => void }) {
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

export function ComposeWindow({
  mode,
  replyTo,
  onClose,
}: {
  mode: ComposeMode;
  replyTo?: EmailMessage;
  onClose: () => void;
}) {
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
  const [attachedFiles, setAttachedFiles] = useState<{ id: string; file: File; path?: string; uploading: boolean }[]>([]);

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

  const [bodyHtml, setBodyHtml] = useState(initialContent);

  useEffect(() => {
    setBodyHtml((current) => current.trim() ? current : initialContent);
  }, [initialContent]);

  const autoSaveStateRef = useRef({ to, cc, bcc, subject, saveDraft });
  autoSaveStateRef.current = { to, cc, bcc, subject, saveDraft };

  const scheduleAutoSave = useCallback((html: string) => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      const { to, cc, bcc, subject, saveDraft } = autoSaveStateRef.current;
      if (!html && !subject && !to.length) return;
      setDraftStatus("saving");
      try {
        const result = await saveDraft.mutateAsync({ draftId: draftIdRef.current, to, cc, bcc, subject, bodyHtml: html });
        draftIdRef.current = result?.draftId;
        setDraftStatus("saved");
      } catch { setDraftStatus(""); }
    }, 30_000);
  }, []);

  const handleBodyChange = (html: string) => {
    setBodyHtml(html);
    scheduleAutoSave(html);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      const fileId = `${Date.now()}-${Math.random()}`;
      setAttachedFiles((prev) => [...prev, { id: fileId, file, uploading: true }]);
      try {
        const result = await uploadAttachment.mutateAsync(file);
        setAttachedFiles((prev) => prev.map((a) => a.id === fileId ? { ...a, path: result?.path, uploading: false } : a));
      } catch {
        setAttachedFiles((prev) => prev.filter((a) => a.id !== fileId));
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
        await replyEmail.mutateAsync({
          messageId: replyTo.id,
          bodyHtml,
          replyAll: mode === "replyAll",
          attachments: attachmentPaths
        });
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
  const titleMap: Record<ComposeMode, string> = {
    new: "Soạn email mới", reply: "Trả lời", replyAll: "Trả lời tất cả", forward: "Chuyển tiếp"
  };

  return (
    <div className={cn(
      "fixed z-50 flex flex-col overflow-hidden border border-white/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]",
      "inset-0 rounded-none",
      maximized ? "md:inset-4 md:rounded-2xl"
        : minimized ? "md:inset-auto md:bottom-0 md:right-6 md:h-11 md:w-[500px] md:rounded-t-2xl"
          : "md:inset-auto md:bottom-0 md:right-6 md:h-[580px] md:w-[580px] md:rounded-t-2xl"
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
            <RichTextEditor content={bodyHtml} placeholder="Nội dung email..." onChange={handleBodyChange} />
          </div>

          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-border/20 px-3 py-2">
              {attachedFiles.map((a) => (
                <div key={a.id} className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs", a.uploading ? "bg-bg-hover text-text-muted" : "bg-bg-subtle text-text-secondary")}>
                  <Paperclip size={11} />
                  <span className="max-w-32 truncate">{a.file.name}</span>
                  <span className="text-text-muted">({formatSize(a.file.size)})</span>
                  {a.uploading
                    ? <span className="text-text-muted">↑</span>
                    : <button type="button" onClick={() => setAttachedFiles((p) => p.filter((f) => f.id !== a.id))} className="text-text-muted hover:text-danger"><X size={10} /></button>
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

export function SignatureButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-xl border border-border/50 px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-hover">
      <Settings size={13} />
      Chữ ký
    </button>
  );
}
