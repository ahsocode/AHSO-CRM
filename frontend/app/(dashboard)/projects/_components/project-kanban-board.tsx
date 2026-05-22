"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
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
import { Priority, ProjectKanbanColumn, ProjectListItem, ProjectListMeta, ProjectStatus } from "@/lib/types";

const PRIORITY_VARIANTS: Record<Priority, "neutral" | "info" | "warning"> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "warning"
};

const STAGE_COLORS: Record<ProjectStatus, string> = {
  SURVEY: "#78909c",
  QUOTING: "#2e86c1",
  NEGOTIATING: "#e67e22",
  WON: "#2563eb",
  LOST: "#c0392b",
  DELIVERING: "#00897b",
  COMPLETED: "#1e8449"
};

// Pure card content — used both in normal mode and DragOverlay
function ProjectCardContent({
  project,
  isUpdating,
  updatingProjectId,
  onStatusChange,
}: {
  project: ProjectListItem;
  isUpdating: boolean;
  updatingProjectId?: string;
  onStatusChange: (projectId: string, status: ProjectStatus) => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/projects/${project.id}`}
            className="line-clamp-2 font-heading text-[13.5px] font-bold leading-5 text-text-primary hover:text-primary"
          >
            {project.name}
          </Link>
          <p className="mt-1 text-[11.5px] text-text-muted">{project.code}</p>
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

      <div className="mt-3 rounded-lg bg-bg-subtle p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Giá trị</span>
          <span className="font-heading text-base font-extrabold text-primary">
            <CurrencyDisplay amount={project.estimatedValue} short />
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-text-secondary">
          <span>{project.progressPercent}% tiến độ</span>
          <span>{project.expectedEndDate ? formatDate(project.expectedEndDate) : "Chưa có hạn"}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/40">
          <div
            className="h-full rounded-full"
            style={{ width: `${project.progressPercent}%`, backgroundColor: STAGE_COLORS[project.status] }}
          />
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
            className="min-h-[44px]"
            onChange={(event) => {
              const nextStatus = event.target.value as ProjectStatus;
              if (nextStatus !== project.status) onStatusChange(project.id, nextStatus);
            }}
          >
            {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <Link href={`/projects/${project.id}`} className="contents">
            <Button type="button" variant="outline" className="min-h-[44px] min-w-[44px]">
              Chi tiết
            </Button>
          </Link>
          <Link href={`/projects/${project.id}/edit`} className="contents">
            <Button type="button" variant="ghost" className="min-h-[44px] min-w-[44px]">
              Sửa
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}

// Draggable card: grip handle triggers drag, rest of card stays interactive
function DraggableCard({
  project,
  isUpdating,
  updatingProjectId,
  onStatusChange,
}: {
  project: ProjectListItem;
  isUpdating: boolean;
  updatingProjectId?: string;
  onStatusChange: (projectId: string, status: ProjectStatus) => void;
}) {
  const disabled = isUpdating && updatingProjectId === project.id;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
    disabled,
  });

  return (
    <article
      ref={setNodeRef}
      {...attributes}
      className={`relative rounded-lg border-l-4 bg-white p-3 shadow-sm transition
        ${isDragging ? "opacity-40 shadow-xl" : "v2-card-hover"}
        ${disabled ? "pointer-events-none opacity-60" : ""}
      `}
      style={{ borderLeftColor: STAGE_COLORS[project.status] }}
    >
      {/* Drag handle — only this triggers drag, leaves inner links/buttons clickable */}
      <div
        {...listeners}
        className="absolute right-2 top-2 cursor-grab rounded p-0.5 text-text-muted hover:bg-bg-hover hover:text-text-secondary active:cursor-grabbing"
        title="Kéo để chuyển stage"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <ProjectCardContent
        project={project}
        isUpdating={isUpdating}
        updatingProjectId={updatingProjectId}
        onStatusChange={onStatusChange}
      />
    </article>
  );
}

// Droppable column
function DroppableKanbanColumn({
  column,
  isUpdating,
  updatingProjectId,
  onStatusChange,
}: {
  column: ProjectKanbanColumn;
  isUpdating: boolean;
  updatingProjectId?: string;
  onStatusChange: (projectId: string, status: ProjectStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <Card
      className={`flex w-[280px] shrink-0 flex-col border bg-transparent p-0 shadow-none transition
        ${isOver ? "border-primary/45 bg-primary/5 shadow-lg" : "border-white/70"}`}
    >
      <CardHeader className="mb-0 space-y-2 px-1 pb-2 pt-0">
        <div className="flex items-center gap-2">
          <span className="v2-stage-dot" style={{ backgroundColor: STAGE_COLORS[column.key] }} />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm">{column.label}</CardTitle>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{
              backgroundColor: `${STAGE_COLORS[column.key]}22`,
              color: STAGE_COLORS[column.key],
            }}
          >
            {column.itemCount}
          </span>
        </div>
        <p className="px-4 text-xs font-semibold text-text-secondary">
          <CurrencyDisplay amount={column.totalValue} short />
        </p>
      </CardHeader>

      <CardContent className="flex-1 px-0 pt-1">
        <div ref={setNodeRef} className="min-h-[120px] space-y-2">
          {column.items.length === 0 ? (
            <div
              className={`min-h-[120px] rounded-2xl border border-dashed p-4 text-sm transition
                ${isOver
                  ? "border-primary/45 bg-primary/10 text-primary"
                  : "border-border/60 bg-bg-hover/50 text-text-secondary"}`}
            >
              Chưa có dự án ở stage này.
            </div>
          ) : (
            column.items.map((project) => (
              <DraggableCard
                key={project.id}
                project={project}
                isUpdating={isUpdating}
                updatingProjectId={updatingProjectId}
                onStatusChange={onStatusChange}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectKanbanBoard({
  columns,
  meta,
  isLoading,
  isError,
  errorMessage,
  isUpdating,
  updatingProjectId,
  onStatusChange,
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
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const activeProject = activeProjectId
    ? (columns.flatMap((c) => c.items).find((p) => p.id === activeProjectId) ?? null)
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveProjectId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveProjectId(null);
    if (!over) return;
    const newStatus = over.id as ProjectStatus;
    const project = columns.flatMap((c) => c.items).find((p) => p.id === (active.id as string));
    if (!project || project.status === newStatus) return;
    onStatusChange(active.id as string, newStatus);
  }

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveProjectId(null)}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Kanban Pipeline</p>
            <h2 className="mt-2 font-heading text-2xl font-bold text-text-primary">Pipeline Dự án</h2>
          </div>
          <p className="max-w-2xl text-sm text-text-secondary">
            {meta?.total ?? totalItems} dự án trong tập lọc hiện tại. Kéo tay cầm{" "}
            <GripVertical className="inline h-3.5 w-3.5" /> để di chuyển card hoặc dùng select làm fallback.
          </p>
        </div>
        <p className="mb-2 text-center text-xs text-text-muted md:hidden">
          Vuốt ngang để xem thêm cột →
        </p>

        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-4">
            {columns.map((column) => (
              <DroppableKanbanColumn
                key={column.key}
                column={column}
                isUpdating={isUpdating}
                updatingProjectId={updatingProjectId}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
        {activeProject ? (
          <article
            className="w-[280px] rotate-1 cursor-grabbing rounded-lg border-l-4 bg-white p-3 opacity-95 shadow-2xl"
            style={{ borderLeftColor: STAGE_COLORS[activeProject.status] }}
          >
            <ProjectCardContent
              project={activeProject}
              isUpdating={false}
              onStatusChange={onStatusChange}
            />
          </article>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
