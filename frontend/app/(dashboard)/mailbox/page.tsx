"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  useBulkMailboxAction,
  useMailboxFolders,
  useMailboxMessage,
  useMailboxMessages,
  useMailboxThreads,
  useSyncMailbox,
} from "@/hooks/use-mailbox";
import { toast } from "@/hooks/use-toast";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { ApiResponse, EmailMessage, EmailThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ComposeMode, ComposeWindow, SignatureEditor } from "./_components/compose-panel";
import { FolderSidebar } from "./_components/folder-sidebar";
import { MessageDetail } from "./_components/message-detail";
import { MessageList } from "./_components/message-list";
import { ThreadDetail } from "./_components/thread-detail";
import { ThreadList } from "./_components/thread-list";

type MobilePanel = "folders" | "messages" | "viewer";

const LIMIT = 50;

export default function MailboxPage() {
  const searchParams = useSearchParams();

  const [folder, setFolder] = useState("INBOX");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [allMessages, setAllMessages] = useState<EmailMessage[]>([]);
  const [allThreads, setAllThreads] = useState<EmailThread[]>([]);

  // Thread mode for INBOX; flat list for other folders
  const isThreadMode = folder === "INBOX";

  // Flat list state
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Thread state
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);

  const [compose, setCompose] = useState<{ mode: ComposeMode; replyTo?: EmailMessage } | null>(null);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("folders");

  const foldersQuery = useMailboxFolders();
  const messagesQuery = useMailboxMessages({ folder, search: search || undefined, page, limit: LIMIT });
  const threadsQuery = useMailboxThreads({ folder, search: search || undefined, page, limit: LIMIT });
  const messageQuery = useMailboxMessage(isThreadMode ? null : selectedMessageId);
  const syncMutation = useSyncMailbox();
  const bulkAction = useBulkMailboxAction();

  const folders = foldersQuery.data ?? [];
  const messageItems = messagesQuery.data?.items;
  const threadItems = threadsQuery.data?.items;
  const total = isThreadMode
    ? (threadsQuery.data?.meta?.total ?? 0)
    : (messagesQuery.data?.meta?.total ?? 0);

  // Reset on folder/search change
  useEffect(() => {
    setPage(1);
    setAllMessages([]);
    setAllThreads([]);
    setSelectedIds(new Set());
    setSelectedMessageId(null);
    setSelectedThread(null);
  }, [folder, search]);

  // Accumulate flat messages pages
  useEffect(() => {
    if (isThreadMode) return;
    const items = messageItems;
    if (!items) return;
    if (page === 1) {
      setAllMessages(items);
    } else {
      setAllMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...prev, ...items.filter((m) => !ids.has(m.id))];
      });
    }
  }, [messageItems, page, isThreadMode]);

  // Accumulate thread pages
  useEffect(() => {
    if (!isThreadMode) return;
    const items = threadItems;
    if (!items) return;
    if (page === 1) {
      setAllThreads(items);
    } else {
      setAllThreads((prev) => {
        const ids = new Set(prev.map((t) => t.id));
        return [...prev, ...items.filter((t) => !ids.has(t.id))];
      });
    }
  }, [threadItems, page, isThreadMode]);

  // URL param: open a specific message
  useEffect(() => {
    const id = searchParams.get("message");
    if (id && !isThreadMode) setSelectedMessageId(id);
  }, [searchParams, isThreadMode]);

  const openCompose = useCallback((mode: ComposeMode, replyTo?: EmailMessage) => setCompose({ mode, replyTo }), []);

  const handleThreadReply = useCallback(async (mode: ComposeMode, messageId: string) => {
    try {
      const response = await apiClient.get<ApiResponse<EmailMessage>>(`/mailbox/messages/${messageId}`);
      openCompose(mode, response.data.data);
    } catch (error) {
      toast({
        title: "Không mở được nội dung trả lời",
        description: getApiErrorMessage(error),
        variant: "destructive"
      });
    }
  }, [openCompose]);

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
    const result = await bulkAction.mutateAsync({ ids: Array.from(selectedIds), action });
    setSelectedIds(new Set());
    if (action === "delete" && selectedIds.has(selectedMessageId ?? "")) setSelectedMessageId(null);

    if (result?.success === false) {
      toast({
        title: "Một số email chưa xử lý được",
        description: result.message,
        variant: "destructive"
      });
    }
  };

  const handleFolderSelect = (f: string) => {
    setFolder(f);
    setSelectedMessageId(null);
    setSelectedThread(null);
    setMobilePanel("messages");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Email"
        title="Hộp thư AHSO"
        description="Quản lý email iRedMail ngay trong CRM, tự động liên kết với khách hàng theo contact email."
      />

      <div className="grid h-[calc(100vh-220px)] min-h-[560px] overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_14px_35px_rgba(15,23,42,0.06)] md:grid-cols-[200px_360px_minmax(0,1fr)]">
        {/* Folder panel */}
        <div className={cn("min-h-0", mobilePanel === "folders" ? "flex flex-col" : "hidden md:flex md:flex-col")}>
          <FolderSidebar
            folders={folders}
            activeFolder={folder}
            isLoading={foldersQuery.isLoading}
            isSyncing={syncMutation.isPending}
            onSelect={handleFolderSelect}
            onCompose={() => openCompose("new")}
            onSync={() => { setPage(1); syncMutation.mutate(); }}
            onSignature={() => setShowSignatureEditor(true)}
          />
        </div>

        {/* Message/Thread list */}
        <div className={cn("min-h-0 flex-col", mobilePanel === "messages" ? "flex" : "hidden md:flex")}>
          <button type="button" onClick={() => setMobilePanel("folders")}
            className="flex items-center gap-1.5 border-b border-border/30 px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary md:hidden">
            <ChevronLeft size={15} /> Thư mục
          </button>

          {isThreadMode
            ? <ThreadList
                threads={allThreads}
                selectedThreadId={selectedThread?.id ?? null}
                isLoading={threadsQuery.isFetching && allThreads.length === 0}
                isError={threadsQuery.isError}
                search={search}
                total={total}
                onSearch={(v) => setSearch(v)}
                onSelect={(t) => { setSelectedThread(t); setMobilePanel("viewer"); }}
                onLoadMore={() => setPage((p) => p + 1)}
                onRetry={() => threadsQuery.refetch()}
              />
            : <MessageList
                messages={allMessages}
                selectedIds={selectedIds}
                selectedMessageId={selectedMessageId}
                isLoading={messagesQuery.isFetching && allMessages.length === 0}
                isError={messagesQuery.isError}
                search={search}
                total={total}
                onSearch={(v) => setSearch(v)}
                onSelect={(id) => { setSelectedMessageId(id); setMobilePanel("viewer"); }}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onBulkAction={handleBulkAction}
                onLoadMore={() => setPage((p) => p + 1)}
                onRetry={() => messagesQuery.refetch()}
              />
          }
        </div>

        {/* Viewer panel */}
        <div className={cn("min-h-0 flex-col", mobilePanel === "viewer" ? "flex" : "hidden md:flex")}>
          <button type="button" onClick={() => setMobilePanel("messages")}
            className="flex items-center gap-1.5 border-b border-border/30 px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-primary md:hidden">
            <ChevronLeft size={15} /> Danh sách thư
          </button>

          {isThreadMode
            ? <ThreadDetail
                thread={selectedThread}
                onReply={handleThreadReply}
              />
            : <MessageDetail
                message={messageQuery.data}
                isLoading={messageQuery.isLoading}
                onReply={() => messageQuery.data && openCompose("reply", messageQuery.data)}
                onReplyAll={() => messageQuery.data && openCompose("replyAll", messageQuery.data)}
                onForward={() => messageQuery.data && openCompose("forward", messageQuery.data)}
              />
          }
        </div>
      </div>

      {compose && (
        <ComposeWindow mode={compose.mode} replyTo={compose.replyTo} onClose={() => setCompose(null)} />
      )}

      {showSignatureEditor && <SignatureEditor onClose={() => setShowSignatureEditor(false)} />}
    </div>
  );
}
