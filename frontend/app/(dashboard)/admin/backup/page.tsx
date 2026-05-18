"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useBackups, useCreateBackup, useDeleteBackup, useRestoreBackup, BackupFile } from "@/hooks/use-backup";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function parseBackupDate(filename: string) {
  // ahso-crm-2026-05-18_14-05.tar.gz → extract date string
  const match = filename.match(/(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2})/);
  if (!match) return null;
  return `${match[1]}T${match[2].replace("-", ":")}:00`;
}

export default function BackupPage() {
  const { data: backups, isLoading, isFetching, refetch } = useBackups();
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();
  const deleteBackup = useDeleteBackup();
  const { success, error: showError } = useToast();

  const [confirmRestore, setConfirmRestore] = useState<BackupFile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BackupFile | null>(null);

  function handleCreateBackup() {
    createBackup.mutate(undefined, {
      onSuccess: () => success("Sao lưu thành công. File đã được tải lên Google Drive."),
      onError: (err) => showError(getApiErrorMessage(err, "Sao lưu thất bại."))
    });
  }

  function handleRestore(backup: BackupFile) {
    restoreBackup.mutate(backup.name, {
      onSuccess: () => {
        success("Khôi phục hoàn tất. Vui lòng đăng nhập lại.");
        setConfirmRestore(null);
      },
      onError: (err) => {
        showError(getApiErrorMessage(err, "Khôi phục thất bại."));
        setConfirmRestore(null);
      }
    });
  }

  function handleDelete(backup: BackupFile) {
    deleteBackup.mutate(backup.name, {
      onSuccess: () => {
        success("Đã xóa bản sao lưu.");
        setConfirmDelete(null);
      },
      onError: (err) => {
        showError(getApiErrorMessage(err, "Xóa thất bại."));
        setConfirmDelete(null);
      }
    });
  }

  const isBusy = createBackup.isPending || restoreBackup.isPending || deleteBackup.isPending;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sao lưu & Khôi phục"
        description="Quản lý bản sao lưu hệ thống AHSO CRM trên Google Drive."
        action={
          <Button onClick={handleCreateBackup} disabled={isBusy || createBackup.isPending}>
            {createBackup.isPending ? (
              <>
                <AppIcon name="spinner" className="mr-2 h-4 w-4 animate-spin" />
                Đang sao lưu...
              </>
            ) : (
              <>
                <AppIcon name="upload" className="mr-2 h-4 w-4" />
                Tạo bản sao lưu ngay
              </>
            )}
          </Button>
        }
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
        <AppIcon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          Bản sao lưu được lưu trữ trên <span className="font-semibold text-text-primary">Google Drive</span> tại thư mục{" "}
          <span className="font-mono text-xs font-semibold">AHSO-CRM-Backups/</span>. Mỗi bản gồm: database PostgreSQL, thư mục uploads và cấu hình
          môi trường. Hệ thống tự động sao lưu hàng ngày lúc <span className="font-semibold text-text-primary">2:00 sáng</span> và xóa bản cũ hơn 30 ngày.
        </div>
      </div>

      {/* Backup list */}
      <div className="overflow-hidden rounded-xl border border-border-light bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <h3 className="text-sm font-semibold text-text-primary">
            Danh sách bản sao lưu
            {backups && (
              <span className="ml-2 rounded-full bg-bg-subtle px-2 py-0.5 text-xs font-normal text-text-muted">
                {backups.length} file
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-subtle hover:text-primary disabled:opacity-50"
          >
            <AppIcon name="refresh" className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-bg-subtle" />
            ))}
          </div>
        ) : !backups?.length ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-text-muted">
            <AppIcon name="cloud-upload" className="h-10 w-10 opacity-30" />
            <p className="text-sm">Chưa có bản sao lưu nào.</p>
            <p className="text-xs">Nhấn &ldquo;Tạo bản sao lưu ngay&rdquo; để tạo bản đầu tiên.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {backups.map((backup) => {
              const backupDate = parseBackupDate(backup.name);
              const isLatest = backups[0].name === backup.name;

              return (
                <div key={backup.name} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <AppIcon name="cloud-upload" className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-mono text-sm font-medium text-text-primary">{backup.name}</p>
                      {isLatest && (
                        <Badge className="rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                          Mới nhất
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <AppIcon name="clock" className="h-3 w-3" />
                        {backupDate ? formatDateTime(backupDate) : "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <AppIcon name="description" className="h-3 w-3" />
                        {backup.sizeHuman}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmRestore(backup)}
                      className="flex items-center gap-1.5 rounded-lg border border-primary/25 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <AppIcon name="restore" className="h-3.5 w-3.5" />
                      Khôi phục
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmDelete(backup)}
                      className="flex items-center gap-1.5 rounded-lg border border-danger/20 px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <AppIcon name="delete" className="h-3.5 w-3.5" />
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Restore confirmation */}
      <AlertDialog open={!!confirmRestore} onOpenChange={(open) => !open && setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận khôi phục</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ dữ liệu hiện tại sẽ bị <span className="font-semibold text-danger">xóa và thay thế</span> bằng bản sao lưu:
              <br />
              <span className="mt-1 block font-mono text-sm font-semibold text-text-primary">{confirmRestore?.name}</span>
              <br />
              Hành động này không thể hoàn tác. Bạn có chắc chắn muốn tiếp tục?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreBackup.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoreBackup.isPending}
              className="bg-danger hover:bg-danger/90"
              onClick={() => confirmRestore && handleRestore(confirmRestore)}
            >
              {restoreBackup.isPending ? "Đang khôi phục..." : "Khôi phục ngay"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bản sao lưu</AlertDialogTitle>
            <AlertDialogDescription>
              Bản sao lưu sau sẽ bị xóa vĩnh viễn khỏi Google Drive:
              <br />
              <span className="mt-1 block font-mono text-sm font-semibold text-text-primary">{confirmDelete?.name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBackup.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBackup.isPending}
              className="bg-danger hover:bg-danger/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              {deleteBackup.isPending ? "Đang xóa..." : "Xóa bản sao lưu"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
