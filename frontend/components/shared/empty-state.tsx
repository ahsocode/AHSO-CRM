import type { ReactNode } from "react";
import { AppIcon } from "./app-icon";

/**
 * Empty state có CTA: thay vì chỉ thông báo trống, hướng người dùng tới
 * bước tiếp theo (ví dụ "Tạo báo giá đầu tiên cho dự án này").
 */
export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  /** Nút/link hành động kế tiếp — truyền <Button> hoặc <Link> */
  action?: ReactNode;
}) {
  return (
    <div className="surface-card border border-dashed border-border/80 p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <AppIcon name="analytics" className="h-6 w-6" />
      </div>
      <h3 className="font-heading text-xl font-bold text-text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
