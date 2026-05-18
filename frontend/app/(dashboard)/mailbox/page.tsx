"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteMessage,
  useMailboxFolders,
  useMailboxMessage,
  useMailboxMessages,
  useMarkRead,
  useReplyEmail,
  useSendEmail,
  useStarMessage,
  useSyncMailbox
} from "@/hooks/use-mailbox";
import { toast } from "@/hooks/use-toast";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { EmailAttachment, EmailMessage, MailboxFolder } from "@/lib/types";
import { cn } from "@/lib/utils";

function sanitizeEmailHtml(html?: string | null, showImages = false) {
  if (!html) {
    return "";
  }

  if (typeof window === "undefined") {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, iframe, object, embed, form, meta").forEach((node) => node.remove());
  doc.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.toLowerCase();
      if (name.startsWith("on") || value.startsWith("javascript:")) {
        node.removeAttribute(attribute.name);
      }
      if (!showImages && node.tagName.toLowerCase() === "img" && name === "src" && /^https?:/.test(value)) {
        node.setAttribute("data-blocked-src", attribute.value);
        node.removeAttribute("src");
      }
    });
  });

  return doc.body.innerHTML;
}

function formatSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export default function MailboxPage() {
  const searchParams = useSearchParams();
  const [folder, setFolder] = useState("INBOX");
  const [search, setSearch] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const foldersQuery = useMailboxFolders();
  const messagesQuery = useMailboxMessages({ folder, search: search || undefined, page: 1, limit: 50 });
  const messageQuery = useMailboxMessage(selectedMessageId);
  const syncMutation = useSyncMailbox();

  const folders = foldersQuery.data ?? [];
  const messages = messagesQuery.data?.items ?? [];

  useEffect(() => {
    const messageId = searchParams.get("message");
    if (messageId) {
      setSelectedMessageId(messageId);
    }
  }, [searchParams]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mailbox" title="Hộp thư AHSO" description="Quản lý email iRedMail ngay trong CRM, tự động liên kết với khách hàng theo contact email." />

      <div className="grid min-h-[680px] overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_14px_35px_rgba(15,23,42,0.06)] md:grid-cols-[200px_380px_minmax(0,1fr)]">
        <FolderPanel
          folders={folders}
          activeFolder={folder}
          isLoading={foldersQuery.isLoading}
          onSelect={(nextFolder) => {
            setFolder(nextFolder);
            setSelectedMessageId(null);
          }}
          onCompose={() => setIsComposeOpen(true)}
          onSync={() => syncMutation.mutate()}
          isSyncing={syncMutation.isPending}
        />

        <MessageList
          messages={messages}
          selectedMessageId={selectedMessageId}
          isLoading={messagesQuery.isLoading}
          search={search}
          onSearch={setSearch}
          onSelect={setSelectedMessageId}
        />

        <MessageViewer
          message={messageQuery.data}
          isLoading={messageQuery.isLoading}
          onReply={() => setIsComposeOpen(true)}
        />
      </div>

      {isComposeOpen ? (
        <ComposeModal
          replyTo={messageQuery.data}
          onClose={() => setIsComposeOpen(false)}
        />
      ) : null}
    </div>
  );
}

function FolderPanel({
  folders,
  activeFolder,
  isLoading,
  isSyncing,
  onSelect,
  onCompose,
  onSync
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
    <aside className="flex flex-col border-b border-border/40 p-3 md:border-b-0 md:border-r">
      <Button type="button" onClick={onCompose} className="w-full">Soạn email</Button>
      <div className="mt-4 space-y-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <LoadingSkeleton key={index} className="h-9 w-full" />)
        ) : folders.length > 0 ? (
          folders.map((mailFolder) => (
            <button
              key={mailFolder.path}
              type="button"
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium",
                activeFolder === mailFolder.path ? "bg-primary-bg text-primary" : "text-text-secondary hover:bg-bg-hover"
              )}
              onClick={() => onSelect(mailFolder.path)}
            >
              <span className="truncate">{mailFolder.name}</span>
              {mailFolder.unread > 0 ? <Badge variant="info">{mailFolder.unread}</Badge> : null}
            </button>
          ))
        ) : (
          <p className="px-2 text-sm text-text-muted">Chưa kết nối mailbox.</p>
        )}
      </div>
      <Button type="button" variant="outline" className="mt-auto" onClick={onSync} disabled={isSyncing}>
        {isSyncing ? "Đang đồng bộ..." : "Đồng bộ"}
      </Button>
    </aside>
  );
}

