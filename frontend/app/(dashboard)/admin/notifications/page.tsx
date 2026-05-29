"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSettings, useUpdateNotificationSettings } from "@/hooks/use-settings";
import { NotificationSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NotificationForm } from "./_components/notification-form";
import { PushNotificationCard } from "./_components/push-notification-card";

export default function NotificationsPage() {
  const query = useNotificationSettings();
  const mutation = useUpdateNotificationSettings();
  const { error, success } = useToast();

  const handleSave = async (values: NotificationSettings) => {
    try {
      await mutation.mutateAsync(values);
      success("Đã lưu cài đặt nhắc lịch");
    } catch {
      error("Không thể lưu cài đặt");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Nhắc lịch qua email"
        description="Cấu hình lịch và ngưỡng gửi email nhắc milestone và thanh toán tự động cho staff và khách hàng."
        action={
          <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }))}>
            Về quản trị
          </Link>
        }
      />

      <PushNotificationCard />

      <NotificationForm
        initialValues={query.data}
        isLoading={query.isLoading}
        isSaving={mutation.isPending}
        onSubmit={handleSave}
      />
    </div>
  );
}
