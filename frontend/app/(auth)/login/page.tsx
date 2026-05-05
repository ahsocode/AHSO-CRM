"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppIcon } from "@/components/shared/app-icon";
import { useAuthStore } from "@/hooks/use-auth";
import { useCompanyInfo, useLogo } from "@/hooks/use-settings";
import { getApiErrorMessage } from "@/lib/api-client";
import { getAccessToken, resolveAssetUrl } from "@/lib/auth";

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

  useEffect(() => {
    if (getAccessToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

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
    <form
      className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.12)] ring-1 ring-border/35 backdrop-blur md:p-8"
      onSubmit={form.handleSubmit((values) => {
        loginMutation.mutate(values);
      })}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
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
                <span className="font-heading text-sm font-extrabold tracking-[0.18em] text-primary">AHSO</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Đăng nhập</p>
              <p className="mt-1 truncate font-heading text-lg font-extrabold text-text-primary">
                {companyQuery.data?.shortName ?? "AHSO CRM"}
              </p>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <AppIcon name="settings" className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-9">
          <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight text-text-primary">
            Vào workspace.
          </h1>
          <p className="mt-2 text-sm text-text-secondary">Quản lý sales B2B trên một hệ thống.</p>
        </div>

        <div className="mt-7 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <AppIcon name="mail" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ten@ahso.vn"
                className="h-12 rounded-xl border-border/80 bg-white/85 pl-11"
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
                Quên?
              </Link>
            </div>
            <div className="relative">
              <AppIcon name="contract" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
                className="h-12 rounded-xl border-border/80 bg-white/85 pl-11"
                aria-invalid={Boolean(form.formState.errors.password)}
                {...form.register("password")}
              />
            </div>
            {form.formState.errors.password ? (
              <p className="text-sm text-danger">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          {isDev ? (
            <div className="rounded-2xl border border-info/15 bg-info-bg/40 px-4 py-3 text-xs text-text-secondary">
              Dev mode: tài khoản test đã điền sẵn.
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
      </div>
    </form>
  );
}
