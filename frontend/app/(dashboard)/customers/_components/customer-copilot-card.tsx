"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  AgentActionSummary,
  CreateActivityAgentPayload,
  useAgentActions,
  useExecuteAgentAction,
  useRejectAgentAction,
  useScanAgentContext,
  useUpdateAgentActionPayload
} from "@/hooks/use-ai";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime, formatDateTimeLocalInput, parseDateTimeLocalInput } from "@/lib/format";

const ACTIVITY_TYPE_LABELS: Record<CreateActivityAgentPayload["type"], string> = {
  CALL: "Cuộc gọi",
  EMAIL: "Email",
  MEETING: "Họp",
  SURVEY: "Khảo sát",
  DEMO: "Demo",
  NOTE: "Ghi chú",
  FOLLOWUP: "Follow-up"
};

const ACTION_STATUS_LABELS: Record<AgentActionSummary["status"], string> = {
  PENDING_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã bỏ qua",
  EXECUTED: "Đã tạo",
  FAILED: "Thất bại"
};

function getActionPayload(action: AgentActionSummary): CreateActivityAgentPayload {
  return action.finalPayload ?? action.proposedPayload;
}

function buildFormState(payload: CreateActivityAgentPayload) {
  return {
    type: payload.type,
    title: payload.title,
    content: payload.content ?? "",
    scheduledAt: payload.scheduledAt ? formatDateTimeLocalInput(payload.scheduledAt) : ""
  };
}

function buildPayload(
  original: CreateActivityAgentPayload,
  form: ReturnType<typeof buildFormState>
): CreateActivityAgentPayload {
  const scheduledAt = form.scheduledAt ? parseDateTimeLocalInput(form.scheduledAt)?.toISOString() : undefined;

  return {
    ...original,
    type: form.type,
    title: form.title.trim(),
    content: form.content.trim() || undefined,
    scheduledAt
  };
}

