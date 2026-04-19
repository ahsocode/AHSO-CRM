"use client";

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
    <main className="auth-grid min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-[28px] bg-white/10 shadow-2xl ring-1 ring-white/15 backdrop-blur-sm lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden flex-col justify-between p-10 text-white lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                {logoUrl ? (
                  <img src={logoUrl} alt={brandName} className="h-full w-full object-contain p-2" />
                ) : (
                  <span className="font-heading text-base font-extrabold tracking-[0.18em] text-white">AHSO</span>
                )}
              </div>
              <p className="industrial-chip bg-white/10 text-white">{brandName}</p>
            </div>
            <h1 className="mt-8 max-w-lg text-5xl font-extrabold tracking-tight">
              Bảng điều phối cho chu trình bán hàng kỹ thuật công nghiệp.
            </h1>
            <p className="mt-6 max-w-xl text-base text-white/75">
              Nền tảng tập trung dữ liệu khách hàng, cơ hội dự án, báo giá và tài liệu triển khai để đội {brandName} làm việc với cùng một nhịp vận hành.
            </p>
          </div>

          <div className="grid gap-4 text-sm text-white/80 md:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">KPI</p>
              <p className="mt-3 text-2xl font-bold text-white">2,45 tỷ</p>
              <p className="mt-2">Doanh số tháng này từ các hợp đồng đã kích hoạt.</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">Pipeline</p>
              <p className="mt-3 text-2xl font-bold text-white">24 dự án</p>
              <p className="mt-2">Theo dõi từ khảo sát, báo giá, đàm phán đến triển khai.</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-white/92 px-5 py-10 md:px-10">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </div>
    </main>
  );
}
