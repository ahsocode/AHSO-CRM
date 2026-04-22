"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppIcon } from "@/components/shared/app-icon";
import { useAuthStore } from "@/hooks/use-auth";
import { useCompanyInfo, useLogo } from "@/hooks/use-settings";
import { getApiErrorMessage } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự")
});

type LoginFormValues = z.infer<typeof loginSchema>;

const isDev = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const companyQuery = useCompanyInfo();
  const logoQuery = useLogo();
  const brandName = companyQuery.data?.shortName || companyQuery.data?.name || "AHSO";
  const logoUrl = resolveAssetUrl(logoQuery.data);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: isDev
      ? {
          email: "admin@ahso.vn",
          password: "AHSO123!"
        }
      : {
          email: "",
          password: ""
        }
  });

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) => login(values),
    onSuccess: () => {
      router.push("/dashboard");
    }
  });

  return (
    <div className="space-y-7">
      <div className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-border/35 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-full w-full object-contain p-2" />
            ) : (
              <span className="font-heading text-sm font-extrabold tracking-[0.18em] text-primary">AHSO</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Đăng nhập hệ thống</p>
            <p className="mt-1 truncate font-heading text-lg font-extrabold text-text-primary">
              {companyQuery.data?.name ?? "AHSO CRM"}
            </p>
          </div>
        </div>

        <div className="mt-7">
          <h2 className="text-balance font-heading text-4xl font-extrabold leading-tight tracking-tight text-text-primary">
            Truy cập workspace bán hàng B2B.
          </h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Đăng nhập để quản lý khách hàng, dự án, báo giá, hợp đồng và hồ sơ bàn giao trên cùng một hệ thống.
          </p>
        </div>
      </div>

      <form
        className="rounded-[28px] border border-white/85 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10)] ring-1 ring-border/45 md:p-6"
        onSubmit={form.handleSubmit((values) => {
          loginMutation.mutate(values);
        })}
      >
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl bg-bg-hover/60 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-text-primary">Secure sign-in</p>
            <p className="mt-0.5 text-xs text-text-secondary">JWT session và phân quyền theo vai trò.</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <AppIcon name="settings" className="h-5 w-5" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="email">
              Email đăng nhập
            </label>
            <div className="relative">
              <AppIcon name="mail" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ten@ahso.vn"
                className="h-12 rounded-xl pl-11"
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register("email")}
              />
            </div>
            {form.formState.errors.email ? (
              <p className="text-sm text-danger">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-text-primary" htmlFor="password">
                Mật khẩu
              </label>
              <Link className="text-sm font-semibold text-primary hover:text-primary-hover" href="/forgot-password">
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <AppIcon name="contract" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
                className="h-12 rounded-xl pl-11"
                aria-invalid={Boolean(form.formState.errors.password)}
                {...form.register("password")}
              />
            </div>
            {form.formState.errors.password ? (
              <p className="text-sm text-danger">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          {isDev ? (
            <div className="rounded-2xl border border-info/15 bg-info-bg/45 px-4 py-3 text-xs leading-5 text-text-secondary">
              <span className="font-semibold text-primary">Development:</span> tài khoản mặc định đã được điền sẵn để kiểm thử nhanh.
            </div>
          ) : null}

          {loginMutation.isError ? (
            <div className="rounded-2xl border border-danger/15 bg-danger-bg px-4 py-3 text-sm leading-6 text-danger">
              {getApiErrorMessage(loginMutation.error, "Không thể đăng nhập. Kiểm tra lại backend hoặc thông tin tài khoản.")}
            </div>
          ) : null}

          <Button className="h-12 w-full rounded-xl text-base shadow-[0_16px_34px_rgba(26,82,118,0.24)]" disabled={loginMutation.isPending} type="submit">
            {loginMutation.isPending ? "Đang xác thực..." : "Vào dashboard"}
            <AppIcon name="arrow-right" className="h-4 w-4" />
          </Button>
        </div>
      </form>

      <div className="grid gap-3 text-xs text-text-secondary sm:grid-cols-3">
        {["Không chia sẻ tài khoản", "Kiểm tra URL hệ thống", "Đăng xuất khi dùng máy chung"].map((item) => (
          <div key={item} className="rounded-2xl border border-white/80 bg-white/62 px-3 py-3 text-center shadow-sm">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
