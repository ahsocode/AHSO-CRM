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
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/78 px-4 py-4 shadow-[0_12px_36px_rgba(21,67,96,0.06)] backdrop-blur-xl print:hidden md:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="hidden lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/70">Automation Hub</p>
            <p className="mt-1 text-sm text-text-secondary">
              Bảng điều phối vận hành CRM cho đội kinh doanh kỹ thuật.
            </p>
          </div>

          <div className="relative w-full max-w-2xl">
            <AppIcon
              name="search"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/65"
            />
            <Input
              className="h-12 rounded-full border-slate-200 bg-white/92 pl-11 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:border-primary/50"
              placeholder="Tìm kiếm khách hàng, dự án, báo giá..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white/92 text-text-secondary shadow-sm transition hover:border-primary/30 hover:text-primary"
            type="button"
          >
            <AppIcon name="bell" className="h-[18px] w-[18px]" />
          </button>

          <Button className="shadow-[0_12px_22px_rgba(26,82,118,0.18)]" variant="primary" onClick={() => router.push("/customers")}>
            <AppIcon name="plus" className="h-4 w-4" />
            Thêm mới
          </Button>

          <button
            className="flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/92 px-2 py-1.5 shadow-sm transition hover:border-primary/25 hover:bg-white"
            onClick={() => void onLogout()}
            type="button"
          >
            <AvatarInitials className="h-10 w-10 rounded-full bg-primary/12 text-xs text-primary" name={user?.name ?? "AHSO CRM"} />
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
