'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DeletedRecordsPanel } from '@/components/shared/deleted-records-panel';
import { useActivities, useDeletedActivities, useRestoreActivity, ActivityFilters } from '@/hooks/use-activities';
import { useToast } from '@/hooks/use-toast';
import { ActivityTable } from './activity-table';
import { ActivityFilters as ActivityFiltersComponent } from './activity-filters';

export function ActivitiesClient() {
  const [filters, setFilters] = useState<ActivityFilters>({
    page: 1,
    limit: 10,
  });
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedPage, setDeletedPage] = useState(1);

  const { data, isLoading } = useActivities(filters);
  const deletedActivitiesQuery = useDeletedActivities({
    ...filters,
    page: deletedPage
  }, showDeleted);
  const restoreActivity = useRestoreActivity();
  const { success, error: showError } = useToast();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2833]">Hoạt động</h1>
          <p className="text-sm text-[#5D6D7E] mt-1">
            Quản lý hoạt động và lịch sử tương tác
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant={showDeleted ? "primary" : "outline"}
            onClick={() => setShowDeleted((value) => !value)}
            className="hidden md:inline-flex"
          >
            {showDeleted ? "Ẩn thùng rác" : "Thùng rác"}
          </Button>
          <Link href="/activities/new">
            <Button className="bg-[#1A5276] hover:bg-[#154360]">
              <Plus className="w-4 h-4 mr-2" />
              Tạo hoạt động
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <ActivityFiltersComponent filters={filters} onFiltersChange={setFilters} />

      {showDeleted ? (
        <DeletedRecordsPanel
          title="Hoạt động đã xóa mềm"
          description="Các hoạt động đã xóa mềm vẫn có thể khôi phục để trả lại timeline, lịch và lịch sử tương tác."
          emptyTitle="Thùng rác hoạt động đang trống"
          emptyDescription="Khi xóa mềm hoạt động, bản ghi sẽ xuất hiện ở đây."
          items={deletedActivitiesQuery.data?.items ?? []}
          isLoading={deletedActivitiesQuery.isLoading}
          isError={deletedActivitiesQuery.isError}
          errorMessage={deletedActivitiesQuery.error instanceof Error ? deletedActivitiesQuery.error.message : "Không thể tải hoạt động đã xóa."}
          isRestoring={restoreActivity.isPending}
          page={deletedActivitiesQuery.data?.meta?.page}
          totalPages={deletedActivitiesQuery.data?.meta?.totalPages}
          total={deletedActivitiesQuery.data?.meta?.total}
          onPageChange={setDeletedPage}
          getTitle={(activity) => activity.title}
          getSubtitle={(activity) => [activity.customer?.name, activity.project?.name].filter(Boolean).join(" · ")}
          getMeta={(activity) => `Người phụ trách: ${activity.user?.name ?? "Chưa gán"}`}
          onRestore={(id) =>
            restoreActivity.mutate(id, {
              onSuccess: () => success("Đã khôi phục hoạt động."),
              onError: (error) => showError(error instanceof Error ? error.message : "Không thể khôi phục hoạt động.")
            })
          }
        />
      ) : null}

      {/* Table */}
      <ActivityTable
        activities={data?.items || []}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={(page) => setFilters({ ...filters, page })}
      />
    </div>
  );
}
