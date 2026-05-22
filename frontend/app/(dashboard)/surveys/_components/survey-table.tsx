"use client";

import Link from "next/link";
import { Eye, ImageIcon, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { Survey, SurveyListMeta } from "@/lib/types";

interface SurveyTableProps {
  surveys: Survey[];
  isLoading: boolean;
  meta?: SurveyListMeta;
  onPageChange?: (page: number) => void;
}

export function SurveyTable({ surveys, isLoading, meta, onPageChange }: SurveyTableProps) {
  if (isLoading) {
    return <div className="rounded-lg bg-white p-8 text-center text-text-secondary">Đang tải...</div>;
  }

  if (surveys.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center text-text-secondary">
        Chưa có khảo sát nào
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      {/* Mobile */}
      <div className="divide-y divide-border md:hidden">
        {surveys.map((survey) => (
          <Link key={survey.id} href={`/surveys/${survey.id}`} className="block p-4 hover:bg-bg-subtle transition">
            <p className="font-semibold text-text-primary truncate">{survey.title}</p>
            <p className="mt-1 text-xs text-text-secondary">
              {survey.customer?.name}
              {survey.project ? ` · ${survey.project.code}` : ""}
              {survey.location ? ` · ${survey.location}` : ""}
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
              {survey.surveyedAt ? <span>{formatDate(survey.surveyedAt)}</span> : <span>Chưa có ngày</span>}
              <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" />{survey.counts?.media ?? survey.media?.length ?? 0}</span>
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{survey.counts?.notes ?? survey.notes?.length ?? 0}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-bg-subtle hover:bg-bg-subtle">
              <TableHead className="font-semibold text-text-primary">Tiêu đề</TableHead>
              <TableHead className="font-semibold text-text-primary">Khách hàng</TableHead>
              <TableHead className="font-semibold text-text-primary">Dự án</TableHead>
              <TableHead className="font-semibold text-text-primary">Địa điểm</TableHead>
              <TableHead className="font-semibold text-text-primary">Ngày KS</TableHead>
              <TableHead className="text-center font-semibold text-text-primary">Media</TableHead>
              <TableHead className="text-center font-semibold text-text-primary">Ghi chú</TableHead>
              <TableHead className="text-right font-semibold text-text-primary">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {surveys.map((survey) => (
              <TableRow key={survey.id} className="hover:bg-primary-bg/30">
                <TableCell className="max-w-xs truncate font-medium text-text-primary">{survey.title}</TableCell>
                <TableCell className="text-text-secondary">{survey.customer?.name ?? "—"}</TableCell>
                <TableCell className="text-text-secondary">{survey.project?.code ?? "—"}</TableCell>
                <TableCell className="max-w-[160px] truncate text-text-secondary">{survey.location ?? "—"}</TableCell>
                <TableCell className="text-text-secondary">
                  {survey.surveyedAt ? formatDate(survey.surveyedAt) : "—"}
                </TableCell>
                <TableCell className="text-center text-text-secondary">
                  {survey.counts?.media ?? survey.media?.length ?? 0}
                </TableCell>
                <TableCell className="text-center text-text-secondary">
                  {survey.counts?.notes ?? survey.notes?.length ?? 0}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/surveys/${survey.id}`}>
                    <Button variant="ghost" size="sm" className="text-primary-light hover:bg-primary-bg">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-sm text-text-secondary">
            <span className="hidden sm:inline">
              {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} / {meta.total} khảo sát
            </span>
            <span className="sm:hidden">{meta.total} khảo sát</span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPageChange?.(meta.page - 1)}>Trước</Button>
            <span className="px-1 text-sm text-text-secondary">{meta.page}/{meta.totalPages}</span>
            <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange?.(meta.page + 1)}>Sau</Button>
          </div>
        </div>
      )}
    </div>
  );
}
