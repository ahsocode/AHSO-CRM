'use client';

import { CompactFilterToolbar } from '@/components/shared/compact-filter-toolbar';
import {
  SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ActivityFilters } from '@/hooks/use-activities';

interface ActivityFiltersProps {
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
}

const ACTIVITY_TYPES = [
  { value: 'CALL', label: 'Cuộc gọi' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'MEETING', label: 'Họp mặt' },
  { value: 'SURVEY', label: 'Khảo sát' },
  { value: 'DEMO', label: 'Demo' },
  { value: 'NOTE', label: 'Ghi chú' },
  { value: 'FOLLOWUP', label: 'Theo dõi' },
];

export function ActivityFilters({ filters, onFiltersChange }: ActivityFiltersProps) {
  const canReset = Boolean(filters.type || filters.search || filters.isCompleted !== undefined);

  return (
    <CompactFilterToolbar
      canReset={canReset}
      onReset={() => onFiltersChange({ ...filters, type: undefined, search: undefined, isCompleted: undefined, page: 1 })}
      onSearchChange={(value) => onFiltersChange({ ...filters, search: value, page: 1 })}
      searchAriaLabel="Tìm kiếm hoạt động"
      searchPlaceholder="Tìm tiêu đề..."
      searchValue={filters.search || ''}
    >
      <div className="w-[132px]">
        <SelectRoot
          value={filters.type || 'all'}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, type: value === 'all' ? undefined : value, page: 1 })
          }
        >
          <SelectTrigger aria-label="Loại hoạt động" className="h-9 rounded-lg border-border bg-white text-[12.5px]">
            <SelectValue placeholder="Loại" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Loại</SelectItem>
            {ACTIVITY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      </div>

      <div className="w-[132px]">
        <SelectRoot
          value={
            filters.isCompleted === undefined
              ? 'all'
              : filters.isCompleted
                ? 'completed'
                : 'pending'
          }
          onValueChange={(value) => {
            let isCompleted: boolean | undefined;
            if (value === 'completed') {
              isCompleted = true;
            } else if (value === 'pending') {
              isCompleted = false;
            }
            onFiltersChange({ ...filters, isCompleted, page: 1 });
          }}
        >
          <SelectTrigger aria-label="Trạng thái" className="h-9 rounded-lg border-border bg-white text-[12.5px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Trạng thái</SelectItem>
            <SelectItem value="pending">Chưa xong</SelectItem>
            <SelectItem value="completed">Hoàn tất</SelectItem>
          </SelectContent>
        </SelectRoot>
      </div>
    </CompactFilterToolbar>
  );
}
