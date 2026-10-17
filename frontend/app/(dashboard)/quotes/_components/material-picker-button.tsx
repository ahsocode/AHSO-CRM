"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMaterialsSelect } from "@/hooks/use-materials";

export type PickedMaterial = { id: string; name: string; unit: string; salePrice: number; code: string };

export function MaterialPickerButton({
  onSelect
}: {
  onSelect: (material: PickedMaterial) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: materials, isLoading } = useMaterialsSelect(debouncedSearch || undefined);

  return (
    <div className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        className="h-9 w-9 px-0"
        onClick={() => setOpen((v) => !v)}
        title="Tìm vật tư"
        aria-label="Tìm vật tư"
      >
        <AppIcon name="search" className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-white shadow-lg">
            <div className="p-2">
              <Input
                autoFocus
                placeholder="Tìm mã hoặc tên vật tư..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {isLoading ? (
                <p className="px-4 py-3 text-sm text-text-secondary">Đang tải...</p>
              ) : !materials?.length ? (
                <p className="px-4 py-3 text-sm text-text-secondary">Không tìm thấy vật tư phù hợp.</p>
              ) : (
                materials.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-primary-bg"
                    onClick={() => {
                      onSelect(m as PickedMaterial);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="font-mono text-xs text-text-muted">{(m as { code: string }).code}</span>
                    <span className="flex-1 truncate text-text-primary">{m.name}</span>
                    <span className="shrink-0 text-xs text-text-secondary">{m.unit}</span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border p-2">
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs"
                onClick={() => { setOpen(false); setSearch(""); }}
              >
                Đóng
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
