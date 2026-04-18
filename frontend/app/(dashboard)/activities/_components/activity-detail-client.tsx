'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useActivity, useDeleteActivity, useUpdateActivity } from '@/hooks/use-activities';
import { ActivityStatusBadge } from './activity-status-badge';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ArrowLeft, Edit, Trash2, CheckCircle, Circle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ActivityDetailClientProps {
  id: string;
}

export function ActivityDetailClient({ id }: ActivityDetailClientProps) {
  const router = useRouter();
  const { data: activity, isLoading } = useActivity(id);
  const deleteMutation = useDeleteActivity();
  const updateMutation = useUpdateActivity();

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(id);
    router.push('/activities');
  };

  const handleToggleCompletion = async () => {
    if (activity) {
      await updateMutation.mutateAsync({
        id,
        input: { isCompleted: !activity.isCompleted },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-8 text-center text-[#5D6D7E]">
        <LoadingSkeleton className="h-12 w-48 mx-auto mb-4" />
        <LoadingSkeleton className="h-4 w-64 mx-auto mb-2" />
        <LoadingSkeleton className="h-4 w-64 mx-auto" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-12">
        <p className="text-[#5D6D7E]">Hoạt động không tồn tại</p>
        <Link href="/activities">
          <Button className="mt-4 bg-[#1A5276]">Quay lại danh sách</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="text-[#2E86C1] hover:bg-[#D6EAF8]"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại
      </Button>

      {/* Main Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <ActivityStatusBadge type={activity.type} showIcon />
                <ActivityStatusBadge
                  type={activity.type}
                  variant="completion"
                  isCompleted={activity.isCompleted}
                />
              </div>
              <CardTitle className="text-[#1C2833]">{activity.title}</CardTitle>
              <CardDescription>
                Tạo bởi {activity.user?.name} •{' '}
                {formatDistanceToNow(new Date(activity.createdAt), {
                  addSuffix: true,
                  locale: vi,
                })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className={`border-[#D5D8DC] ${
                  activity.isCompleted
                    ? 'text-[#1E5631] hover:bg-[#D5F5E3]'
                    : 'text-[#5D6D7E] hover:bg-[#EBF5FB]'
                }`}
                onClick={handleToggleCompletion}
                disabled={updateMutation.isPending}
              >
                {activity.isCompleted ? (
                  <CheckCircle className="w-4 h-4 mr-1" />
                ) : (
                  <Circle className="w-4 h-4 mr-1" />
                )}
                {activity.isCompleted ? 'Đánh dấu chưa hoàn tất' : 'Đánh dấu hoàn tất'}
              </Button>
              <Link href={`/activities/${id}/edit`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#D5D8DC] text-[#1C2833]"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Chỉnh sửa
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#C0392B] text-[#C0392B] hover:bg-[#FADBD8]"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Xoá
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle>Xác nhận xoá</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bạn có chắc muốn xoá hoạt động này? Hành động này không thể hoàn tác.
                  </AlertDialogDescription>
                  <div className="flex justify-end gap-2">
                    <AlertDialogCancel>Huỷ</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-[#C0392B] hover:bg-[#922B21]"
                    >
                      {deleteMutation.isPending ? 'Đang xoá...' : 'Xoá'}
                    </AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {activity.content && (
            <div>
              <h3 className="text-sm font-semibold text-[#1C2833] mb-2">Nội dung</h3>
              <p className="text-[#5D6D7E] whitespace-pre-wrap">{activity.content}</p>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#D5D8DC]">
            {activity.customer && (
              <div>
                <h3 className="text-sm font-semibold text-[#1C2833] mb-2">Khách hàng</h3>
                <Link
                  href={`/customers/${activity.customer.id}`}
                  className="text-[#2E86C1] hover:underline"
                >
                  {activity.customer.name}
                </Link>
              </div>
            )}

            {activity.project && (
              <div>
                <h3 className="text-sm font-semibold text-[#1C2833] mb-2">Dự án</h3>
                <Link
                  href={`/projects/${activity.project.id}`}
                  className="text-[#2E86C1] hover:underline"
                >
                  {activity.project.code} - {activity.project.name}
                </Link>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-[#1C2833] mb-2">Người thực hiện</h3>
              <p className="text-[#5D6D7E]">{activity.user?.name}</p>
            </div>

            {activity.scheduledAt && (
              <div>
                <h3 className="text-sm font-semibold text-[#1C2833] mb-2">
                  Thời gian dự kiến
                </h3>
                <p className="text-[#5D6D7E]">
                  {new Date(activity.scheduledAt).toLocaleString('vi-VN')}
                </p>
              </div>
            )}

            {activity.attachmentUrl && (
              <div>
                <h3 className="text-sm font-semibold text-[#1C2833] mb-2">Tệp đính kèm</h3>
                <a
                  href={activity.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2E86C1] hover:underline break-all"
                >
                  {activity.attachmentUrl}
                </a>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-[#1C2833] mb-2">Lần cập nhật cuối</h3>
              <p className="text-[#5D6D7E]">
                {formatDistanceToNow(new Date(activity.updatedAt), {
                  addSuffix: true,
                  locale: vi,
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
