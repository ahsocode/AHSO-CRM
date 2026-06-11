"use client";

import Image from "next/image";
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

      <div className="relative mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-7xl overflow-hidden rounded-[34px] bg-white/10 shadow-[0_30px_90px_rgba(3,18,30,0.35)] ring-1 ring-white/15 backdrop-blur-md lg:grid-cols-[1.02fr_0.98fr]">
        <section className="auth-motion-field relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-12">
          <div className="auth-orb left-16 top-32 h-48 w-48 bg-white/12" />
          <div className="auth-orb auth-orb-delayed bottom-20 right-20 h-60 w-60 bg-accent/20" />
          <div className="absolute inset-x-12 bottom-24 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          <div className="relative">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/14 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={brandName}
                      width={56}
                      height={56}
                      unoptimized
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <Image
                      src="/crm-logo.png"
                      alt="AHSO CRM"
                      width={56}
                      height={56}
                      priority
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">AHSO Workspace</p>
                  <p className="mt-1 font-heading text-lg font-extrabold text-white">{brandName}</p>
                </div>
              </div>
              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                CRM B2B
              </div>
            </div>

            <div className="mt-20 max-w-2xl">
              <p className="industrial-chip bg-white/12 text-white/78">Project 360</p>
              <h1 className="mt-6 text-balance font-heading text-5xl font-extrabold leading-tight tracking-tight xl:text-6xl">
                CRM cho đội bán hàng kỹ thuật.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-8 text-white/70">
                Khách hàng, dự án, báo giá và tài liệu nằm trên cùng một luồng.
              </p>
            </div>

            <div className="mt-12 grid max-w-xl grid-cols-3 gap-3 text-sm">
              {["Lead", "Quote", "Contract"].map((item) => (
                <div key={item} className="auth-float-card rounded-2xl border border-white/14 bg-white/10 px-4 py-5 text-center shadow-[0_14px_35px_rgba(0,0,0,0.12)] backdrop-blur">
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-accent" />
                  <p className="font-semibold text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-between gap-4 rounded-3xl border border-white/12 bg-white/10 px-5 py-4 text-sm text-white/72 backdrop-blur">
            <span>Realtime</span>
            <span>RBAC</span>
            <span>Document Hub</span>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[radial-gradient(circle_at_30%_12%,rgba(214,234,248,0.72),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] px-5 py-8 md:px-10">
          <div className="w-full max-w-[460px]">{children}</div>
        </section>
      </div>
    </main>
  );
}
