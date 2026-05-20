import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="surface-card grid gap-4 border border-white/70 p-5 md:grid-cols-2 xl:grid-cols-[1.5fr_220px_auto]">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="supplier-search">
          Tìm kiếm
        </label>
        <Input
          id="supplier-search"
          placeholder="Tìm theo tên, mã, mã số thuế..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="supplier-active">
          Trạng thái
        </label>
        <Select
          id="supplier-active"
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
