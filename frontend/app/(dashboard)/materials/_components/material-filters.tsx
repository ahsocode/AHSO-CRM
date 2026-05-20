"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MaterialCategorySelect } from "./material-category-select";

export function MaterialFilters({
  search,
  categoryId,
  isActive,
  lowStockOnly,
  canReset,
  onSearchChange,
  onCategoryChange,
  onIsActiveChange,
  onLowStockOnlyChange,
  onReset,
}: {
  search: string;
  categoryId: string;
  isActive: boolean | undefined;
  lowStockOnly: boolean;
  canReset: boolean;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onIsActiveChange: (value: boolean | undefined) => void;
  onLowStockOnlyChange: (value: boolean) => void;
  onReset: () => void;
}) {
  return (
    <div className="surface-card grid gap-4 border border-white/70 p-5 md:grid-cols-2 xl:grid-cols-[1.5fr_200px_200px_auto_auto]">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="material-search">
          Tìm kiếm
        </label>
        <Input
          id="material-search"
          placeholder="Tìm theo mã, tên vật tư..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="material-category">
          Nhóm vật tư
        </label>
        <MaterialCategorySelect
          id="material-category"
          value={categoryId}
          onChange={onCategoryChange}
          placeholder="Tất cả nhóm"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="material-active">
          Trạng thái
        </label>
        <Select
          id="material-active"
          value={isActive === undefined ? "" : isActive ? "true" : "false"}
          onChange={(e) => {
            const val = e.target.value;
            onIsActiveChange(val === "" ? undefined : val === "true");
          }}
        >
          <option value="">Tất cả</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Ngưng hoạt động</option>
        </Select>
      </div>

      <div className="flex items-end">
        <Button
          type="button"
          variant={lowStockOnly ? "primary" : "outline"}
          onClick={() => onLowStockOnlyChange(!lowStockOnly)}
          className="w-full xl:w-auto"
        >
          ⚠ Tồn thấp
        </Button>
      </div>

      <div className="flex items-end">
        <Button
          className="w-full xl:w-auto"
          disabled={!canReset}
          onClick={onReset}
          type="button"
          variant="outline"
        >
          Xóa bộ lọc
        </Button>
      </div>
    </div>
  );
}
