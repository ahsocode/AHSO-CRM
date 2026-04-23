"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ProjectDetailError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("AHSO CRM project detail error boundary", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-danger/20 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-danger">Project 360 Guard</p>
        <h1 className="mt-4 font-heading text-3xl font-extrabold text-text-primary">Không thể mở hồ sơ dự án</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
          Dữ liệu dự án hoặc một tab trong Project 360 đang thiếu thông tin cần thiết. Bạn có thể thử lại hoặc quay về danh sách dự án.
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
            href="/projects"
            className="rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-hover"
          >
            Quay lại danh sách dự án
          </Link>
        </div>
      </section>
    </div>
  );
}
