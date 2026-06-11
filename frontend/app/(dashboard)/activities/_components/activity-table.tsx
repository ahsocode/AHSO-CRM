'use client';

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ActivityListItem } from '@/hooks/use-activities';
import { ActivityStatusBadge } from './activity-status-badge';
import { Eye } from 'lucide-react';

interface ActivityTableProps {
  activities: ActivityListItem[];
  isLoading: boolean;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
}

export function ActivityTable({ activities, isLoading, meta, onPageChange }: ActivityTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-8 text-center text-text-secondary">
        Đang tải...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center text-text-secondary">
        Không có hoạt động nào
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-border overflow-hidden">
      {/* Mobile card layout */}
      <div className="md:hidden divide-y divide-border-light">
        {activities.map((activity) => (
          <Link key={activity.id} href={`/activities/${activity.id}`} className="block p-4 hover:bg-bg-subtle transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <ActivityStatusBadge type={activity.type} />
                <ActivityStatusBadge type={activity.type} variant="completion" isCompleted={activity.isCompleted} />
              </div>
              <span className="text-xs text-text-muted shrink-0">
                {activity.scheduledAt
                  ? formatDistanceToNow(new Date(activity.scheduledAt), { addSuffix: true, locale: vi })
                  : '—'}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-text-primary truncate">{activity.title}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary">
              {activity.customer?.name ? <span>{activity.customer.name}</span> : null}
              {activity.project ? <span>{activity.project.code}</span> : null}
              {activity.user?.name ? <span>{activity.user.name}</span> : null}
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop table layout */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-bg-page hover:bg-bg-page">
              <TableHead className="text-text-primary font-semibold">Loại</TableHead>
              <TableHead className="text-text-primary font-semibold">Tiêu đề</TableHead>
              <TableHead className="text-text-primary font-semibold">Khách hàng</TableHead>
              <TableHead className="text-text-primary font-semibold">Dự án</TableHead>
              <TableHead className="text-text-primary font-semibold">Nhân viên</TableHead>
              <TableHead className="text-text-primary font-semibold">Thời gian dự kiến</TableHead>
              <TableHead className="text-text-primary font-semibold">Trạng thái</TableHead>
              <TableHead className="text-right text-text-primary font-semibold">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity) => (
              <TableRow key={activity.id} className="hover:bg-bg-subtle">
                <TableCell>
                  <ActivityStatusBadge type={activity.type} />
                </TableCell>
                <TableCell className="max-w-xs truncate text-text-primary">
                  {activity.title}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {activity.customer?.name || '—'}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {activity.project ? `${activity.project.code} - ${activity.project.name}` : '—'}
                </TableCell>
                <TableCell className="text-text-secondary">{activity.user?.name}</TableCell>
                <TableCell className="text-text-secondary">
                  {activity.scheduledAt
                    ? formatDistanceToNow(new Date(activity.scheduledAt), {
                        addSuffix: true,
                        locale: vi,
                      })
                    : '—'}
                </TableCell>
                <TableCell>
                  <ActivityStatusBadge
                    type={activity.type}
                    variant="completion"
                    isCompleted={activity.isCompleted}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/activities/${activity.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary-light hover:text-primary-mid hover:bg-info-bg"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && (
        <div className="px-4 py-4 border-t border-border flex items-center justify-between gap-3">
          <div className="text-sm text-text-secondary">
            <span className="hidden sm:inline">Hiển thị {(meta.page - 1) * meta.limit + 1} đến{' '}
            {Math.min(meta.page * meta.limit, meta.total)} của {meta.total} hoạt động</span>
            <span className="sm:hidden">{meta.total} hoạt động</span>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => onPageChange?.(meta.page - 1)}
              className="border-border text-text-primary"
            >
              Trước
            </Button>
            <span className="text-sm text-text-secondary px-1">
              {meta.page}/{meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange?.(meta.page + 1)}
              className="border-border text-text-primary"
            >
              Sau
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
