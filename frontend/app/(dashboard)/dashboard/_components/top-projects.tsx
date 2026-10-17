"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { useProjects } from "@/hooks/use-projects";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import { formatVNDShort } from "@/lib/format";
import { ProjectStatus } from "@/lib/types";

const CLOSED_STATUSES: ProjectStatus[] = ["LOST", "COMPLETED"];

export function TopProjects() {
  // API has no sortBy: fetch a page and rank by estimatedValue client-side.
  const { data, isLoading } = useProjects({ page: 1, limit: 50 });

  const topItems = useMemo(
    () =>
      (data?.items ?? [])
        .filter((item) => !CLOSED_STATUSES.includes(item.status))
        .sort((a, b) => b.estimatedValue - a.estimatedValue)
        .slice(0, 5),
    [data]
  );

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Pipeline</p>
        <CardTitle>Top 5 dự án giá trị cao đang mở</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <LoadingSkeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : topItems.length === 0 ? (
          <div className="rounded-lg bg-bg-subtle px-4 py-6 text-center text-sm text-text-muted">
            Chưa có dự án đang mở.
          </div>
        ) : (
          <ul>
            {topItems.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-bg-hover even:bg-bg-subtle/70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{project.name}</p>
                    <p className="truncate text-xs text-text-muted">
                      {project.customer.name} · {PROJECT_STATUS_LABELS[project.status]}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-text-primary">
                    {formatVNDShort(project.estimatedValue)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
