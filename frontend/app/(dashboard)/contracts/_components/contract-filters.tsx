import { ProjectCombobox } from "@/components/shared/project-combobox";
import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Select } from "@/components/ui/select";
import { CONTRACT_STATUS_LABELS } from "@/lib/constants";
import { ContractStatus } from "@/lib/types";

export function ContractFilters({
  search,
  status,
  projectId,
  canReset,
  onSearchChange,
  onStatusChange,
  onProjectIdChange,
  onReset
}: {
  search: string;
  status: ContractStatus | "";
  projectId: string;
  canReset: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ContractStatus | "") => void;
  onProjectIdChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
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
  );
}
