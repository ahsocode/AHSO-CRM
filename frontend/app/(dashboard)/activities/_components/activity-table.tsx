'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { LedgerHeader } from '@/components/shared/ledger-header';
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
  toolbar?: ReactNode;
}

export function ActivityTable({ activities, isLoading, meta, onPageChange, toolbar }: ActivityTableProps) {
  const currentPage = meta?.page ?? 1;
  const totalPages = Math.max(meta?.totalPages ?? 1, 1);
  const total = meta?.total ?? activities.length;
  const header = (
    <LedgerHeader
      currentPage={currentPage}
      eyebrow="Activity Ledger"
      metaText={`${total} hoạt động · trang ${currentPage}/${totalPages}`}
      onPageChange={onPageChange}
      title="Danh sách hoạt động"
      toolbar={toolbar}
      totalPages={totalPages}
    />
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        {header}
        <div className="p-8 text-center text-text-secondary">Đang tải...</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        {header}
        <div className="p-8 text-center text-text-secondary">Không có hoạt động nào</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-border overflow-hidden">
      {header}
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
    </div>
  );
}
