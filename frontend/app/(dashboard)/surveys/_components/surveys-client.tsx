"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSurveys } from "@/hooks/use-surveys";
import type { SurveyListFilter, SurveyListMeta } from "@/lib/types";
import { SurveyFilters } from "./survey-filters";
import { SurveyTable } from "./survey-table";

export function SurveysClient() {
  const [filters, setFilters] = useState<SurveyListFilter>({ page: 1, limit: 20 });
  const { data, isLoading } = useSurveys(filters);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Khảo sát</h1>
          <p className="mt-1 text-sm text-text-secondary">Hồ sơ khảo sát thực địa tại khách hàng</p>
        </div>
        <Link href="/surveys/new">
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            Tạo khảo sát
          </Button>
        </Link>
      </div>

      <SurveyFilters filters={filters} onFiltersChange={setFilters} />

      <SurveyTable
        surveys={data?.data ?? []}
        isLoading={isLoading}
        meta={data?.meta as SurveyListMeta | undefined}
        onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
      />
    </div>
  );
}
