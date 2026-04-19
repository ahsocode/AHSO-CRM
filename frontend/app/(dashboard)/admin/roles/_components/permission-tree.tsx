"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { PermissionGroup } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  view: "Xem",
  create: "Tạo",
  edit: "Sửa",
  delete: "Xoá"
};

function hasAllPermissions(selectedIds: string[], permissionIds: string[]) {
  return permissionIds.length > 0 && permissionIds.every((permissionId) => selectedIds.includes(permissionId));
}

export function PermissionTree({
  groups,
  selectedPermissionIds,
  disabled,
  onChange
}: {
  groups: PermissionGroup[];
  selectedPermissionIds: string[];
  disabled?: boolean;
  onChange: (permissionIds: string[]) => void;
}) {
  const [expandedResources, setExpandedResources] = useState<Record<string, boolean>>({});
  const allPermissionIds = useMemo(
    () => groups.flatMap((group) => group.permissions.map((permission) => permission.id)),
    [groups]
  );

  const togglePermission = (permissionId: string, checked: boolean) => {
    if (checked) {
      onChange(Array.from(new Set([...selectedPermissionIds, permissionId])));
      return;
    }

    onChange(selectedPermissionIds.filter((candidate) => candidate !== permissionId));
  };

  const toggleGroup = (group: PermissionGroup, checked: boolean) => {
    const groupIds = group.permissions.map((permission) => permission.id);

    if (checked) {
      onChange(Array.from(new Set([...selectedPermissionIds, ...groupIds])));
      return;
    }

    onChange(selectedPermissionIds.filter((candidate) => !groupIds.includes(candidate)));
  };

  const toggleAll = (checked: boolean) => {
    onChange(checked ? allPermissionIds : []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-bg-card/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Permission matrix</p>
          <p className="text-xs text-text-secondary">
            Chọn nhanh theo từng resource hoặc toàn bộ hệ thống.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm font-medium text-text-primary">
          <Checkbox
            checked={hasAllPermissions(selectedPermissionIds, allPermissionIds)}
            disabled={disabled || allPermissionIds.length === 0}
            onCheckedChange={(checked) => toggleAll(Boolean(checked))}
          />
          Chọn tất cả
        </label>
      </div>

      <div className="space-y-3">
        {groups.map((group) => {
          const groupIds = group.permissions.map((permission) => permission.id);
          const isExpanded = expandedResources[group.resource] ?? true;
          const isChecked = hasAllPermissions(selectedPermissionIds, groupIds);

          return (
            <div key={group.resource} className="rounded-2xl border border-border/70 bg-white/70">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() =>
                      setExpandedResources((current) => ({
                        ...current,
                        [group.resource]: !isExpanded
                      }))
                    }
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-primary">
                      {group.resource}
                    </p>
                    <p className="text-xs text-text-secondary">{group.permissions.length} quyền</p>
                  </div>
                </div>

                <label className="flex items-center gap-3 text-sm font-medium text-text-primary">
                  <Checkbox
                    checked={isChecked}
                    disabled={disabled || groupIds.length === 0}
                    onCheckedChange={(checked) => toggleGroup(group, Boolean(checked))}
                  />
                  Chọn tất cả
                </label>
              </div>

              {isExpanded ? (
                <div className="space-y-2 border-t border-border/60 px-5 py-4">
                  {group.permissions.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex items-center justify-between rounded-xl bg-bg-card/50 px-4 py-3 text-sm text-text-primary"
                    >
                      <span>{ACTION_LABELS[permission.action] ?? permission.action}</span>
                      <Checkbox
                        checked={selectedPermissionIds.includes(permission.id)}
                        disabled={disabled}
                        onCheckedChange={(checked) => togglePermission(permission.id, Boolean(checked))}
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
