"use client";

import { useState } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useCreatePolicyItem,
  useDeletePolicyItem,
  usePolicyItems,
  useUpdatePolicyItem
} from "@/hooks/use-settings";
import { getApiErrorMessage } from "@/lib/api-client";
import { PolicyItem, PolicyItemType } from "@/lib/types";

function ItemRow({
  item,
  onDeleted
}: {
  item: PolicyItem;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [content, setContent] = useState(item.content);
  const updateMutation = useUpdatePolicyItem(item.id);
  const deleteMutation = useDeletePolicyItem();
  const { error, success } = useToast();

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ name: name.trim(), content: content.trim() });
      success("Đã lưu");
      setEditing(false);
    } catch (e) {
      error(getApiErrorMessage(e, "Không thể lưu"));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(item.id);
      onDeleted();
    } catch (e) {
      error(getApiErrorMessage(e, "Không thể xoá"));
    }
  };

  if (editing) {
    return (
      <div className="space-y-2 rounded-xl border border-primary/20 bg-primary-bg/30 p-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên mục"
          className="h-8 text-sm"
        />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="Nội dung điều khoản"
          className="text-sm"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending || !name.trim() || !content.trim()}>
            {updateMutation.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(item.name); setContent(item.content); }}>
            Huỷ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border-light bg-white px-3 py-3 hover:border-border transition">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">{item.name}</p>
        <p className="mt-0.5 text-xs text-text-secondary line-clamp-2 whitespace-pre-wrap">{item.content}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-hover hover:text-primary"
          title="Sửa"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="rounded-lg p-1.5 text-text-secondary hover:bg-danger-bg hover:text-danger disabled:opacity-50"
          title="Xoá"
        >
          <AppIcon name="delete" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function AddItemForm({
  type,
  onAdded
}: {
  type: PolicyItemType;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const createMutation = useCreatePolicyItem();
  const { error, success } = useToast();

  const handleSubmit = async () => {
    try {
      await createMutation.mutateAsync({ type, name: name.trim(), content: content.trim() });
      success("Đã thêm");
      setName("");
      setContent("");
      setOpen(false);
      onAdded();
    } catch (e) {
      error(getApiErrorMessage(e, "Không thể thêm"));
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-text-secondary hover:border-primary/40 hover:text-primary transition"
      >
        <AppIcon name="plus" className="h-4 w-4" />
        Thêm mục mới
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-primary/20 bg-primary-bg/30 p-3">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên mục (ngắn gọn, dễ nhận ra)"
        className="h-8 text-sm"
      />
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Nội dung điều khoản đầy đủ..."
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending || !name.trim() || !content.trim()}>
          {createMutation.isPending ? "Đang thêm..." : "Thêm"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setName(""); setContent(""); }}>
          Huỷ
        </Button>
      </div>
    </div>
  );
}

export function PolicyItemList({
  type,
  title
}: {
  type: PolicyItemType;
  title: string;
}) {
  const query = usePolicyItems(type);
  const items = query.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <span className="text-xs text-text-muted">{items.length} mục</span>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-bg-hover" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-bg-subtle px-3 py-3 text-sm text-text-muted">
          Chưa có mục nào. Thêm mục đầu tiên bên dưới.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} onDeleted={() => {}} />
          ))}
        </div>
      )}

      <AddItemForm type={type} onAdded={() => {}} />
    </div>
  );
}
