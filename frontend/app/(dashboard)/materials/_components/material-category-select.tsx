import { Select } from "@/components/ui/select";
import { useMaterialCategories } from "@/hooks/use-materials";

export function MaterialCategorySelect({
  id,
  value,
  onChange,
  placeholder = "Tất cả nhóm",
  includeAll = true,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  includeAll?: boolean;
}) {
  const { data: categories = [], isLoading } = useMaterialCategories();

  return (
    <Select
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
