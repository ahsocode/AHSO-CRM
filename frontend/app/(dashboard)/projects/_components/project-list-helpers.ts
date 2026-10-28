import type { ProjectStatus } from "@/lib/types";

export type ProjectSortField = "updatedAt" | "createdAt" | "code" | "estimatedValue" | "expectedEndDate" | "name";
export type ProjectSortDir = "asc" | "desc";
export interface ProjectSortState {
  sortBy?: ProjectSortField;
  sortDir?: ProjectSortDir;
}

export const TERMINAL_PROJECT_STATUSES: readonly ProjectStatus[] = ["COMPLETED", "LOST"];

export function isTerminalProjectStatus(status: ProjectStatus): boolean {
  return TERMINAL_PROJECT_STATUSES.includes(status);
}

const ASC_FIRST: readonly ProjectSortField[] = ["name", "code", "expectedEndDate"];

/**
 * Header click cycle: first click = natural direction, second = reversed,
 * third = back to the default order (active first, newest first).
 */
export function nextProjectSort(current: ProjectSortState, field: ProjectSortField): ProjectSortState {
  const firstDir: ProjectSortDir = ASC_FIRST.includes(field) ? "asc" : "desc";

  if (current.sortBy !== field) {
    return { sortBy: field, sortDir: firstDir };
  }
  if (current.sortDir === firstDir) {
    return { sortBy: field, sortDir: firstDir === "asc" ? "desc" : "asc" };
  }
  return {};
}

export function ariaSortFor(current: ProjectSortState, field: ProjectSortField): "ascending" | "descending" | "none" {
  if (current.sortBy !== field) return "none";
  return current.sortDir === "asc" ? "ascending" : "descending";
}
