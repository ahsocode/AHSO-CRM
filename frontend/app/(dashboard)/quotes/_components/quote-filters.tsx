import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="surface-card grid gap-4 border border-white/70 p-5 md:grid-cols-2 xl:grid-cols-[1.2fr_220px_280px_auto]">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="quote-search">
          Tìm kiếm
        </label>
        <Input
          id="quote-search"
          placeholder="Tìm theo số BG, dự án, khách hàng hoặc tên hạng mục..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="quote-status">
          Trạng thái
        </label>
        <Select
          id="quote-status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as QuoteStatus | "")}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary" htmlFor="quote-project">
          Dự án
        </label>
        <Select
          id="quote-project"
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