function ActivityActionCard({ action }: { action: AgentActionSummary }) {
  const payload = useMemo(() => getActionPayload(action), [action]);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(() => buildFormState(payload));
  const updatePayloadMutation = useUpdateAgentActionPayload();
  const executeMutation = useExecuteAgentAction();
  const rejectMutation = useRejectAgentAction();
  const isPending =
    updatePayloadMutation.isPending || executeMutation.isPending || rejectMutation.isPending;
  const isReviewable = action.status === "PENDING_REVIEW" || action.status === "APPROVED";

  const handleSave = async () => {
    try {
      await updatePayloadMutation.mutateAsync({
        actionId: action.id,
        finalPayload: buildPayload(payload, form)
      });
      setIsEditing(false);
      toast({ title: "Đã lưu chỉnh sửa", description: "Payload gợi ý AI đã được cập nhật." });
    } catch (error) {
      toast({
        title: "Không thể lưu",
        description: getApiErrorMessage(error, "Payload chưa hợp lệ"),
        variant: "destructive"
      });
    }
  };

  const handleExecute = async () => {
    try {
      const result = await executeMutation.mutateAsync(action.id);
      if (result.status === "FAILED") {
        toast({
          title: "Không thể tạo hoạt động",
          description: result.executionError ?? "Action AI thực thi thất bại.",
          variant: "destructive"
        });
        return;
      }
      toast({ title: "Đã tạo hoạt động", description: "Gợi ý AI đã được áp dụng vào CRM." });
    } catch (error) {
      toast({
        title: "Không thể tạo hoạt động",
        description: getApiErrorMessage(error, "Action AI thực thi thất bại"),
        variant: "destructive"
      });
    }
  };

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync({ actionId: action.id });
      toast({ title: "Đã bỏ qua gợi ý", description: "Action AI đã được đánh dấu từ chối." });
    } catch (error) {
      toast({
        title: "Không thể bỏ qua",
        description: getApiErrorMessage(error, "Không thể từ chối action"),
        variant: "destructive"
      });
    }
  };

  return (
    <article className="rounded-2xl border border-primary/20 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-bg text-primary">
            <AppIcon name="smart_toy" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Gợi ý AI</p>
            <p className="truncate text-sm font-semibold text-text-primary">
              {action.dryRunSummary ?? payload.title}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={action.riskLevel === "LOW" ? "success" : "warning"}>{action.riskLevel}</Badge>
          <Badge variant={action.status === "FAILED" ? "danger" : action.status === "EXECUTED" ? "success" : "info"}>
            {ACTION_STATUS_LABELS[action.status]}
          </Badge>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-text-secondary">Loại hoạt động</span>
            <select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as CreateActivityAgentPayload["type"]
                }))
              }
              className="h-10 rounded-md border border-border bg-bg-input px-3 text-sm text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-info/15"
            >
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-text-secondary">Tiêu đề</span>
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-text-secondary">Thời gian</span>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-text-secondary">Nội dung</span>
            <Textarea
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              className="min-h-[96px]"
            />
          </label>
        </div>
      ) : (
        <div className="mt-4 space-y-2 text-sm">
          <p className="font-semibold text-text-primary">{payload.title}</p>
          <p className="text-text-secondary">
            {ACTIVITY_TYPE_LABELS[payload.type]}
            {payload.scheduledAt ? ` · ${formatDateTime(payload.scheduledAt)}` : ""}
          </p>
          {payload.content ? <p className="whitespace-pre-line text-text-secondary">{payload.content}</p> : null}
          {action.executionError ? <p className="text-danger">{action.executionError}</p> : null}
          {action.status === "EXECUTED" && action.targetEntityId ? (
            <Link href={`/activities/${action.targetEntityId}`} className="inline-flex text-sm font-semibold text-primary hover:underline">
              Mở hoạt động đã tạo
            </Link>
          ) : null}
        </div>
      )}

      {isReviewable ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <Button type="button" size="sm" onClick={handleSave} disabled={isPending || form.title.trim().length < 2}>
                Lưu chỉnh sửa
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isPending}>
                Hủy
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(true)} disabled={isPending}>
                Sửa
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleReject} disabled={isPending}>
                Bỏ qua
              </Button>
              <Button type="button" size="sm" onClick={handleExecute} disabled={isPending}>
                Tạo hoạt động
              </Button>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function CustomerCopilotCard({ customerId }: { customerId: string }) {
  const actionsQuery = useAgentActions({ contextEntityType: "customer", contextEntityId: customerId });
  const scanMutation = useScanAgentContext();

  const handleScan = async () => {
    try {
      const result = await scanMutation.mutateAsync({ entityType: "customer", entityId: customerId });
      toast({ title: "Đã quét ngữ cảnh", description: result.message });
    } catch (error) {
      toast({
        title: "Không thể quét gợi ý AI",
        description: getApiErrorMessage(error, "Vui lòng thử lại sau."),
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">CRM Copilot</p>
          <CardTitle>Gợi ý hành động</CardTitle>
        </div>
        <Button type="button" variant="outline" onClick={handleScan} disabled={scanMutation.isPending}>
          <AppIcon name="smart_toy" className="h-4 w-4" />
          {scanMutation.isPending ? "Đang quét..." : "Quét gợi ý AI"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {actionsQuery.isLoading ? (
          <div className="space-y-3">
            <LoadingSkeleton className="h-28 w-full" />
            <LoadingSkeleton className="h-20 w-full" />
          </div>
        ) : actionsQuery.data && actionsQuery.data.length > 0 ? (
          actionsQuery.data.slice(0, 5).map((action) => {
            if (action.actionType === "CREATE_ACTIVITY") {
              return <ActivityActionCard key={action.id} action={action} />;
            }

            return null;
          })
        ) : (
          <EmptyState
            title="Chưa có gợi ý"
            description="Bấm quét để Copilot kiểm tra tín hiệu như khách lâu chưa tương tác hoặc báo giá đã gửi chưa phản hồi."
          />
        )}
      </CardContent>
    </Card>
  );
}
