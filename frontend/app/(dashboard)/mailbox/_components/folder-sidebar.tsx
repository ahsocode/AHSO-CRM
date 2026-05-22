"use client";

import { RefreshCw, Settings } from "lucide-react";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MailboxFolder } from "@/lib/types";
import { cn } from "@/lib/utils";

const FOLDER_ICONS: Record<string, string> = {
  INBOX: "📥", Sent: "📤", Drafts: "📝", Trash: "🗑️", Junk: "🚫", "Junk Email": "🚫", Spam: "🚫", Archive: "📦"
};

export function FolderSidebar({
  folders,
  activeFolder,
  isLoading,
  isSyncing,
  onSelect,
  onCompose,
  onSync,
  onSignature,
}: {
  folders: MailboxFolder[];
  activeFolder: string;
  isLoading: boolean;
  isSyncing: boolean;
  onSelect: (f: string) => void;
  onCompose: () => void;
  onSync: () => void;
  onSignature: () => void;
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
