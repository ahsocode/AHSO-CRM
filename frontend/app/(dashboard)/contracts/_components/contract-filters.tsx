import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Select } from "@/components/ui/select";
import { CONTRACT_STATUS_LABELS } from "@/lib/constants";
import { ContractStatus, ProjectListItem } from "@/lib/types";

export function ContractFilters({
  search,
  status,
  projectId,
  projects,
  projectsUnavailable,
  canReset,
  onSearchChange,
  onStatusChange,
  onProjectIdChange,
  onReset
}: {
  search: string;
  status: ContractStatus | "";
  projectId: string;
  projects: ProjectListItem[];
  projectsUnavailable: boolean;
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

      <label className="w-[160px]" htmlFor="contract-project">
        <span className="sr-only">Dự án</span>
        <Select
          id="contract-project"
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
