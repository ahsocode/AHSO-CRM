"use client";

import { AppIcon } from "@/components/shared/app-icon";
import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Button } from "@/components/ui/button";
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
    <CompactFilterToolbar
      canReset={canReset}
      onReset={onReset}
      onSearchChange={onSearchChange}
      searchAriaLabel="Tìm kiếm vật tư"
      searchId="material-search"
      searchPlaceholder="Mã, tên vật tư..."
      searchValue={search}
    >
      <label className="w-[140px]" htmlFor="material-category">
        <span className="sr-only">Nhóm vật tư</span>
        <MaterialCategorySelect
          className="h-9 rounded-lg bg-white text-[12.5px]"
          id="material-category"
          value={categoryId}
          onChange={onCategoryChange}
          placeholder="Nhóm"
        />
      </label>

      <label className="w-[128px]" htmlFor="material-active">
        <span className="sr-only">Trạng thái</span>
        <Select
          id="material-active"
          value={isActive === undefined ? "" : isActive ? "true" : "false"}
          onChange={(e) => {
            const val = e.target.value;
            onIsActiveChange(val === "" ? undefined : val === "true");
          }}
          className="h-9 rounded-lg bg-white text-[12.5px]"
        >
          <option value="">Trạng thái</option>
          <option value="true">Hoạt động</option>
          <option value="false">Ngưng</option>
        </Select>
      </label>

      <Button
        aria-label="Chỉ hiện tồn thấp"
        aria-pressed={lowStockOnly}
        className="h-9 w-9 rounded-lg p-0"
        onClick={() => onLowStockOnlyChange(!lowStockOnly)}
        title="Chỉ hiện tồn thấp"
        type="button"
        variant={lowStockOnly ? "primary" : "outline"}
      >
        <AppIcon name="warning" className="h-4 w-4" />
      </Button>
    </CompactFilterToolbar>
  );
}
