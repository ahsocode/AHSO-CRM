"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/api-client";

const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "Token khôi phục là bắt buộc"),
    password: z
      .string()
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
      .max(128, "Mật khẩu quá dài"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Xác nhận mật khẩu không khớp",
    path: ["confirmPassword"]
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const tokenFromQuery = searchParams.get("token") ?? "";

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: tokenFromQuery,
      password: "",
      confirmPassword: ""
    }
  });

  useEffect(() => {
    if (tokenFromQuery) {
      form.setValue("token", tokenFromQuery, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false
      });
    }
  }, [form, tokenFromQuery]);

  // Validate token exists early
  const hasValidToken = !!(tokenFromQuery && tokenFromQuery.trim().length > 0);
  const showTokenError = !hasValidToken && form.formState.isSubmitted;

  const resetPasswordMutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) => resetPassword(values),
    onSuccess: () => {
      form.reset({
        token: tokenFromQuery,
        password: "",
        confirmPassword: ""
      });
      // Auto-redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    }
  });

  return (
    <div>
      <div className="mb-8">
        <p className="industrial-chip bg-primary/10 text-primary">Đặt lại mật khẩu</p>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-text-primary">
          Tạo mật khẩu mới
        </h2>
        <p className="mt-3 text-sm text-text-secondary">
          Liên kết khôi phục có hiệu lực ngắn hạn. Sau khi đổi mật khẩu thành công, mọi phiên đăng nhập cũ
          sẽ bị vô hiệu và bạn cần đăng nhập lại.
        </p>
      </div>

      {!hasValidToken && (
        <div className="mb-5 rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning">
          ⚠️ Liên kết khôi phục không hợp lệ hoặc đã hết hạn. Vui lòng{" "}
          <Link className="font-semibold underline hover:no-underline" href="/forgot-password">
            yêu cầu liên kết mới
          </Link>
          .
        </div>
      )}

      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => {
          if (!hasValidToken) {
            form.setError("token", {
              type: "manual",
              message: "Token khôi phục là bắt buộc"
            });
            return;
          }
          resetPasswordMutation.mutate(values);
        })}
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text-primary" htmlFor="reset-token">
            Token khôi phục
          </label>
          <Input
            id="reset-token"
            placeholder="Dán token hoặc mở từ liên kết reset"
            disabled={hasValidToken}
            {...form.register("token")}
          />
          {form.formState.errors.token ? (
            <p className="text-sm text-danger">{form.formState.errors.token.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-text-primary" htmlFor="reset-password">
            Mật khẩu mới
          </label>
          <Input id="reset-password" type="password" placeholder="••••••••" {...form.register("password")} />
          {form.formState.errors.password ? (
            <p className="text-sm text-danger">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-text-primary" htmlFor="reset-password-confirm">
            Xác nhận mật khẩu mới
          </label>
          <Input
            id="reset-password-confirm"
            type="password"
            placeholder="••••••••"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="text-sm text-danger">{form.formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>

        {resetPasswordMutation.isError ? (
          <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
            {getApiErrorMessage(
              resetPasswordMutation.error,
              "Không thể cập nhật mật khẩu. Liên kết có thể đã hết hạn."
            )}
          </div>
        ) : null}

        {resetPasswordMutation.isSuccess ? (
          <div className="space-y-3 rounded-2xl bg-success-bg/70 px-4 py-4 text-sm text-success">
            <p>{resetPasswordMutation.data.message}</p>
            <div className="flex flex-wrap gap-3">
              <Link className="font-semibold text-primary hover:text-primary-hover" href="/login">
                Đăng nhập lại
              </Link>
              <button
                className="font-semibold text-text-secondary transition hover:text-text-primary"
                type="button"
                onClick={() => router.push("/login")}
              >
                Đi tới trang đăng nhập
              </button>
            </div>
          </div>
        ) : null}

        <Button className="h-12 w-full rounded-xl" disabled={resetPasswordMutation.isPending} type="submit">
          <AppIcon name="arrow-right" className="h-4 w-4" />
          {resetPasswordMutation.isPending ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
        </Button>
      </form>

      <div className="mt-6 text-sm text-text-secondary">
        <Link className="font-medium text-primary hover:text-primary-hover" href="/forgot-password">
          Quay lại bước nhận liên kết reset
        </Link>
      </div>
    </div>
  );
}

function ResetPasswordFallback() {
  return (
    <div>
      <div className="mb-8">
        <p className="industrial-chip bg-primary/10 text-primary">Đặt lại mật khẩu</p>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-text-primary">
          Tạo mật khẩu mới
        </h2>
        <p className="mt-3 text-sm text-text-secondary">Đang chuẩn bị biểu mẫu khôi phục mật khẩu...</p>
      </div>
      <div className="rounded-2xl bg-slate-100 px-4 py-5 text-sm text-text-secondary">
        Vui lòng chờ trong giây lát.
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
