"use client";

import { Paperclip, RotateCcw, Star } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmailMessage } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MessageList({
  messages,
  selectedIds,
  selectedMessageId,
  isLoading,
  isError,
  search,
  total,
  onSearch,
  onSelect,
  onToggleSelect,
  onSelectAll,
  onBulkAction,
  onLoadMore,
  onRetry,
}: {
  messages: EmailMessage[];
  selectedIds: Set<string>;
  selectedMessageId: string | null;
  isLoading: boolean;
  isError: boolean;
  search: string;
  total: number;
  onSearch: (v: string) => void;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onBulkAction: (action: "markRead" | "markUnread" | "star" | "unstar" | "delete") => void;
  onLoadMore: () => void;
  onRetry: () => void;
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
          : isError
            ? (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <p className="text-sm font-medium text-danger">Không tải được email</p>
                <p className="text-xs text-text-muted">Lỗi kết nối hoặc server timeout. Thử lại ngay.</p>
                <button type="button" onClick={onRetry}
                  className="flex items-center gap-1.5 rounded-xl border border-border/50 px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover">
                  <RotateCcw size={13} /> Thử lại
                </button>
              </div>
            )
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
