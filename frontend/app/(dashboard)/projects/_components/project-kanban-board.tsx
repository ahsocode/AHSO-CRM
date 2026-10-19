"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { GripVertical, Pencil } from "lucide-react";
import { AvatarInitials, stripLegalPrefix } from "@/components/shared/avatar-initials";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS, CHART_STAGE_COLORS } from "@/lib/constants";
import { formatDate, formatVNDShort } from "@/lib/format";
import { ProjectKanbanColumn, ProjectListItem, ProjectListMeta, ProjectStatus } from "@/lib/types";

// Ngưỡng cảnh báo deal ứ đọng (số ngày ở một stage)
const STAGE_ROTTING_WARNING_DAYS = 14;
const STAGE_ROTTING_DANGER_DAYS = 30;

const DAY_MS = 86_400_000;

type RiskSignal = { color: string; label: string };

// Single highest-priority risk signal per card
function getRiskSignal(project: ProjectListItem): RiskSignal | null {
  if (project.isOverdue) {
    const days = project.expectedEndDate
      ? Math.max(1, Math.floor((Date.now() - new Date(project.expectedEndDate).getTime()) / DAY_MS))
      : null;
    return { color: CHART_COLORS.danger, label: days ? `Trễ hạn ${days} ngày` : "Trễ hạn" };
  }
  if (project.daysInCurrentStage >= STAGE_ROTTING_DANGER_DAYS) {
    return { color: CHART_COLORS.danger, label: `Ứ đọng ${project.daysInCurrentStage} ngày` };
  }
  if (project.daysInCurrentStage >= STAGE_ROTTING_WARNING_DAYS) {
    return { color: CHART_COLORS.accent, label: `Ứ đọng ${project.daysInCurrentStage} ngày` };
  }
  if (!project.hasUpcomingActivity) {
    return { color: CHART_COLORS.accent, label: "Chưa có việc kế tiếp" };
  }
  return null;
}

