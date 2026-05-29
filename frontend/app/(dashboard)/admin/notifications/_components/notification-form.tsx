"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppIcon } from "@/components/shared/app-icon";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { NotificationSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const schema = z.object({
  enabled: z.boolean(),
  sendHour: z.coerce.number().int("Phải là số nguyên").min(0, "Từ 0 đến 23").max(23, "Từ 0 đến 23"),
  milestoneEnabled: z.boolean(),
  milestoneDaysAhead: z.coerce.number().int("Phải là số nguyên").min(1, "Ít nhất 1 ngày").max(30, "Tối đa 30 ngày"),
  paymentEnabled: z.boolean(),
  paymentDaysAhead: z.coerce.number().int("Phải là số nguyên").min(1, "Ít nhất 1 ngày").max(30, "Tối đa 30 ngày"),
});

type FormValues = z.infer<typeof schema>;

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, "0")}:00`,
}));

function Toggle({
  checked,
  onToggle,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-danger">{message}</p>;
}

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
      milestoneEnabled: true,
      milestoneDaysAhead: 2,
      paymentEnabled: true,
      paymentDaysAhead: 3,
    },
  });

  const enabled = form.watch("enabled");
  const milestoneEnabled = form.watch("milestoneEnabled");
  const paymentEnabled = form.watch("paymentEnabled");

  useEffect(() => {
    if (initialValues) form.reset(initialValues);
  }, [form, initialValues]);

  if (isLoading) return <LoadingSkeleton className="h-96 w-full" />;

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit((values) => onSubmit(values))}>

      {/* Master toggle */}
      <Card className="border border-white/70">
        <CardContent className="p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-bg text-primary">
                <AppIcon name="mail" className="text-[20px]" />
              </span>
              <div>
                <p className="font-semibold text-text-primary">Bật email nhắc lịch tự động</p>
                <p className="text-sm text-text-secondary">
                  Khi tắt, toàn bộ email nhắc phía dưới sẽ không được gửi.
                </p>
              </div>
            </div>
            <Toggle
              checked={enabled}
              onToggle={() => form.setValue("enabled", !enabled, { shouldDirty: true })}
            />
          </label>
        </CardContent>
      </Card>

      {/* Send hour — always visible but dims when global off */}
      <div className={cn("transition-opacity", !enabled && "pointer-events-none opacity-40")}>
        <Card className="border border-white/70">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-text-primary">Giờ gửi hàng ngày</p>
                <p className="text-sm text-text-secondary">Hệ thống kiểm tra và gửi email lúc giờ này mỗi ngày (theo giờ server UTC+7).</p>
              </div>
              <div className="shrink-0">
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...form.register("sendHour", { valueAsNumber: true })}
                >
                  {HOUR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <FieldError message={form.formState.errors.sendHour?.message} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature cards */}
      <div className={cn("space-y-3 transition-opacity", !enabled && "pointer-events-none opacity-40")}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
          Các loại email nhắc
        </p>

        {/* Milestone reminder */}
        <Card className="border border-white/70">
          <CardHeader className="p-4 pb-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                  milestoneEnabled ? "bg-info-bg text-primary-mid" : "bg-bg-hover text-text-muted"
                )}>
                  <AppIcon name="calendar" className="text-[18px]" />
                </span>
                <div>
                  <CardTitle className="text-base">Nhắc milestone sắp đến hạn</CardTitle>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    Gửi cho <span className="font-medium text-text-primary">staff phụ trách dự án</span>
                  </p>
                </div>
              </div>
              <Toggle
                checked={milestoneEnabled}
                onToggle={() => form.setValue("milestoneEnabled", !milestoneEnabled, { shouldDirty: true })}
              />
            </div>
          </CardHeader>
          <CardContent className={cn("p-4 pt-3 transition-opacity", !milestoneEnabled && "pointer-events-none opacity-40")}>
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-secondary" htmlFor="milestone-days">
                Nhắc trước
              </label>
              <Input
                id="milestone-days"
                type="number"
                min={1}
                max={30}
                className="h-8 w-20 text-center"
                {...form.register("milestoneDaysAhead")}
              />
              <span className="text-sm text-text-secondary">ngày so với ngày đến hạn</span>
            </div>
            <FieldError message={form.formState.errors.milestoneDaysAhead?.message} />
          </CardContent>
        </Card>

        {/* Payment reminder */}
        <Card className="border border-white/70">
          <CardHeader className="p-4 pb-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                  paymentEnabled ? "bg-accent-bg text-accent" : "bg-bg-hover text-text-muted"
                )}>
                  <AppIcon name="briefcase" className="text-[18px]" />
                </span>
                <div>
                  <CardTitle className="text-base">Nhắc thanh toán sắp đến hạn</CardTitle>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    Gửi cho <span className="font-medium text-text-primary">staff</span> và{" "}
                    <span className="font-medium text-text-primary">contact chính của khách hàng</span>
                  </p>
                </div>
              </div>
              <Toggle
                checked={paymentEnabled}
                onToggle={() => form.setValue("paymentEnabled", !paymentEnabled, { shouldDirty: true })}
              />
            </div>
          </CardHeader>
          <CardContent className={cn("p-4 pt-3 transition-opacity", !paymentEnabled && "pointer-events-none opacity-40")}>
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-secondary" htmlFor="payment-days">
                Nhắc trước
              </label>
              <Input
                id="payment-days"
                type="number"
                min={1}
                max={30}
                className="h-8 w-20 text-center"
                {...form.register("paymentDaysAhead")}
              />
              <span className="text-sm text-text-secondary">ngày so với ngày đến hạn</span>
            </div>
            <FieldError message={form.formState.errors.paymentDaysAhead?.message} />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
          {isSaving ? "Đang lưu..." : "Lưu cài đặt"}
        </Button>
      </div>
    </form>
  );
}
