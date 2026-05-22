"use client";

import { RotateCcw, Star } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmailThread } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function ThreadAvatar({ name, email }: { name: string | null; email: string }) {
  const sender = (name || email || "?").trim();
  const initial = sender.charAt(0).toUpperCase() || "?";
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
      {initial}
    </div>
  );
}

export function ThreadList({
  threads,
  selectedThreadId,
  isLoading,
  isError,
  search,
  total,
  onSearch,
  onSelect,
  onLoadMore,
  onRetry,
}: {
  threads: EmailThread[];
  selectedThreadId: string | null;
  isLoading: boolean;
  isError: boolean;
  search: string;
  total: number;
  onSearch: (v: string) => void;
  onSelect: (thread: EmailThread) => void;
  onLoadMore: () => void;
  onRetry: () => void;
}) {
  return (
    <section className="flex h-full flex-col gap-2 overflow-hidden border-b border-border/30 p-3 md:border-b-0 md:border-r">
      <input
        className="w-full rounded-xl border border-border/40 bg-bg-subtle px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        placeholder="Tìm kiếm..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {threads.length > 0 && (
          <p className="px-1 pb-1 text-xs text-text-muted">{total} cuộc trò chuyện</p>
        )}

        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <LoadingSkeleton key={i} className="h-[68px] w-full" />)
          : isError
            ? (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <p className="text-sm font-medium text-danger">Không tải được email</p>
                <p className="text-xs text-text-muted">Lỗi kết nối hoặc server timeout.</p>
                <button type="button" onClick={onRetry}
                  className="flex items-center gap-1.5 rounded-xl border border-border/50 px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover">
                  <RotateCcw size={13} /> Thử lại
                </button>
              </div>
            )
            : threads.length > 0
            ? threads.map((thread) => {
              const replies = Array.isArray(thread.replies) ? thread.replies : [];
              const sender = thread.fromName || thread.fromEmail || "Không rõ người gửi";
              const latestAt = thread.latestAt || thread.receivedAt || new Date().toISOString();
              const latestSnippet = replies[replies.length - 1]?.snippet ?? thread.snippet ?? "";

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onSelect({ ...thread, replies })}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
                    selectedThreadId === thread.id
                      ? "border-primary/30 bg-primary-bg"
                      : "border-transparent hover:bg-bg-hover",
                    thread.hasUnread && selectedThreadId !== thread.id && "bg-primary-bg/30",
                  )}
                >
                  <ThreadAvatar name={thread.fromName} email={thread.fromEmail || ""} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-sm text-text-primary", thread.hasUnread && "font-bold")}>
                        {sender}
                        {thread.replyCount > 0 && (
                          <span className="ml-1.5 rounded-full bg-bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
                            {thread.replyCount + 1}
                          </span>
                        )}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {thread.isStarred && <Star size={11} className="fill-warning text-warning" />}
                        <span className="text-[11px] text-text-muted">{formatDateTime(latestAt)}</span>
                      </div>
                    </div>
                    <p className={cn("mt-0.5 truncate text-sm", thread.hasUnread ? "font-semibold text-text-primary" : "text-text-secondary")}>
                      {thread.subject || "(Không tiêu đề)"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">{latestSnippet}</p>
                  </div>

                  {thread.hasUnread && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              );
            })
            : <EmptyState title="Không có email" description="Thư mục này chưa có email hoặc bộ lọc chưa khớp." />
        }

        {threads.length < total && threads.length > 0 && (
          <button type="button" onClick={onLoadMore}
            className="w-full rounded-xl py-2 text-sm text-text-muted hover:bg-bg-hover">
            Tải thêm ({total - threads.length} còn lại)
          </button>
        )}
      </div>
    </section>
  );
}
