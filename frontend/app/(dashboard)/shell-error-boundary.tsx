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
        <div className="flex min-h-screen items-center justify-center bg-bg-page px-6 py-12">
          <div className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white p-8 shadow-[0_24px_70px_rgba(21,67,96,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-mid">AHSO CRM</p>
            <h1 className="mt-4 text-2xl font-bold text-text-primary">Giao diện gặp sự cố</h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Một lỗi xảy ra khi tải giao diện chính. Hãy thử tải lại trang để tiếp tục.
            </p>
            {this.state.error?.message ? (
              <p className="mt-3 rounded-xl bg-danger-bg px-3 py-2 font-mono text-xs text-danger">
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
                className="rounded-2xl bg-primary-hover px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary"
              >
                Tải lại trang
              </button>
              <a
                href="/login"
                className="rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-subtle"
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
