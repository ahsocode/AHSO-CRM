"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSetupMailboxPassword } from "@/hooks/use-mailbox";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";

export default function EmailSettingsPage() {
  const [password, setPassword] = useState("");
  const setupMutation = useSetupMailboxPassword();

  const handleSubmit = async () => {
    try {
      await setupMutation.mutateAsync({ password });
      setPassword("");
      toast({ title: "Đã kết nối email" });
    } catch (error) {
      toast({ title: "Không kết nối được email", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="Kết nối email" description="Nhập mật khẩu email iRedMail của bạn để CRM đồng bộ mailbox cá nhân." />
      <Card className="max-w-xl border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Email cá nhân</p>
          <CardTitle>Mật khẩu IMAP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nhập mật khẩu email để kết nối"
          />
          <Button type="button" onClick={handleSubmit} disabled={password.length < 8 || setupMutation.isPending}>
            {setupMutation.isPending ? "Đang kiểm tra..." : "Kiểm tra & kết nối"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
