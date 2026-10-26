import { ProjectCombobox } from "@/components/shared/project-combobox";
import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Select } from "@/components/ui/select";
import { QUOTE_STATUS_LABELS } from "@/lib/constants";
import { QuoteStatus } from "@/lib/types";

export function QuoteFilters({
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
  status: QuoteStatus | "";
  projectId: string;
  canReset: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: QuoteStatus | "") => void;
  onProjectIdChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <CompactFilterToolbar
      canReset={canReset}
      onReset={onReset}
      onSearchChange={onSearchChange}
      searchAriaLabel="Tìm kiếm báo giá"
      searchClassName="xl:max-w-[240px]"
      searchId="quote-search"
      searchPlaceholder="Số BG, dự án, khách hàng..."
      searchValue={search}
    >
      <label className="w-[112px]" htmlFor="quote-status">
        <span className="sr-only">Trạng thái</span>
        <Select
          id="quote-status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as QuoteStatus | "")}
          className="h-9 rounded-lg bg-white text-[12.5px]"
        >
          <option value="">Trạng thái</option>
          {Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </label>

      <div className="w-[150px]">
        <label className="sr-only" htmlFor="quote-project">Dự án</label>
        <ProjectCombobox id="quote-project" value={projectId} onChange={onProjectIdChange} placeholder="Dự án" className="h-9 rounded-lg bg-bg-card text-[12.5px]" />
      </div>
    </CompactFilterToolbar>
  );
}
