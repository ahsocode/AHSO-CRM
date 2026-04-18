"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { AppIcon } from "@/components/shared/app-icon";
import { ROLE_LABELS } from "@/lib/constants";
import { AuthUser } from "@/lib/types";

export function Topbar({
  user,
  onLogout
}: {
  user: AuthUser | null;
  onLogout: () => Promise<void>;
}) {
  const router = useRouter();

  return (
    <header className="glass-panel sticky top-0 z-30 border-b border-white/80 px-4 py-4 print:hidden md:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-xl">
          <AppIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input className="rounded-full border-white/60 bg-white/80 pl-11" placeholder="Tìm kiếm khách hàng, dự án, báo giá..." />
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-text-secondary ring-1 ring-white/70 transition hover:text-primary">
            <AppIcon name="bell" className="h-[18px] w-[18px]" />
          </button>

          <Button variant="primary" onClick={() => router.push("/customers")}>
            <AppIcon name="plus" className="h-4 w-4" />
            Thêm mới
          </Button>

          <button
            className="flex items-center gap-3 rounded-full bg-white/80 px-2 py-1.5 ring-1 ring-white/70 transition hover:bg-white"
            onClick={() => void onLogout()}
            type="button"
          >
            <AvatarInitials className="h-10 w-10 rounded-full text-xs" name={user?.name ?? "AHSO CRM"} />
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold text-text-primary">{user?.name ?? "Đang tải..."}</p>
              <p className="text-xs text-text-secondary">{user ? ROLE_LABELS[user.role] : "Phiên làm việc"}</p>
            </div>
            <AppIcon name="logout" className="h-4 w-4 text-text-secondary" />
          </button>
        </div>
      </div>
    </header>
  );
}
