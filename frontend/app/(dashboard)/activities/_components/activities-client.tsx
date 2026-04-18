'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useActivities } from '@/hooks/use-activities';
import { ActivityTable } from './activity-table';
import { ActivityFilters } from './activity-filters';

export function ActivitiesClient() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
  });

  const { data, isLoading } = useActivities(filters);

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
        <Link href="/activities/new">
          <Button className="bg-[#1A5276] hover:bg-[#154360]">
            <Plus className="w-4 h-4 mr-2" />
            Tạo hoạt động
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <ActivityFilters filters={filters} onFiltersChange={setFilters} />

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
