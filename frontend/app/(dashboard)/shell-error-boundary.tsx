"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ShellErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error) {
    console.error("AHSO CRM shell error boundary", error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#eef4f8] px-6 py-12">
          <div className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white p-8 shadow-[0_24px_70px_rgba(21,67,96,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1a5276]">AHSO CRM</p>
            <h1 className="mt-4 text-2xl font-bold text-[#1f2933]">Giao diện gặp sự cố</h1>
            <p className="mt-3 text-sm leading-6 text-[#5b6776]">
              Một lỗi xảy ra khi tải giao diện chính. Hãy thử tải lại trang để tiếp tục.
            </p>
            {this.state.error?.message ? (
              <p className="mt-3 rounded-xl bg-[#fef2f2] px-3 py-2 font-mono text-xs text-[#b91c1c]">
                {this.state.error.message}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="rounded-2xl bg-[#154360] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f334a]"
              >
                Tải lại trang
              </button>
              <a
                href="/login"
                className="rounded-2xl border border-[#cbd5df] px-5 py-3 text-sm font-semibold text-[#1f2933] transition hover:bg-[#f4f7fa]"
              >
                Đăng nhập lại
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