// Pure card content — used both in normal mode and DragOverlay
function ProjectCardContent({ project }: { project: ProjectListItem }) {
  const risk = getRiskSignal(project);
  const stageColor = CHART_STAGE_COLORS[project.status];

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/projects/${project.id}`}
          title={project.code}
          onClick={(event) => event.stopPropagation()}
          className="line-clamp-2 min-w-0 flex-1 font-heading text-[13.5px] font-bold leading-5 text-text-primary hover:text-primary"
        >
          {project.name}
          {project.priority === "HIGH" ? (
            <span className="ml-1.5 align-middle rounded-full bg-accent-bg px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              Gấp
            </span>
          ) : null}
        </Link>
        {risk ? (
          <span
            data-testid="risk-dot"
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: risk.color }}
            title={risk.label}
            aria-label={risk.label}
          />
        ) : null}
      </div>

      <p className="mt-1 truncate text-xs text-text-secondary">{stripLegalPrefix(project.customer.name)}</p>

      <div className="mt-2 flex items-center gap-2">
        <span className="font-heading text-[13px] font-extrabold text-primary">
          {formatVNDShort(project.estimatedValue)}
        </span>
        <span className="text-text-muted">·</span>
        <span className={`text-xs ${project.isOverdue ? "font-semibold text-danger" : "text-text-secondary"}`}>
          {project.expectedEndDate ? formatDate(project.expectedEndDate) : "Chưa có hạn"}
        </span>
        <AvatarInitials
          name={project.customer.assignedTo.name}
          className="ml-auto h-6 w-6 rounded-full text-[10px]"
        />
      </div>

      <div
        className="absolute bottom-0 left-0 h-[3px]"
        style={{ width: `${project.progressPercent}%`, backgroundColor: stageColor }}
      />
    </>
  );
}

// Draggable card: grip handle triggers drag, rest of card navigates to detail
function DraggableCard({
  project,
  isUpdating,
  updatingProjectId,
}: {
  project: ProjectListItem;
  isUpdating: boolean;
  updatingProjectId?: string;
}) {
  const router = useRouter();
  const disabled = isUpdating && updatingProjectId === project.id;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
    disabled,
  });

  return (
    <article
      ref={setNodeRef}
      {...attributes}
      data-testid="kanban-card"
      onClick={() => router.push(`/projects/${project.id}`)}
      className={`group relative cursor-pointer overflow-hidden rounded-lg border-l-4 bg-bg-card p-3 pb-3.5 shadow-sm transition
        ${isDragging ? "opacity-40 shadow-xl" : "v2-card-hover"}
        ${disabled ? "pointer-events-none opacity-60" : ""}
      `}
      style={{ borderLeftColor: CHART_STAGE_COLORS[project.status] }}
    >
      <div className="absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded bg-bg-card/95 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
        <Link
          href={`/projects/${project.id}/edit`}
          onClick={(event) => event.stopPropagation()}
          className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-secondary"
          title="Sửa dự án"
          aria-label="Sửa dự án"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        {/* Drag handle — only this triggers drag */}
        <div
          {...listeners}
          onClick={(event) => event.stopPropagation()}
          className="cursor-grab rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-secondary active:cursor-grabbing"
          title="Kéo để chuyển giai đoạn"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      </div>

      <ProjectCardContent project={project} />
    </article>
  );
}

// Droppable column
function DroppableKanbanColumn({
  column,
  isUpdating,
  updatingProjectId,
}: {
  column: ProjectKanbanColumn;
  isUpdating: boolean;
  updatingProjectId?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  const [collapsed, setCollapsed] = useState(column.key === "LOST");
  const color = CHART_STAGE_COLORS[column.key];

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        data-testid="kanban-column"
        data-column={column.key}
        data-collapsed="true"
        className={`flex w-14 shrink-0 flex-col items-center gap-3 rounded-lg py-3 transition
          ${isOver ? "bg-primary-bg" : "bg-bg-subtle"}`}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex h-full w-full flex-col items-center gap-3 text-text-secondary hover:text-text-primary"
          title={`Mở cột ${column.label}`}
          aria-label={`Mở cột ${column.label}`}
        >
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {column.itemCount}
          </span>
          <span className="text-xs font-semibold" style={{ writingMode: "vertical-rl" }}>
            {column.label}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="kanban-column"
      data-column={column.key}
      data-collapsed="false"
      className={`flex w-[280px] shrink-0 flex-col rounded-lg p-2 transition ${isOver ? "bg-primary-bg" : "bg-bg-subtle"}`}
    >
      <div className="mb-2 space-y-0.5 px-1">
        <div className="flex items-center gap-2">
          <span className="v2-stage-dot" style={{ backgroundColor: color }} />
          <p className="min-w-0 flex-1 truncate font-heading text-sm font-bold text-text-primary">{column.label}</p>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {column.itemCount}
          </span>
          {column.key === "LOST" ? (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded px-1 text-xs text-text-secondary hover:bg-bg-hover"
              title="Thu gọn cột"
              aria-label="Thu gọn cột"
            >
              «
            </button>
          ) : null}
        </div>
        <p className="pl-5 text-xs font-semibold text-text-secondary">
          <CurrencyDisplay amount={column.totalValue} short />
        </p>
      </div>

      <div ref={setNodeRef} className="min-h-[120px] flex-1 space-y-2">
        {column.items.length === 0 ? (
          <div className="min-h-[120px] rounded-lg bg-bg-hover/50 p-4 text-sm text-text-secondary">
            Chưa có dự án ở giai đoạn này.
          </div>
        ) : (
          column.items.map((project) => (
            <DraggableCard
              key={project.id}
              project={project}
              isUpdating={isUpdating}
              updatingProjectId={updatingProjectId}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function ProjectKanbanBoard({
  columns,
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
            <Card key={index} className="w-[320px] shrink-0 ">
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
          <CardTitle>Pipeline dự án</CardTitle>
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
      <Card className="">
        <CardHeader>
          <CardTitle>Pipeline dự án</CardTitle>
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
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
        {activeProject ? (
          <article
            className="relative w-[264px] rotate-1 cursor-grabbing overflow-hidden rounded-lg border-l-4 bg-bg-card p-3 pb-3.5 opacity-95 shadow-2xl"
            style={{ borderLeftColor: CHART_STAGE_COLORS[activeProject.status] }}
          >
            <ProjectCardContent project={activeProject} />
          </article>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
