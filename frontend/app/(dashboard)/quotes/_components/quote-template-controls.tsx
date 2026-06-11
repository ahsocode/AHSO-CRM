"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { QuoteFormValues } from "./form-schemas";

/**
 * Quote Template (MVP): lưu bộ hạng mục + điều khoản thành mẫu tái sử dụng.
 * Dự án tự động hóa thường có cấu trúc hạng mục giống nhau giữa các khách —
 * mẫu giúp không phải nhập lại từ đầu.
 *
 * Lưu ở localStorage theo máy/user (không cần migration backend). Khi cần
 * chia sẻ mẫu toàn team, nâng cấp lên model QuoteTemplate ở Phase sau.
 */
const STORAGE_KEY = "crm:quote-templates";
const MAX_TEMPLATES = 20;

interface QuoteTemplate {
  name: string;
  savedAt: string;
  items: QuoteFormValues["items"];
  terms?: string;
  deliveryTerms?: string;
}

function readTemplates(): QuoteTemplate[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as QuoteTemplate[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTemplates(templates: QuoteTemplate[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.slice(0, MAX_TEMPLATES)));
  } catch {
    // localStorage không khả dụng — bỏ qua, không chặn flow chính
  }
}

export function QuoteTemplateControls({
  disabled,
  getSnapshot,
  onApply,
}: {
  disabled?: boolean;
  /** Lấy items + điều khoản hiện tại từ form cha để lưu mẫu */
  getSnapshot: () => Pick<QuoteTemplate, "items" | "terms" | "deliveryTerms">;
  /** Áp mẫu vào form cha */
  onApply: (template: Pick<QuoteTemplate, "items" | "terms" | "deliveryTerms">) => void;
}) {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [selected, setSelected] = useState("");
  const { success, error: showError } = useToast();

  useEffect(() => {
    setTemplates(readTemplates());
  }, []);

  const saveTemplate = () => {
    const snapshot = getSnapshot();
    const validItems = snapshot.items.filter((item) => item.name.trim().length > 0);
    if (validItems.length === 0) {
      showError("Chưa có hạng mục nào để lưu làm mẫu.");
      return;
    }

    const name = window.prompt("Tên mẫu báo giá (vd: Tủ điện chuẩn 3 pha):")?.trim();
    if (!name) {
      return;
    }

    const next = [
      { name, savedAt: new Date().toISOString(), items: validItems, terms: snapshot.terms, deliveryTerms: snapshot.deliveryTerms },
      ...templates.filter((template) => template.name !== name)
    ];
    setTemplates(next);
    writeTemplates(next);
    success(`Đã lưu mẫu "${name}" (${validItems.length} hạng mục).`);
  };

  const applyTemplate = (name: string) => {
    setSelected(name);
    const template = templates.find((item) => item.name === name);
    if (!template) {
      return;
    }
    onApply(template);
    success(`Đã áp mẫu "${template.name}" — kiểm tra lại đơn giá trước khi gửi.`);
    setSelected("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {templates.length > 0 ? (
        <Select
          aria-label="Áp dụng mẫu báo giá"
          className="h-9 w-52 text-sm"
          value={selected}
          disabled={disabled}
          onChange={(event) => applyTemplate(event.target.value)}
        >
          <option value="">Từ mẫu có sẵn...</option>
          {templates.map((template) => (
            <option key={template.name} value={template.name}>
              {template.name} ({template.items.length} hạng mục)
            </option>
          ))}
        </Select>
      ) : null}
      <Button type="button" variant="ghost" disabled={disabled} onClick={saveTemplate}>
        Lưu làm mẫu
      </Button>
    </div>
  );
}
