import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="surface-card grid gap-4 border border-white/70 p-5 md:grid-cols-2 xl:grid-cols-[1.2fr_220px_280px_auto]">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="contract-search">
          Tìm kiếm
        </label>
        <Input
          id="contract-search"
          placeholder="Tìm theo số HĐ, dự án hoặc khách hàng..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="contract-status">
          Trạng thái
        </label>
        <Select
          id="contract-status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as ContractStatus | "")}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="contract-project">
          Dự án
        </label>
        <Select
          id="contract-project"
          disabled={projectsUnavailable}
          value={projectId}
          onChange={(event) => onProjectIdChange(event.target.value)}
        >
          <option value="">{projectsUnavailable ? "Không tải được dự án" : "Tất cả dự án"}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} · {project.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end">
        <Button className="w-full xl:w-auto" disabled={!canReset} onClick={onReset} type="button" variant="outline">
          Xóa bộ lọc
        </Button>
      </div>
    </div>
  );
}
