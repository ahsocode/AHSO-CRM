"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { NotificationSettings } from "@/lib/types";

const schema = z.object({
  enabled: z.boolean(),
  sendHour: z.coerce
    .number()
    .int("Phải là số nguyên")
    .min(0, "Từ 0 đến 23")
    .max(23, "Từ 0 đến 23"),
  milestoneDaysAhead: z.coerce
    .number()
    .int("Phải là số nguyên")
    .min(1, "Ít nhất 1 ngày")
    .max(30, "Tối đa 30 ngày"),
  paymentDaysAhead: z.coerce
    .number()
    .int("Phải là số nguyên")
    .min(1, "Ít nhất 1 ngày")
    .max(30, "Tối đa 30 ngày"),
});

type FormValues = z.infer<typeof schema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-danger">{message}</p>;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, "0")}:00`,
}));

export function NotificationForm({
  initialValues,
  isLoading,
  isSaving,
  onSubmit,
}: {
  initialValues?: NotificationSettings;
  isLoading: boolean;
  isSaving: boolean;
  onSubmit: (values: NotificationSettings) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? {
      enabled: true,
      sendHour: 8,
      milestoneDaysAhead: 2,
      paymentDaysAhead: 3,
    },
  });

  const enabled = form.watch("enabled");

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [form, initialValues]);

  if (isLoading) {
    return <LoadingSkeleton className="h-80 w-full" />;
  }

  return (
    <Card className="border border-white/70 bg-white/88">
      <CardHeader>
        <CardTitle>Cài đặt nhắc lịch qua email</CardTitle>
        <CardDescription>
          Hệ thống tự động gửi email nhắc nhở cho staff phụ trách và khách hàng khi milestone hoặc thanh toán sắp đến hạn.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit((values) => onSubmit(values))}
        >
          {/* Enable toggle */}
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 bg-bg-subtle p-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">Bật tính năng gửi email nhắc lịch</p>
              <p className="text-sm text-text-secondary mt-0.5">
                Khi tắt, toàn bộ email nhắc milestone và thanh toán sẽ không được gửi.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => form.setValue("enabled", !enabled, { shouldDirty: true })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${enabled ? "bg-primary" : "bg-input"}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </label>

          <div className={enabled ? "" : "pointer-events-none opacity-50"}>
            <div className="grid gap-6 sm:grid-cols-3">
              {/* Send hour */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary" htmlFor="send-hour">
                  Giờ gửi email hàng ngày
                </label>
                <select
                  id="send-hour"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...form.register("sendHour", { valueAsNumber: true })}
                >
                  {HOUR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-muted">Theo giờ server (UTC+7)</p>
                <FieldError message={form.formState.errors.sendHour?.message} />
              </div>

              {/* Milestone days */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary" htmlFor="milestone-days">
                  Nhắc milestone trước (ngày)
                </label>
                <Input
                  id="milestone-days"
                  type="number"
                  min={1}
                  max={30}
                  {...form.register("milestoneDaysAhead")}
                />
                <p className="text-xs text-text-muted">
                  Gửi email khi milestone còn dưới số ngày này.
                </p>
                <FieldError message={form.formState.errors.milestoneDaysAhead?.message} />
              </div>

              {/* Payment days */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary" htmlFor="payment-days">
                  Nhắc thanh toán trước (ngày)
                </label>
                <Input
                  id="payment-days"
                  type="number"
                  min={1}
                  max={30}
                  {...form.register("paymentDaysAhead")}
                />
                <p className="text-xs text-text-muted">
                  Gửi email cho cả staff và contact khách hàng.
                </p>
                <FieldError message={form.formState.errors.paymentDaysAhead?.message} />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Đang lưu..." : "Lưu cài đặt"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
