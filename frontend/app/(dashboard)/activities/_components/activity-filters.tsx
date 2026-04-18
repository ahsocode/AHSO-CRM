'use client';

import { Input } from '@/components/ui/input';
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
  return (
    <div className="bg-white rounded-lg p-4 border border-[#D5D8DC] space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Type Filter */}
        <div>
          <label className="text-sm font-medium text-[#1C2833] block mb-2">
            Loại hoạt động
          </label>
          <SelectRoot
            value={filters.type || 'all'}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, type: value === 'all' ? undefined : value, page: 1 })
            }
          >
            <SelectTrigger className="border-[#D5D8DC]">
              <SelectValue placeholder="Tất cả loại" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả loại</SelectItem>
              {ACTIVITY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        </div>

        {/* Completion Status */}
        <div>
          <label className="text-sm font-medium text-[#1C2833] block mb-2">
            Trạng thái
          </label>
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
            <SelectTrigger className="border-[#D5D8DC]">
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="pending">Chưa xong</SelectItem>
              <SelectItem value="completed">Hoàn tất</SelectItem>
            </SelectContent>
          </SelectRoot>
        </div>

        {/* Search */}
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-[#1C2833] block mb-2">
            Tìm kiếm
          </label>
          <Input
            placeholder="Tìm tiêu đề..."
            value={filters.search || ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value, page: 1 })
            }
            className="border-[#D5D8DC]"
          />
        </div>
      </div>
    </div>
  );
}
