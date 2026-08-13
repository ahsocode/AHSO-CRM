import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Select } from "@/components/ui/select";
import { QUOTE_STATUS_LABELS } from "@/lib/constants";
import { ProjectListItem, QuoteStatus } from "@/lib/types";

export function QuoteFilters({
  search,
  status,
  projectId,
  canReset,
  projects,
  projectsUnavailable,
  onSearchChange,
  onStatusChange,
  onProjectIdChange,
  onReset
}: {
  search: string;
  status: QuoteStatus | "";
  projectId: string;
  canReset: boolean;
  projects: ProjectListItem[];
  projectsUnavailable: boolean;
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

      <label className="w-[150px]" htmlFor="quote-project">
        <span className="sr-only">Dự án</span>
        <Select
          id="quote-project"
          disabled={projectsUnavailable}
          value={projectId}
          onChange={(event) => onProjectIdChange(event.target.value)}
          className="h-9 rounded-lg bg-white text-[12.5px]"
        >
          <option value="">{projectsUnavailable ? "Không tải được dự án" : "Dự án"}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} · {project.name}
            </option>
          ))}
        </Select>
      </label>
    </CompactFilterToolbar>
  );
}
