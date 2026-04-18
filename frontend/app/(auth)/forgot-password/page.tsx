"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ")
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ""
    }
  });

  return (
    <div>
      <div className="mb-8">
        <p className="industrial-chip bg-primary/10 text-primary">Khôi phục quyền truy cập</p>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-text-primary">Quên mật khẩu</h2>
        <p className="mt-3 text-sm text-text-secondary">
          Ở phase hiện tại, màn hình này mới dừng ở luồng nhập email và xác nhận nội bộ.
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={form.handleSubmit(() => {
          setIsSubmitted(true);
        })}
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text-primary" htmlFor="email">
            Email công việc
          </label>
          <Input id="email" type="email" placeholder="ten@ahso.vn" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-sm text-danger">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        {isSubmitted ? (
          <div className="rounded-xl bg-success-bg px-4 py-3 text-sm text-success">
            Yêu cầu đã được ghi nhận. Ở vòng foundation hiện tại, chưa có email tự động; đội vận hành sẽ xử lý thủ công.
          </div>
        ) : null}

        <Button className="h-12 w-full rounded-xl" type="submit" variant="primary">
          Gửi yêu cầu
        </Button>
      </form>

      <p className="mt-6 text-sm text-text-secondary">
        <Link className="font-medium text-primary hover:text-primary-hover" href="/login">
          Quay lại đăng nhập
        </Link>
      </p>
    </div>
  );
}

