"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAdminEmailAccounts, useBulkCreateEmailAccounts, useCreateEmailAccount, useDeleteEmailAccount, useSyncEmailAccount, useTestEmailConnection } from "@/hooks/use-mailbox";
import { useUsers } from "@/hooks/use-users";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

export default function AdminEmailAccountsPage() {
  const accountsQuery = useAdminEmailAccounts();
  const usersQuery = useUsers();
  const createMutation = useCreateEmailAccount();
  const deleteMutation = useDeleteEmailAccount();
  const bulkCreateMutation = useBulkCreateEmailAccounts();
  const testConnectionMutation = useTestEmailConnection();
  const syncMutation = useSyncEmailAccount();
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [imapHost, setImapHost] = useState("mail.ahso.vn");
  const [smtpHost, setSmtpHost] = useState("mail.ahso.vn");
  const [imapPort, setImapPort] = useState("993");
  const [imapSecure, setImapSecure] = useState(true);

  const handleBulkCreate = async () => {
    try {
      const result = await bulkCreateMutation.mutateAsync({ imapHost, smtpHost });
      toast({ title: result.message });
    } catch (error) {
      toast({ title: "Không tạo được tài khoản hàng loạt", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({
        userId,
        email,
        imapHost,
        smtpHost,
        imapPort: parseInt(imapPort, 10) || 993,
        imapSecure,
        smtpPort: 587
      });
      setUserId("");
      setEmail("");
      toast({ title: "Đã tạo tài khoản email" });
    } catch (error) {
      toast({ title: "Không tạo được tài khoản", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Tài khoản email" description="Admin tạo cấu hình email, nhân sự tự nhập mật khẩu IMAP trong phần Settings." />

      <Card className="border border-white/70 bg-primary-bg/40">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-text-primary">Tạo nhanh cho toàn bộ nhân viên</p>
            <p className="mt-0.5 text-sm text-text-secondary">
              Tự động tạo tài khoản email dựa trên email CRM của từng người. Nhân viên chỉ cần vào{" "}
              <span className="font-medium text-primary">Settings → Email</span> để nhập mật khẩu iRedMail của mình.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleBulkCreate}
            disabled={bulkCreateMutation.isPending}
            className="shrink-0"
          >
            {bulkCreateMutation.isPending ? "Đang tạo..." : "Tạo tất cả"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Thêm thủ công</p>
          <CardTitle>Cấu hình tài khoản iRedMail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">Chọn người dùng</option>
              {(usersQuery.data ?? []).map((user) => (
                <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
              ))}
            </Select>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="hung@ahso.vn" />
            <Input value={imapHost} onChange={(event) => setImapHost(event.target.value)} placeholder="IMAP host" />
            <Input value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} placeholder="SMTP host" />
            <Button type="button" onClick={handleCreate} disabled={!userId || !email || createMutation.isPending}>
              Thêm
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Input
              className="w-28"
              type="number"
              value={imapPort}
              onChange={(e) => setImapPort(e.target.value)}
              placeholder="IMAP port"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={imapSecure}
                onChange={(e) => setImapSecure(e.target.checked)}
                className="h-4 w-4"
              />
              IMAP Secure (TLS)
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Mailbox registry</p>
          <CardTitle>Danh sách tài khoản</CardTitle>
        </CardHeader>
        <CardContent>
          {accountsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => <LoadingSkeleton key={index} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.16em] text-text-secondary">
                    <th className="py-3">Người dùng</th>
                    <th>Email</th>
                    <th>Trạng thái</th>
                    <th>Lần sync cuối</th>
                    <th className="text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(accountsQuery.data ?? []).map((account) => (
                    <tr key={account.id} className="border-b border-border/30 last:border-0">
                      <td className="py-3 font-medium text-text-primary">{account.user.name}</td>
                      <td className="text-text-secondary">{account.email}</td>
                      <td>
                        {account.isActive ? <Badge variant="success">Đã kết nối</Badge> : <Badge variant="warning">Chờ cấu hình</Badge>}
                      </td>
                      <td className="text-text-muted">{account.lastSyncAt ? formatDateTime(account.lastSyncAt) : "Chưa sync"}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={testConnectionMutation.isPending}
                            onClick={async () => {
                              try {
                                const result = await testConnectionMutation.mutateAsync(account.id);
                                toast({ title: result.message, variant: result.success ? "default" : "destructive" });
                              } catch (error) {
                                toast({ title: "Lỗi kiểm tra kết nối", description: getApiErrorMessage(error), variant: "destructive" });
                              }
                            }}
                          >
                            Test
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={syncMutation.isPending}
                            onClick={async () => {
                              try {
                                const result = await syncMutation.mutateAsync(account.id);
                                toast({ title: result.message });
                              } catch (error) {
                                toast({ title: "Lỗi sync", description: getApiErrorMessage(error), variant: "destructive" });
                              }
                            }}
                          >
                            Sync
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => deleteMutation.mutate(account.id)}>
                            Xóa
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
