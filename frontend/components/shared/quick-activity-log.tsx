"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ActivityInput, useCreateActivity } from "@/hooks/use-activities";

const QUICK_TYPES: Array<{ value: ActivityInput["type"]; label: string }> = [
  { value: "CALL", label: "Cuộc gọi" },
  { value: "NOTE", label: "Ghi chú" },
  { value: "MEETING", label: "Họp" },
  { value: "EMAIL", label: "Email" },
  { value: "FOLLOWUP", label: "Theo dõi" },
];

interface QuickActivityLogProps {
  customerId?: string;
  projectId?: string;
}

/**
 * Ghi nhanh một tương tác (cuộc gọi, ghi chú...) ngay tại trang chi tiết —
 * không phải rời sang module Hoạt động và điền form đầy đủ.
 * Hoạt động được đánh dấu hoàn thành ngay (log việc đã xảy ra).
 */
export function QuickActivityLog({ customerId, projectId }: QuickActivityLogProps) {
  const [type, setType] = useState<ActivityInput["type"]>("CALL");
  const [content, setContent] = useState("");
  const createActivity = useCreateActivity();

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    const typeLabel = QUICK_TYPES.find((item) => item.value === type)?.label ?? "Hoạt động";
    createActivity.mutate(
      {
        type,
        title: `${typeLabel}: ${trimmed.slice(0, 80)}`,
        content: trimmed,
        customerId,
        projectId,
        isCompleted: true,
      },
      {
        onSuccess: () => setContent(""),
      }
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-bg-subtle p-3 sm:flex-row sm:items-center">
      <Select
        aria-label="Loại hoạt động"
        className="sm:w-36"
        value={type}
        onChange={(event) => setType(event.target.value as ActivityInput["type"])}
      >
        {QUICK_TYPES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </Select>
      <Input
        className="flex-1"
        placeholder="Ghi nhanh nội dung trao đổi với khách..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <Button
        type="button"
        disabled={createActivity.isPending || !content.trim()}
        onClick={submit}
      >
        {createActivity.isPending ? "Đang lưu..." : "Ghi lại"}
      </Button>
    </div>
  );
}
