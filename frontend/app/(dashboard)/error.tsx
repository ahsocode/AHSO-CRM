"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("AHSO CRM dashboard error boundary", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center justify-center px-4 py-12">
      <section className="w-full rounded-[32px] border border-danger/20 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-danger">Runtime Guard</p>
        <h1 className="mt-4 font-heading text-3xl font-extrabold text-text-primary">Không thể hiển thị màn hình này</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Một phần giao diện vừa gặp dữ liệu thiếu hoặc lỗi runtime. Boundary đã giữ dashboard hoạt động để bạn có thể thử lại.
        </p>
        {error.digest ? <p className="mt-3 text-xs text-text-muted">Mã lỗi: {error.digest}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            Thử lại
          </button>
          <Link
            href="/dashboard"
            className="rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-hover"
          >
            Về dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
