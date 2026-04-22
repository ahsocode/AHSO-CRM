"use client";

import { AppIcon } from "@/components/shared/app-icon";
import { useCompanyInfo, useLogo } from "@/hooks/use-settings";
import { resolveAssetUrl } from "@/lib/auth";

export default function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const companyQuery = useCompanyInfo();
  const logoQuery = useLogo();
  const brandName = companyQuery.data?.shortName || companyQuery.data?.name || "AHSO CRM";
  const logoUrl = resolveAssetUrl(logoQuery.data);

  return (
    <main className="auth-grid relative min-h-screen overflow-hidden px-4 py-5 md:px-8 md:py-8">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-12rem] top-[-10rem] h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-[-14rem] right-[-12rem] h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-7xl overflow-hidden rounded-[34px] bg-white/10 shadow-[0_30px_90px_rgba(3,18,30,0.35)] ring-1 ring-white/15 backdrop-blur-md lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-12">
          <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.16),rgba(255,255,255,0)_42%),radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.16),transparent_28%)]" />
          <div className="relative">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/14 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
                  {logoUrl ? (
                    <img src={logoUrl} alt={brandName} className="h-full w-full object-contain p-2" />
                  ) : (
                    <span className="font-heading text-base font-extrabold tracking-[0.18em] text-white">AHSO</span>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">Secure workspace</p>
                  <p className="mt-1 font-heading text-lg font-extrabold text-white">{brandName}</p>
                </div>
              </div>
              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                CRM B2B
              </div>
            </div>

            <div className="mt-16 max-w-2xl">
              <p className="industrial-chip bg-white/12 text-white/80">Project 360 command center</p>
              <h1 className="mt-6 text-balance font-heading text-5xl font-extrabold leading-tight tracking-tight xl:text-6xl">
                Một nơi kiểm soát toàn bộ hành trình khách hàng kỹ thuật.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-white/72">
                Tập trung khách hàng, khảo sát, báo giá, hợp đồng, tài liệu và bàn giao dự án để đội vận hành ra quyết định trên cùng một nguồn dữ liệu.
              </p>
            </div>

            <div className="mt-10 grid max-w-2xl gap-3">
              {[
                { icon: "groups" as const, title: "Khách hàng", text: "Lịch sử tương tác và người phụ trách rõ ràng." },
                { icon: "factory" as const, title: "Dự án", text: "Theo dõi từ khảo sát đến triển khai, nghiệm thu." },
                { icon: "description" as const, title: "Tài liệu", text: "Báo giá, hợp đồng, PO và hồ sơ ký được quản lý xuyên suốt." }
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4 rounded-2xl border border-white/12 bg-white/10 p-4 text-sm text-white/78 shadow-[0_14px_35px_rgba(0,0,0,0.12)] backdrop-blur">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/14 text-white">
                    <AppIcon name={item.icon} className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{item.title}</p>
                    <p className="mt-1 leading-6">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative grid gap-4 text-sm text-white/76 md:grid-cols-3">
            {["JWT bảo mật", "RBAC theo vai trò", "Realtime cập nhật"].map((label) => (
              <div key={label} className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
                <div className="mb-3 h-1 w-10 rounded-full bg-accent" />
                <p className="font-semibold text-white">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center bg-[radial-gradient(circle_at_30%_12%,rgba(214,234,248,0.72),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] px-5 py-8 md:px-10">
          <div className="w-full max-w-[460px]">{children}</div>
        </section>
      </div>
    </main>
  );
}
