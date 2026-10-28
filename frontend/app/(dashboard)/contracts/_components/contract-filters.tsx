import { ProjectCombobox } from "@/components/shared/project-combobox";
import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Select } from "@/components/ui/select";
import { CONTRACT_STATUS_LABELS } from "@/lib/constants";
import { ContractStatus } from "@/lib/types";

const QUICK_FILTERS: Array<{ label: string; status: ContractStatus | "" }> = [
  { label: "Hiệu lực", status: "ACTIVE" },
  { label: "Đã hoàn tất", status: "COMPLETED" },
  { label: "Tất cả", status: "" }
];

export function ContractFilters({
  search,
  status,
  projectId,
  canReset,
  includeCancelled,
  onIncludeCancelledChange,
  onSearchChange,
  onStatusChange,
  onProjectIdChange,
  onReset
}: {
  search: string;
  status: ContractStatus | "";
  projectId: string;
  canReset: boolean;
  includeCancelled: boolean;
  onIncludeCancelledChange: (value: boolean) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ContractStatus | "") => void;
  onProjectIdChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc nhanh hợp đồng">
      {QUICK_FILTERS.map((chip) => {
        const selected = status === chip.status;
        return (
          <button
            key={chip.label}
            type="button"
            aria-pressed={selected}
            onClick={() => onStatusChange(chip.status)}
            className={`h-8 rounded-full border px-3 text-[12.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              selected
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-text-secondary hover:border-primary hover:text-primary"
            }`}
          >
            {chip.label}
          </button>
        );
      })}
      <label className="ml-1 flex cursor-pointer items-center gap-2 text-[12.5px] text-text-secondary" htmlFor="contract-include-cancelled">
        <input
          id="contract-include-cancelled"
          type="checkbox"
          checked={includeCancelled}
          onChange={(event) => onIncludeCancelledChange(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Hiện hợp đồng đã hủy
      </label>
    </div>
    <CompactFilterToolbar
      canReset={canReset}
      onReset={onReset}
      onSearchChange={onSearchChange}
      searchAriaLabel="Tìm kiếm hợp đồng"
      searchId="contract-search"
      searchPlaceholder="Số HĐ, dự án, khách hàng..."
      searchValue={search}
    >
      <label className="w-[120px]" htmlFor="contract-status">
        <span className="sr-only">Trạng thái</span>
        <Select
          id="contract-status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as ContractStatus | "")}
          className="h-9 rounded-lg bg-white text-[12.5px]"
        >
          <option value="">Trạng thái</option>
          {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </label>

      <div className="w-[160px]">
        <label className="sr-only" htmlFor="contract-project">Dự án</label>
        <ProjectCombobox id="contract-project" value={projectId} onChange={onProjectIdChange} placeholder="Dự án" className="h-9 rounded-lg bg-bg-card text-[12.5px]" />
      </div>
    </CompactFilterToolbar>
    </div>
  );
}
