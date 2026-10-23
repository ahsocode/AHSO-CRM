"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { useBomModels } from "@/hooks/use-boms";
import { useMaterialsSelect } from "@/hooks/use-materials";
import { MATERIAL_KIND_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatVND } from "@/lib/format";
import type { MaterialSelectItem } from "@/lib/types";
import type { BomListItem } from "@/types/bom";

type PickerTab = "material" | "child";

function useDebounced(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function BomPicker({
  anchor,
  hasLink,
  onPickMaterial,
  onPickChild,
  onClear,
  onClose
}: {
  anchor: DOMRect;
  hasLink: boolean;
  onPickMaterial: (material: MaterialSelectItem) => void;
  onPickChild: (bom: BomListItem) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<PickerTab>("material");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const materialsQuery = useMaterialsSelect(debounced || undefined);
  const modelsQuery = useBomModels({ search: debounced || undefined, status: "APPROVED", limit: 30 }, tab === "child");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const openUp = typeof window !== "undefined" && anchor.bottom + 340 > window.innerHeight;
  const style = {
    left: Math.max(8, Math.min(anchor.left, (typeof window !== "undefined" ? window.innerWidth : 1200) - 360)),
    ...(openUp ? { bottom: window.innerHeight - anchor.top + 4 } : { top: anchor.bottom + 4 })
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Chọn vật tư hoặc cụm"
        className="fixed z-50 w-[350px] rounded-xl bg-bg-card shadow-lg ring-1 ring-black/5"
        style={style}
      >
        <div className="flex gap-1 p-2">
          {(
            [
              ["material", "Vật tư"],
              ["child", "Cụm (mẫu máy)"]
            ] as Array<[PickerTab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold",
                tab === key ? "bg-primary text-white" : "bg-bg-subtle text-text-secondary hover:bg-bg-hover"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="px-2 pb-2">
          <Input
            autoFocus
            aria-label="Tìm vật tư"
            placeholder={tab === "material" ? "Tìm mã hoặc tên vật tư..." : "Tìm mẫu máy đã duyệt..."}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="max-h-60 overflow-y-auto">
          {tab === "material" ? (
            materialsQuery.isLoading ? (
              <p className="px-4 py-3 text-sm text-text-secondary">Đang tải...</p>
            ) : !materialsQuery.data?.length ? (
              <p className="px-4 py-3 text-sm text-text-secondary">Không tìm thấy vật tư phù hợp.</p>
            ) : (
              materialsQuery.data.slice(0, 60).map((material) => (
                <button
                  key={material.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-primary-bg"
                  onClick={() => onPickMaterial(material)}
                >
                  <span className="shrink-0 font-mono text-xs text-text-muted">{material.code}</span>
                  <span className="flex-1 truncate text-text-primary">{material.name}</span>
                  <span className="shrink-0 text-[11px] text-text-secondary">
                    {MATERIAL_KIND_LABELS[material.kind] ?? ""}
                  </span>
                </button>
              ))
            )
          ) : modelsQuery.isLoading ? (
            <p className="px-4 py-3 text-sm text-text-secondary">Đang tải...</p>
          ) : !modelsQuery.data?.length ? (
            <p className="px-4 py-3 text-sm text-text-secondary">Chưa có mẫu máy đã duyệt phù hợp.</p>
          ) : (
            modelsQuery.data.map((bom) => (
              <button
                key={bom.id}
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-primary-bg"
                onClick={() => onPickChild(bom)}
              >
                <span className="shrink-0 font-mono text-xs text-text-muted">
                  {bom.code} · v{bom.version}
                </span>
                <span className="flex-1 truncate text-text-primary">{bom.product?.name ?? bom.name}</span>
                <span className="shrink-0 text-[11px] text-text-secondary">{formatVND(bom.total)}</span>
              </button>
            ))
          )}
        </div>
        {hasLink ? (
          <div className="p-2">
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-md bg-bg-subtle px-3 py-1.5 text-xs font-semibold text-danger hover:bg-bg-hover"
            >
              Bỏ gắn mã vật tư
            </button>
          </div>
        ) : null}
      </div>
    </>,
    document.body
  );
}

/** Material code cell: shows the linked code (or a warning hint) and opens a searchable picker on click. */
export function BomMaterialCell({
  id,
  materialCode,
  childLabel,
  readOnly,
  onPickMaterial,
  onPickChild,
  onClear
}: {
  id: string;
  materialCode: string | null;
  childLabel: string | null;
  readOnly: boolean;
  onPickMaterial: (material: MaterialSelectItem) => void;
  onPickChild: (bom: BomListItem) => void;
  onClear: () => void;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const linked = Boolean(materialCode || childLabel);

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={readOnly}
        aria-label="Chọn mã vật tư"
        onClick={() => setAnchor(buttonRef.current?.getBoundingClientRect() ?? null)}
        className={cn(
          "h-9 w-full truncate rounded-md px-2 text-left text-sm",
          linked ? "font-mono text-text-primary" : "text-xs italic text-warning",
          readOnly ? "cursor-default" : "bg-bg-subtle hover:bg-primary-bg"
        )}
        title={childLabel ? "Cụm (BOM con)" : linked ? "Đã gắn mã vật tư" : "Chưa gắn mã vật tư"}
      >
        {childLabel ? `Cụm ${childLabel}` : (materialCode ?? "Chưa gắn mã vật tư")}
      </button>
      {anchor ? (
        <BomPicker
          anchor={anchor}
          hasLink={linked}
          onClose={() => setAnchor(null)}
          onClear={() => {
            onClear();
            setAnchor(null);
          }}
          onPickMaterial={(material) => {
            onPickMaterial(material);
            setAnchor(null);
          }}
          onPickChild={(bom) => {
            onPickChild(bom);
            setAnchor(null);
          }}
        />
      ) : null}
    </>
  );
}
