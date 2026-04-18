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
import { viLocale } from 'date-fns/locale';
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
      <div className="bg-white rounded-lg p-8 text-center text-[#5D6D7E]">
        Đang tải...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center text-[#5D6D7E]">
        Không có hoạt động nào
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#D5D8DC] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F4F6F8] hover:bg-[#F4F6F8]">
            <TableHead className="text-[#1C2833] font-semibold">Loại</TableHead>
            <TableHead className="text-[#1C2833] font-semibold">Tiêu đề</TableHead>
            <TableHead className="text-[#1C2833] font-semibold">Khách hàng</TableHead>
            <TableHead className="text-[#1C2833] font-semibold">Dự án</TableHead>
            <TableHead className="text-[#1C2833] font-semibold">Nhân viên</TableHead>
            <TableHead className="text-[#1C2833] font-semibold">Thời gian dự kiến</TableHead>
            <TableHead className="text-[#1C2833] font-semibold">Trạng thái</TableHead>
            <TableHead className="text-right text-[#1C2833] font-semibold">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((activity) => (
            <TableRow key={activity.id} className="hover:bg-[#EBF5FB]">
              <TableCell>
                <ActivityStatusBadge type={activity.type} />
              </TableCell>
              <TableCell className="max-w-xs truncate text-[#1C2833]">
                {activity.title}
              </TableCell>
              <TableCell className="text-[#5D6D7E]">
                {activity.customer?.name || '—'}
              </TableCell>
              <TableCell className="text-[#5D6D7E]">
                {activity.project ? `${activity.project.code} - ${activity.project.name}` : '—'}
              </TableCell>
              <TableCell className="text-[#5D6D7E]">{activity.user?.name}</TableCell>
              <TableCell className="text-[#5D6D7E]">
                {activity.scheduledAt
                  ? formatDistanceToNow(new Date(activity.scheduledAt), {
                      addSuffix: true,
                      locale: viLocale,
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
                    className="text-[#2E86C1] hover:text-[#1A5276] hover:bg-[#D6EAF8]"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {meta && (
        <div className="px-6 py-4 border-t border-[#D5D8DC] flex items-center justify-between">
          <div className="text-sm text-[#5D6D7E]">
            Hiển thị {(meta.page - 1) * meta.limit + 1} đến{' '}
            {Math.min(meta.page * meta.limit, meta.total)} của {meta.total} hoạt động
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => onPageChange?.(meta.page - 1)}
              className="border-[#D5D8DC] text-[#1C2833]"
            >
              Trang trước
            </Button>
            <div className="flex items-center px-3 text-sm text-[#5D6D7E]">
              Trang {meta.page}/{meta.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange?.(meta.page + 1)}
              className="border-[#D5D8DC] text-[#1C2833]"
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
