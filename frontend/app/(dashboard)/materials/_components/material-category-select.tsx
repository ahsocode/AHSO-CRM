import { Select } from "@/components/ui/select";
import { useMaterialCategories } from "@/hooks/use-materials";

export function MaterialCategorySelect({
  className,
  id,
  value,
  onChange,
  placeholder = "Tất cả nhóm",
  includeAll = true,
}: {
  className?: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  includeAll?: boolean;
}) {
  const { data: categories = [], isLoading } = useMaterialCategories();

  return (
    <Select
      className={className}
      id={id}
      value={value}
      disabled={isLoading}
      onChange={(e) => onChange(e.target.value)}
    >
      {includeAll ? <option value="">{placeholder}</option> : null}
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.name}
        </option>
      ))}
    </Select>
  );
}
