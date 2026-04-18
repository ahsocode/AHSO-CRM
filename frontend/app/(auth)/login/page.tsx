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

const loginSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự")
});

type LoginFormValues = z.infer<typeof loginSchema>;

const isDev = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

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
    <div>
      <div className="mb-8">
        <p className="industrial-chip bg-primary/10 text-primary">Đăng nhập hệ thống</p>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-text-primary">Xin chào, đội AHSO</h2>
        {isDev ? (
          <p className="mt-3 text-sm text-text-secondary">
            Sử dụng tài khoản dev mặc định để bắt đầu: <strong>admin@ahso.vn / AHSO123!</strong>
          </p>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">Vui lòng đăng nhập để tiếp tục.</p>
        )}
      </div>

      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => {
          loginMutation.mutate(values);
        })}
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text-primary" htmlFor="email">
            Email
          </label>
          <Input id="email" type="email" placeholder="ten@ahso.vn" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-sm text-danger">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-text-primary" htmlFor="password">
              Mật khẩu
            </label>
            <Link className="text-sm font-medium text-primary hover:text-primary-hover" href="/forgot-password">
              Quên mật khẩu?
            </Link>
          </div>
          <Input id="password" type="password" placeholder="••••••••" {...form.register("password")} />
          {form.formState.errors.password ? (
            <p className="text-sm text-danger">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        {loginMutation.isError ? (
          <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
            Không thể đăng nhập. Kiểm tra lại backend hoặc thông tin tài khoản seed.
          </div>
        ) : null}

        <Button className="h-12 w-full rounded-xl" disabled={loginMutation.isPending} type="submit">
          <AppIcon name="arrow-right" className="h-4 w-4" />
          {loginMutation.isPending ? "Đang xác thực..." : "Vào dashboard"}
        </Button>
      </form>
    </div>
  );
}

