"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/format";
import { CustomFieldDefinition, CustomFieldValues } from "@/lib/types";

function normalizeDate(value: unknown) {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.length >= 10 ? value.slice(0, 10) : value;
}

function renderReadonlyValue(field: CustomFieldDefinition, value: unknown) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-text-muted">Chưa nhập</span>;
  }

  if (field.type === "boolean") {
    return <span>{value ? "Có" : "Không"}</span>;
  }

  if (field.type === "multiselect" && Array.isArray(value)) {
    return <span>{value.join(", ") || "Chưa chọn"}</span>;
  }

  if (field.type === "date" && typeof value === "string") {
    return <span>{formatDate(value)}</span>;
  }

  return <span>{String(value)}</span>;
}

export function CustomFieldRenderer({
  fields,
  values,
  onChange,
  editable = false,
  emptyTitle = "Chưa có custom field",
  emptyDescription = "Hãy tạo custom field trong Admin để phần này hiển thị dữ liệu động."
}: {
  fields: CustomFieldDefinition[];
  values: CustomFieldValues;
  onChange?: (nextValues: CustomFieldValues) => void;
  editable?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (fields.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const handleValueChange = (name: string, nextValue: unknown) => {
    if (!onChange) {
      return;
    }

    onChange({
      ...values,
      [name]: nextValue
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((field) => {
        const value = values[field.name];

        return (
          <div key={field.id} className={editable ? "space-y-2" : "rounded-2xl border border-border/60 bg-white/80 p-4"}>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-text-primary">{field.label}</label>
              {field.required ? (
                <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-danger">
                  Bắt buộc
                </span>
              ) : null}
            </div>

            {editable ? (
              field.type === "select" ? (
                <Select
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) => handleValueChange(field.name, event.target.value)}
                >
                  <option value="">Chọn giá trị</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : field.type === "multiselect" ? (
                <Select
                  multiple
                  value={Array.isArray(value) ? (value as string[]) : []}
                  onChange={(event) => {
                    const nextValue = Array.from(event.target.selectedOptions).map((option) => option.value);
                    handleValueChange(field.name, nextValue);
                  }}
                  className="min-h-[120px]"
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : field.type === "boolean" ? (
                <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-white/80 px-4 py-3">
                  <Checkbox
                    checked={Boolean(value)}
                    onCheckedChange={(checked) => handleValueChange(field.name, Boolean(checked))}
                  />
                  <span className="text-sm text-text-secondary">Bật nếu trường này đúng với đối tượng hiện tại</span>
                </label>
              ) : field.type === "date" ? (
                <Input
                  type="date"
                  value={normalizeDate(value)}
                  onChange={(event) => handleValueChange(field.name, event.target.value)}
                />
              ) : field.type === "number" ? (
                <Input
                  type="number"
                  value={typeof value === "number" ? value : value ? Number(value) : ""}
                  onChange={(event) =>
                    handleValueChange(field.name, event.target.value === "" ? "" : Number(event.target.value))
                  }
                />
              ) : field.type === "text" && field.label.length > 28 ? (
                <Textarea
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) => handleValueChange(field.name, event.target.value)}
                  placeholder={`Nhập ${field.label.toLowerCase()}`}
                />
              ) : (
                <Input
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) => handleValueChange(field.name, event.target.value)}
                  placeholder={`Nhập ${field.label.toLowerCase()}`}
                />
              )
            ) : (
              <div className="text-sm text-text-secondary">{renderReadonlyValue(field, value)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
