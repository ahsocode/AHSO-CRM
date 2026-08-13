import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Select } from "@/components/ui/select";

export function SupplierFilters({
  search,
  isActive,
  canReset,
  onSearchChange,
  onIsActiveChange,
  onReset,
}: {
  search: string;
  isActive: boolean | undefined;
  canReset: boolean;
  onSearchChange: (value: string) => void;
  onIsActiveChange: (value: boolean | undefined) => void;
  onReset: () => void;
}) {
  return (
    <CompactFilterToolbar
      canReset={canReset}
      onReset={onReset}
      onSearchChange={onSearchChange}
      searchAriaLabel="Tìm kiếm nhà cung cấp"
      searchId="supplier-search"
      searchPlaceholder="Tên, mã, mã số thuế..."
      searchValue={search}
    >
      <label className="w-[128px]" htmlFor="supplier-active">
        <span className="sr-only">Trạng thái</span>
        <Select
          id="supplier-active"
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
    </CompactFilterToolbar>
  );
}
