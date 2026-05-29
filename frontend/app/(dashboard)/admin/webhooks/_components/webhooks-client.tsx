"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/ui/sheet";
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useWebhookLogs,
} from "@/hooks/use-webhooks";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { Webhook, WebhookLog } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────

const WEBHOOK_EVENT_GROUPS: {
  label: string;
  events: { value: string; label: string }[];
}[] = [
  {
    label: "Khách hàng",
    events: [
      { value: "customer.created", label: "Khách hàng mới" },
      { value: "customer.updated", label: "Cập nhật khách hàng" },
      { value: "customer.deleted", label: "Xóa khách hàng" },
    ],
  },
  {
    label: "Dự án",
    events: [
      { value: "project.created", label: "Dự án mới" },
      { value: "project.status_changed", label: "Thay đổi trạng thái dự án" },
    ],
  },
  {
    label: "Báo giá & Hợp đồng",
    events: [
      { value: "quote.sent", label: "Gửi báo giá" },
      { value: "quote.accepted", label: "Chấp nhận báo giá" },
      { value: "contract.signed", label: "Ký hợp đồng" },
      { value: "contract.completed", label: "Hoàn thành hợp đồng" },
    ],
  },
  {
    label: "Thanh toán",
    events: [
      { value: "payment.received", label: "Nhận thanh toán" },
    ],
  },
];

const ALL_EVENTS = WEBHOOK_EVENT_GROUPS.flatMap((g) => g.events.map((e) => e.value));

// ── Helpers ────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getEventLabel(value: string): string {
  for (const group of WEBHOOK_EVENT_GROUPS) {
    const found = group.events.find((e) => e.value === value);
    if (found) return found.label;
  }
  return value;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// ── Form state type ────────────────────────────────────────────

interface WebhookFormState {
  url: string;
  events: string[];
}

const DEFAULT_FORM: WebhookFormState = { url: "", events: [] };

// ── EventBadges ───────────────────────────────────────────────

function EventBadges({ events }: { events: string[] }) {
  const MAX_VISIBLE = 3;
  const visible = events.slice(0, MAX_VISIBLE);
  const remaining = events.length - MAX_VISIBLE;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((ev) => (
        <span
          key={ev}
          className="inline-flex items-center rounded-full bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary-mid"
        >
          {getEventLabel(ev)}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center rounded-full bg-bg-hover px-2 py-0.5 text-[11px] font-medium text-text-muted">
          +{remaining} khác
        </span>
      )}
      {events.length === 0 && (
        <span className="text-xs text-text-muted italic">Chưa chọn sự kiện</span>
      )}
    </div>
  );
}

// ── ActiveToggle ──────────────────────────────────────────────