function MessageList({
  messages,
  selectedMessageId,
  isLoading,
  search,
  onSearch,
  onSelect
}: {
  messages: EmailMessage[];
  selectedMessageId: string | null;
  isLoading: boolean;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="border-b border-border/40 p-3 md:border-b-0 md:border-r">
      <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Tìm theo người gửi, tiêu đề..." />
      <div className="mt-3 space-y-1">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, index) => <LoadingSkeleton key={index} className="h-20 w-full" />)
        ) : messages.length > 0 ? (
          messages.map((message) => (
            <button
              key={message.id}
              type="button"
              className={cn(
                "w-full rounded-2xl border p-3 text-left transition",
                selectedMessageId === message.id ? "border-primary bg-primary-bg" : "border-transparent hover:bg-bg-hover",
                !message.isRead ? "bg-primary-bg/60" : "bg-white"
              )}
              onClick={() => onSelect(message.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={cn("truncate text-sm text-text-primary", !message.isRead && "font-bold")}>
                  {message.fromName || message.fromEmail}
                </p>
                <span className="shrink-0 text-[11px] text-text-muted">{formatDateTime(message.receivedAt)}</span>
              </div>
              <p className={cn("mt-1 truncate text-sm text-text-primary", !message.isRead && "font-bold")}>
                {message.subject || "(Không tiêu đề)"}
              </p>
              <p className="mt-1 truncate text-xs text-text-muted">{message.snippet}</p>
            </button>
          ))
        ) : (
          <EmptyState title="Không có email" description="Thư mục này chưa có email hoặc bộ lọc chưa khớp." />
        )}
      </div>
    </section>
  );
}

function MessageViewer({
  message,
  isLoading,
  onReply
}: {
  message?: EmailMessage;
  isLoading: boolean;
  onReply: () => void;
}) {
  const [showImages, setShowImages] = useState(false);
  const markRead = useMarkRead();
  const starMessage = useStarMessage();
  const deleteMessage = useDeleteMessage();
  const safeHtml = useMemo(() => sanitizeEmailHtml(message?.bodyHtml, showImages), [message?.bodyHtml, showImages]);

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
    <article className="flex min-h-[520px] flex-col">
      <header className="border-b border-border/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl font-bold text-text-primary">{message.subject || "(Không tiêu đề)"}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {message.fromName ? `${message.fromName} · ` : ""}{message.fromEmail}
            </p>
            <p className="mt-1 text-xs text-text-muted">Đến: {message.toAddresses.map((item) => item.email).join(", ")}</p>
          </div>
          <span className="text-xs text-text-muted">{formatDateTime(message.receivedAt)}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onReply}>Trả lời</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => starMessage.mutate({ messageId: message.id, isStarred: !message.isStarred })}>
            {message.isStarred ? "Bỏ sao" : "Gắn sao"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => markRead.mutate({ messageId: message.id, isRead: !message.isRead })}>
            {message.isRead ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowImages((value) => !value)}>
            {showImages ? "Ẩn ảnh ngoài" : "Hiện ảnh ngoài"}
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => deleteMessage.mutate(message.id)}>Xóa</Button>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-5">
        {safeHtml ? (
          <iframe title="Nội dung email" sandbox="" className="h-[420px] w-full rounded-xl border border-border/60 bg-white" srcDoc={safeHtml} />
        ) : (
          <pre className="whitespace-pre-wrap rounded-xl bg-bg-subtle p-4 text-sm text-text-primary">{message.bodyText}</pre>
        )}
        {message.attachments && message.attachments.length > 0 ? (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">File đính kèm</p>
            {message.attachments.map((attachment) => <AttachmentRow key={attachment.id} attachment={attachment} />)}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function AttachmentRow({ attachment }: { attachment: EmailAttachment }) {
  const handleDownload = async () => {
    try {
      const response = await apiClient.get(`/mailbox/attachments/${attachment.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data as Blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = attachment.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Không tải được file", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <button type="button" onClick={handleDownload} className="flex w-full items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-left hover:bg-bg-hover">
      <span className="truncate text-sm font-medium text-text-primary">{attachment.filename}</span>
      <span className="text-xs text-text-muted">{formatSize(attachment.size)}</span>
    </button>
  );
}

function ComposeModal({ replyTo, onClose }: { replyTo?: EmailMessage; onClose: () => void }) {
  const sendEmail = useSendEmail();
  const replyEmail = useReplyEmail();
  const [to, setTo] = useState(replyTo?.fromEmail ?? "");
  const [subject, setSubject] = useState(replyTo?.subject ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : "");
  const [body, setBody] = useState("");

  const handleSubmit = async () => {
    try {
      if (replyTo) {
        await replyEmail.mutateAsync({ messageId: replyTo.id, bodyHtml: body, bodyText: body });
      } else {
        await sendEmail.mutateAsync({ to: to.split(",").map((item) => item.trim()).filter(Boolean), subject, bodyHtml: body, bodyText: body });
      }
      toast({ title: "Đã gửi email" });
      onClose();
    } catch (error) {
      toast({ title: "Không gửi được email", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4">
      <Card className="w-full max-w-xl border border-white/70 shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-text-primary">{replyTo ? "Trả lời email" : "Soạn email"}</h2>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Đóng</Button>
          </div>
          {!replyTo ? <Input value={to} onChange={(event) => setTo(event.target.value)} placeholder="Người nhận, cách nhau bằng dấu phẩy" /> : null}
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Tiêu đề" disabled={Boolean(replyTo)} />
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-[220px]" placeholder="Nội dung email" />
          <Button type="button" onClick={handleSubmit} disabled={!body || (!replyTo && (!to || !subject)) || sendEmail.isPending || replyEmail.isPending}>
            {sendEmail.isPending || replyEmail.isPending ? "Đang gửi..." : "Gửi email"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
