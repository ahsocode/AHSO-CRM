"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("AHSO CRM global error boundary", error);
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#eef4f8] px-6 py-12">
          <section className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white p-8 shadow-[0_24px_70px_rgba(21,67,96,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1a5276]">AHSO CRM</p>
            <h1 className="mt-4 text-3xl font-bold text-[#1f2933]">Ứng dụng gặp lỗi không mong muốn</h1>
            <p className="mt-3 text-sm leading-6 text-[#5b6776]">
              Hệ thống đã chặn lỗi để không hiển thị màn hình trắng. Hãy thử tải lại màn hình hoặc quay về dashboard.
            </p>
            {error.digest ? <p className="mt-3 text-xs text-[#7b8794]">Mã lỗi: {error.digest}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-2xl bg-[#154360] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f334a]"
              >
                Thử lại
              </button>
              <a
                href="/dashboard"
                className="rounded-2xl border border-[#cbd5df] px-5 py-3 text-sm font-semibold text-[#1f2933] transition hover:bg-[#f4f7fa]"
              >
                Về dashboard
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
