"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("admin@ahso.vn");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div>
      <div className="mb-8">
        <p className="industrial-chip bg-primary/10 text-primary">Khôi phục truy cập</p>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-text-primary">
          Quên mật khẩu
        </h2>
        <p className="mt-3 text-sm text-text-secondary">
          Màn hình này đang là stub UI cho phase hiện tại. Khi nhập email, hệ thống chỉ mô phỏng
          việc gửi hướng dẫn khôi phục chứ chưa tích hợp mail service thật.
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text-primary" htmlFor="forgot-email">
            Email đăng nhập
          </label>
          <Input
            id="forgot-email"
            type="email"
            placeholder="ten@ahso.vn"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        {submitted ? (
          <div className="rounded-xl bg-success-bg px-4 py-3 text-sm text-success">
            Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục đã được xếp vào hàng đợi gửi.
          </div>
        ) : null}

        <Button className="h-12 w-full rounded-xl" type="submit">
          Gửi hướng dẫn khôi phục
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
