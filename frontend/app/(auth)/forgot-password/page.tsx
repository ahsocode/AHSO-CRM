"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/api-client";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ")
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const isDev = process.env.NODE_ENV !== "production";

export default function ForgotPasswordPage() {
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: isDev ? "admin@ahso.vn" : ""
    }
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (values: ForgotPasswordFormValues) => requestPasswordReset(values)
  });

  return (
    <div>
      <div className="mb-8">
        <p className="industrial-chip bg-primary/10 text-primary">Khôi phục truy cập</p>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-text-primary">
          Quên mật khẩu
        </h2>
        <p className="mt-3 text-sm text-text-secondary">
          Nhập email đăng nhập để nhận liên kết đặt lại mật khẩu. Ở môi trường development, hệ thống
          sẽ hiển thị trực tiếp liên kết reset để bạn kiểm tra luồng mà chưa cần mail service.
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => {
          forgotPasswordMutation.mutate(values);
        })}
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text-primary" htmlFor="forgot-email">
            Email đăng nhập
          </label>
          <Input
            id="forgot-email"
            type="email"
            placeholder="ten@ahso.vn"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-sm text-danger">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        {forgotPasswordMutation.isError ? (
          <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
            {getApiErrorMessage(forgotPasswordMutation.error, "Không thể gửi yêu cầu khôi phục lúc này.")}
          </div>
        ) : null}

        {forgotPasswordMutation.data ? (
          <div className="space-y-3 rounded-2xl bg-success-bg/70 px-4 py-4 text-sm text-success">
            <p>{forgotPasswordMutation.data.message}</p>
            {forgotPasswordMutation.data.debug?.resetUrl ? (
              <div className="rounded-xl border border-success/15 bg-white/70 p-3 text-text-primary">
                <p className="font-semibold text-success">Liên kết reset cho development</p>
                <a
                  className="mt-2 block break-all font-medium text-primary hover:text-primary-hover"
                  href={forgotPasswordMutation.data.debug.resetUrl}
                >
                  {forgotPasswordMutation.data.debug.resetUrl}
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        <Button className="h-12 w-full rounded-xl" disabled={forgotPasswordMutation.isPending} type="submit">
          <AppIcon name="mail" className="h-4 w-4" />
          {forgotPasswordMutation.isPending ? "Đang gửi yêu cầu..." : "Gửi hướng dẫn khôi phục"}
        </Button>
      </form>

      <div className="mt-6 text-sm text-text-secondary">
        <Link className="font-medium text-primary hover:text-primary-hover" href="/login">
          Quay lại đăng nhập
        </Link>
      </div>
    </div>
  );
}