function ActiveToggle({
  webhook,
  onToggle,
  disabled,
}: {
  webhook: Webhook;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={webhook.isActive}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50",
        webhook.isActive ? "bg-success" : "bg-bg-hover"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
          webhook.isActive ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ── LogsSheet ─────────────────────────────────────────────────

function LogsSheet({
  webhook,
  onClose,
}: {
  webhook: Webhook | null;
  onClose: () => void;
}) {
  const { data: logs, isLoading } = useWebhookLogs(webhook?.id ?? null);

  return (
    <Sheet open={!!webhook} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Lịch sử giao nhận</SheetTitle>
          <SheetDescription className="truncate text-xs text-text-muted mt-0.5">
            {webhook?.url}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {isLoading ? (
            <div className="flex flex-col gap-3 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-bg-subtle" />
              ))}
            </div>
          ) : !logs?.length ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
              <AppIcon name="history" className="h-10 w-10 opacity-30" />
              <p className="text-sm">Chưa có lần giao nhận nào.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map((log: WebhookLog) => (
                <div
                  key={log.id}
                  className="rounded-xl bg-bg-subtle px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          log.success
                            ? "bg-success-bg text-success"
                            : "bg-danger-bg text-danger"
                        )}
                      >
                        {log.success ? "✓" : "✗"}
                      </span>
                      <span className="truncate text-xs font-semibold text-text-primary">
                        {getEventLabel(log.event)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {log.statusCode !== null && (
                        <Badge
                          variant={log.success ? "success" : "danger"}
                          className="rounded-md px-1.5 py-0 text-[10px]"
                        >
                          {log.statusCode}
                        </Badge>
                      )}
                      {log.durationMs !== null && (
                        <span className="text-[10px] text-text-muted">
                          {log.durationMs}ms
                        </span>
                      )}
                    </div>
                  </div>

                  {log.error && (
                    <p className="mt-1.5 truncate text-[11px] text-danger">
                      {log.error}
                    </p>
                  )}

                  <p className="mt-1 text-[11px] text-text-muted">
                    {formatDateTime(log.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

// ── WebhookFormDialog ──────────────────────────────────────────

function WebhookFormDialog({
  open,
  editing,
  isSaving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: Webhook | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (data: WebhookFormState) => void;
}) {
  const [form, setForm] = useState<WebhookFormState>(DEFAULT_FORM);
  const [urlError, setUrlError] = useState("");

  // Sync form when dialog opens or editing target changes
  useEffect(() => {
    if (open) {
      setForm(editing ? { url: editing.url, events: editing.events } : DEFAULT_FORM);
      setUrlError("");
    }
  }, [open, editing]);

  function handleUrlChange(value: string) {
    setForm((prev) => ({ ...prev, url: value }));
    if (urlError) setUrlError("");
  }

  function handleEventToggle(eventValue: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(eventValue)
        ? prev.events.filter((e) => e !== eventValue)
        : [...prev.events, eventValue],
    }));
  }

  function handleSelectAll() {
    setForm((prev) => ({
      ...prev,
      events: prev.events.length === ALL_EVENTS.length ? [] : [...ALL_EVENTS],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidUrl(form.url)) {
      setUrlError("URL không hợp lệ. Vui lòng nhập URL bắt đầu bằng http:// hoặc https://");
      return;
    }
    if (form.events.length === 0) {
      setUrlError("Vui lòng chọn ít nhất một sự kiện.");
      return;
    }
    onSubmit(form);
  }

  const allSelected = form.events.length === ALL_EVENTS.length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Chỉnh sửa Webhook" : "Tạo Webhook mới"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Cập nhật URL nhận sự kiện và danh sách sự kiện theo dõi."
              : "Nhập URL endpoint và chọn các sự kiện cần nhận thông báo."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* URL */}
          <div className="mb-5">
            <Label htmlFor="webhook-url" className="mb-2 block text-sm font-semibold text-text-primary">
              URL nhận sự kiện
            </Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://your-service.com/webhook"
              value={form.url}
              onChange={(e) => handleUrlChange(e.target.value)}
              className={urlError ? "border-danger focus:border-danger" : ""}
              autoFocus
            />
            {urlError && (
              <p className="mt-1.5 text-xs text-danger">{urlError}</p>
            )}
          </div>

          {/* Events */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <Label className="text-sm font-semibold text-text-primary">
                Sự kiện theo dõi
              </Label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-medium text-primary hover:underline"
              >
                {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            </div>

            <div className="space-y-4">
              {WEBHOOK_EVENT_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {group.label}
                  </p>
                  <div className="space-y-2">
                    {group.events.map((ev) => (
                      <div
                        key={ev.value}
                        className="flex items-center gap-3"
                      >
                        <Checkbox
                          id={`event-${ev.value}`}
                          checked={form.events.includes(ev.value)}
                          onCheckedChange={() => handleEventToggle(ev.value)}
                        />
                        <Label
                          htmlFor={`event-${ev.value}`}
                          className="cursor-pointer text-sm text-text-primary"
                        >
                          {ev.label}
                          <span className="ml-2 font-mono text-[10px] text-text-muted">
                            {ev.value}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className={buttonVariants({ variant: "outline" })}
              disabled={isSaving}
            >
              Hủy
            </button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <AppIcon name="spinner" className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : editing ? (
                "Lưu thay đổi"
              ) : (
                "Tạo Webhook"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── WebhookCard ────────────────────────────────────────────────

function WebhookCard({
  webhook,
  onEdit,
  onDelete,
  onViewLogs,
  onToggleActive,
  isToggling,
}: {
  webhook: Webhook;
  onEdit: (w: Webhook) => void;
  onDelete: (w: Webhook) => void;
  onViewLogs: (w: Webhook) => void;
  onToggleActive: (w: Webhook) => void;
  isToggling: boolean;
}) {
  return (
    <div className="rounded-xl bg-white px-5 py-4 shadow-sm">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
          <AppIcon name="external-link" className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-text-primary">
              {webhook.url}
            </p>
            <ActiveToggle
              webhook={webhook}
              onToggle={() => onToggleActive(webhook)}
              disabled={isToggling}
            />
          </div>

          {/* Stats row */}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted">
            {webhook.lastDeliveredAt ? (
              <span className="flex items-center gap-1">
                <AppIcon name="clock" className="h-3 w-3" />
                {formatDateTime(webhook.lastDeliveredAt)}
              </span>
            ) : (
              <span className="italic">Chưa giao nhận</span>
            )}
            {(webhook.failCount ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-danger">
                <AppIcon name="warning" className="h-3 w-3" />
                {webhook.failCount} lỗi
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="mt-3">
        <EventBadges events={webhook.events} />
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-bg-hover pt-3">
        <button
          type="button"
          onClick={() => onViewLogs(webhook)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-mid transition hover:bg-primary/5"
        >
          <AppIcon name="history" className="h-3.5 w-3.5" />
          Xem logs
        </button>
        <button
          type="button"
          onClick={() => onEdit(webhook)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-bg-subtle hover:text-text-primary"
        >
          <AppIcon name="pencil" className="h-3.5 w-3.5" />
          Chỉnh sửa
        </button>
        <button
          type="button"
          onClick={() => onDelete(webhook)}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger-bg"
        >
          <AppIcon name="delete" className="h-3.5 w-3.5" />
          Xóa
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────

export function WebhooksClient() {
  const { data: webhooks, isLoading } = useWebhooks();
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const { success, error: showError } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [deletingWebhook, setDeletingWebhook] = useState<Webhook | null>(null);
  const [logsWebhook, setLogsWebhook] = useState<Webhook | null>(null);

  function handleOpenCreate() {
    setEditingWebhook(null);
    setFormOpen(true);
  }

  function handleOpenEdit(webhook: Webhook) {
    setEditingWebhook(webhook);
    setFormOpen(true);
  }

  function handleCloseForm() {
    setFormOpen(false);
    setEditingWebhook(null);
  }

  function handleFormSubmit(data: { url: string; events: string[] }) {
    if (editingWebhook) {
      updateWebhook.mutate(
        { id: editingWebhook.id, payload: data },
        {
          onSuccess: () => {
            success("Đã cập nhật webhook.");
            handleCloseForm();
          },
          onError: (err) =>
            showError(getApiErrorMessage(err, "Không thể cập nhật webhook.")),
        }
      );
    } else {
      createWebhook.mutate(data, {
        onSuccess: () => {
          success("Đã tạo webhook mới.");
          handleCloseForm();
        },
        onError: (err) =>
          showError(getApiErrorMessage(err, "Không thể tạo webhook.")),
      });
    }
  }

  function handleToggleActive(webhook: Webhook) {
    updateWebhook.mutate(
      { id: webhook.id, payload: { isActive: !webhook.isActive } },
      {
        onSuccess: () =>
          success(
            webhook.isActive
              ? "Đã tắt webhook."
              : "Đã bật webhook."
          ),
        onError: (err) =>
          showError(getApiErrorMessage(err, "Không thể cập nhật trạng thái.")),
      }
    );
  }

  function handleConfirmDelete() {
    if (!deletingWebhook) return;
    deleteWebhook.mutate(deletingWebhook.id, {
      onSuccess: () => {
        success("Đã xóa webhook.");
        setDeletingWebhook(null);
      },
      onError: (err) => {
        showError(getApiErrorMessage(err, "Không thể xóa webhook."));
        setDeletingWebhook(null);
      },
    });
  }

  const isSaving = createWebhook.isPending || updateWebhook.isPending;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Webhooks"
        description="Tích hợp hệ thống ngoài bằng cách nhận sự kiện theo thời gian thực qua HTTP POST."
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }))}>
              Về quản trị
            </Link>
            <Button onClick={handleOpenCreate}>
              <AppIcon name="plus" className="mr-2 h-4 w-4" />
              Tạo Webhook
            </Button>
          </div>
        }
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl bg-primary/5 px-4 py-3 text-sm text-text-secondary">
        <AppIcon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          AHSO CRM sẽ gửi{" "}
          <span className="font-semibold text-text-primary">HTTP POST</span> tới
          URL bạn cấu hình mỗi khi có sự kiện tương ứng. Payload là JSON chuẩn{" "}
          <span className="font-mono text-xs font-semibold">
            &#123; event, payload, occurredAt &#125;
          </span>
          . Hệ thống thử lại tối đa 3 lần nếu endpoint trả lỗi.
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-bg-subtle" />
          ))}
        </div>
      ) : !webhooks?.length ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-white py-20 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/8 text-primary">
            <AppIcon name="external-link" className="h-8 w-8" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-text-primary">
              Chưa có webhook nào
            </p>
            <p className="mt-1 max-w-xs text-sm text-text-muted">
              Tạo webhook đầu tiên để tích hợp hệ thống ngoài nhận sự kiện từ
              AHSO CRM.
            </p>
          </div>
          <Button onClick={handleOpenCreate} size="sm">
            <AppIcon name="plus" className="mr-2 h-4 w-4" />
            Tạo Webhook đầu tiên
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {webhooks.map((webhook) => (
            <WebhookCard
              key={webhook.id}
              webhook={webhook}
              onEdit={handleOpenEdit}
              onDelete={setDeletingWebhook}
              onViewLogs={setLogsWebhook}
              onToggleActive={handleToggleActive}
              isToggling={updateWebhook.isPending}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <WebhookFormDialog
        open={formOpen}
        editing={editingWebhook}
        isSaving={isSaving}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingWebhook}
        onOpenChange={(open) => !open && setDeletingWebhook(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Webhook sau sẽ bị xóa vĩnh viễn:
              <br />
              <span className="mt-1 block truncate font-mono text-sm font-semibold text-text-primary">
                {deletingWebhook?.url}
              </span>
              <br />
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteWebhook.isPending}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteWebhook.isPending}
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={handleConfirmDelete}
            >
              {deleteWebhook.isPending ? "Đang xóa..." : "Xóa webhook"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logs Sheet */}
      <LogsSheet
        webhook={logsWebhook}
        onClose={() => setLogsWebhook(null)}
      />
    </div>
  );
}
