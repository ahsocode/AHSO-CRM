"use client";

import Link from "next/link";
import { useState } from "react";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { Priority, ProjectKanbanColumn, ProjectListMeta, ProjectStatus } from "@/lib/types";

const PRIORITY_VARIANTS: Record<Priority, "neutral" | "info" | "warning"> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "warning"
};

export function ProjectKanbanBoard({
  columns,
  meta,
  isLoading,
  isError,
  errorMessage,
  isUpdating,
  updatingProjectId,
  onStatusChange
}: {
  columns: ProjectKanbanColumn[];
  meta?: ProjectListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  isUpdating: boolean;
  updatingProjectId?: string;
  onStatusChange: (projectId: string, status: ProjectStatus) => void;
}) {
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null);

  if (isLoading) {
    return (
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <Card key={index} className="w-[320px] shrink-0 border border-white/70">
              <CardHeader className="space-y-3">
                <LoadingSkeleton className="h-6 w-32" />
                <LoadingSkeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 2 }).map((_, itemIndex) => (
                  <LoadingSkeleton key={itemIndex} className="h-56 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border border-danger/20">
        <CardHeader>
          <CardTitle>Kanban pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải kanban dự án."}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalItems = columns.reduce((total, column) => total + column.itemCount, 0);

  if (totalItems === 0) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Kanban pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Không có dự án trong pipeline"
            description="Thử nới bộ lọc hiện tại hoặc tạo dự án mới để kiểm tra luồng kanban."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Kanban Pipeline</p>
          <h2 className="mt-2 font-heading text-2xl font-bold text-text-primary">Board theo trạng thái dự án</h2>
        </div>
        <p className="text-sm text-text-secondary">
          {meta?.total ?? totalItems} dự án trong tập lọc hiện tại. Có thể kéo thả card giữa các cột hoặc dùng select làm fallback.
        </p>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {columns.map((column) => (
            <Card
              key={column.key}
              className={`flex w-[320px] shrink-0 flex-col border transition ${
                dragOverStatus === column.key ? "border-primary/45 bg-primary/5 shadow-lg" : "border-white/70"
              }`}
              onDragOver={(event) => {
                event.preventDefault();

                if (!draggingProjectId) {
                  return;
                }

                event.dataTransfer.dropEffect = "move";
                setDragOverStatus(column.key);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverStatus((current) => (current === column.key ? null : current));
                }
              }}
              onDrop={(event) => {
                event.preventDefault();

                const projectId = event.dataTransfer.getData("text/project-id");
                const currentStatus = event.dataTransfer.getData("text/project-status") as ProjectStatus;

                setDraggingProjectId(null);
                setDragOverStatus(null);

                if (!projectId || !currentStatus || currentStatus === column.key) {
                  return;
                }

                onStatusChange(projectId, column.key);
              }}
            >
              <CardHeader className="space-y-3 border-b border-border/60 bg-white/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Stage</p>
                    <CardTitle className="mt-2 text-xl">{column.label}</CardTitle>
                  </div>
                  <Badge variant="neutral">{column.itemCount}</Badge>
                </div>
                <p className="text-sm text-text-secondary">
                  <CurrencyDisplay amount={column.totalValue} short />
                </p>
              </CardHeader>

              <CardContent className="flex-1 space-y-4 pt-4">
                {column.items.length === 0 ? (
                  <div
                    className={`rounded-2xl border border-dashed p-4 text-sm transition ${
                      dragOverStatus === column.key
                        ? "border-primary/45 bg-primary/10 text-primary"
                        : "border-border/60 bg-bg-hover/50 text-text-secondary"
                    }`}
                  >
                    Chưa có dự án ở stage này.
                  </div>
                ) : (
                  column.items.map((project) => (
                    <article
                      key={project.id}
                      draggable={!(isUpdating && updatingProjectId === project.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/project-id", project.id);
                        event.dataTransfer.setData("text/project-status", project.status);
                        setDraggingProjectId(project.id);
                      }}
                      onDragEnd={() => {
                        setDraggingProjectId(null);
                        setDragOverStatus(null);
                      }}
                      className={`rounded-2xl border p-4 shadow-sm transition ${
                        draggingProjectId === project.id
                          ? "cursor-grabbing border-primary/45 bg-primary/5 opacity-60 shadow-xl"
                          : "border-border/60 bg-white/85"
                      } ${isUpdating && updatingProjectId === project.id ? "pointer-events-none opacity-60" : "cursor-grab"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/projects/${project.id}`}
                            className="line-clamp-2 font-heading text-lg font-bold text-text-primary hover:text-primary"
                          >
                            {project.name}
                          </Link>
                          <p className="mt-1 text-sm text-text-secondary">{project.code}</p>
                        </div>
                        {project.isOverdue ? <Badge variant="danger">Trễ hạn</Badge> : null}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge kind="project" status={project.status} />
                        <Badge variant={PRIORITY_VARIANTS[project.priority]}>
                          {PRIORITY_LABELS[project.priority]}
                        </Badge>
                      </div>

                      <div className="mt-4 flex items-start gap-3">
                        <AvatarInitials name={project.customer.assignedTo.name} className="h-10 w-10 rounded-full text-xs" />
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-semibold text-text-primary">{project.customer.name}</p>
                          <p className="truncate text-text-secondary">{project.customer.assignedTo.name}</p>
                          <p className="truncate text-text-secondary">{project.customer.industry ?? "Chưa phân ngành"}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-border/60 bg-bg-hover/40 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Giá trị</span>
                          <span className="font-heading text-xl font-extrabold text-text-primary">
                            <CurrencyDisplay amount={project.estimatedValue} short />
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm text-text-secondary">
                          <span>{project.progressPercent}% tiến độ</span>
                          <span>{project.expectedEndDate ? formatDate(project.expectedEndDate) : "Chưa có hạn"}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${project.progressPercent}%` }} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-text-secondary">
                        <p>{project.quoteCount} báo giá · {project.milestoneCount} milestone · {project.activityCount} activity</p>
                        <p>Cập nhật {formatRelativeTime(project.lastActivityAt ?? project.updatedAt)}</p>
                        {project.contract ? (
                          <p className="font-medium text-text-primary">HĐ: {project.contract.contractNo}</p>
                        ) : (
                          <p>Chưa có hợp đồng</p>
                        )}
                      </div>

                      <div className="mt-4 space-y-3">
                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                            Chuyển stage
                          </span>
                          <Select
                            disabled={isUpdating && updatingProjectId === project.id}
                            value={project.status}
                            onChange={(event) => {
                              const nextStatus = event.target.value as ProjectStatus;

                              if (nextStatus === project.status) {
                                return;
                              }

                              onStatusChange(project.id, nextStatus);
                            }}
                          >
                            {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </label>

                        <div className="grid grid-cols-2 gap-2">
                          <Link href={`/projects/${project.id}`} className="contents">
                            <Button type="button" variant="outline">
                              Chi tiết
                            </Button>
                          </Link>
                          <Link href={`/projects/${project.id}/edit`} className="contents">
                            <Button type="button" variant="ghost">
                              Sửa
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
