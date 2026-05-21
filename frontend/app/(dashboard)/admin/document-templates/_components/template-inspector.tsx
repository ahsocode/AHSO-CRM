"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  TemplateBox,
  TemplateImageBox,
  TemplateKeyValueTableBox,
  TemplateBoxLibraryItem,
  TemplateLineItemsTableBox,
  TemplateSignatureBlockBox,
  TemplateTextBox,
  TemplateTokenGroup,
  TemplateValidationIssue
} from "@/lib/types";

type TextAlignment = "left" | "center" | "right" | "justify";
type HorizontalPosition = "left" | "center" | "right";
type VerticalPosition = "top" | "center" | "bottom";
type PanelTab = "add" | "tokens" | "settings";

const TEXT_ALIGNMENT_OPTIONS: Array<{
  value: TextAlignment;
  label: string;
  title: string;
}> = [
  { value: "left", label: "Căn trái", title: "Căn trái nội dung" },
  { value: "center", label: "Căn giữa", title: "Căn giữa nội dung" },
  { value: "right", label: "Căn phải", title: "Căn phải nội dung" },
  { value: "justify", label: "Căn đều", title: "Căn đều hai bên" }
];

const HORIZONTAL_POSITION_OPTIONS: Array<{
  value: HorizontalPosition;
  label: string;
  title: string;
}> = [
  { value: "left", label: "Căn trái", title: "Đặt nội dung về bên trái box" },
  { value: "center", label: "Căn giữa ngang", title: "Đặt nội dung vào giữa theo chiều ngang" },
  { value: "right", label: "Căn phải", title: "Đặt nội dung về bên phải box" }
];

const VERTICAL_POSITION_OPTIONS: Array<{
  value: VerticalPosition;
  label: string;
  title: string;
}> = [
  { value: "top", label: "Căn trên", title: "Đặt nội dung lên phía trên box" },
  { value: "center", label: "Căn giữa dọc", title: "Đặt nội dung vào giữa theo chiều dọc" },
  { value: "bottom", label: "Căn dưới", title: "Đặt nội dung xuống phía dưới box" }
];

interface TemplateInspectorProps {
  selectedBox?: TemplateBox;
  editable: boolean;
  boxLibrary: TemplateBoxLibraryItem[];
  tokenGroups: TemplateTokenGroup[];
  issues: TemplateValidationIssue[];
  onUpdateBox: (updater: (box: TemplateBox) => TemplateBox) => void;
  onDeleteBox: () => void;
  onAddBox: (box: TemplateBoxLibraryItem) => void;
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function LocalizedTextEditor({
  label,
  value,
  disabled,
  onChange
}: {
  label: string;
  value: { vi: string; viEn?: string };
  disabled: boolean;
  onChange: (next: { vi: string; viEn?: string }) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="space-y-1">
        <Label>{label} (VI)</Label>
        <Textarea
          rows={3}
          value={value.vi}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, vi: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>{label} (VI-EN)</Label>
        <Textarea
          rows={3}
          value={value.viEn ?? ""}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, viEn: event.target.value })}
        />
      </div>
    </div>
  );
}

function AlignIcon({ align }: { align: TextAlignment }) {
  const lines =
    align === "left"
      ? [
          { width: 16, x: 4 },
          { width: 12, x: 4 },
          { width: 14, x: 4 },
          { width: 10, x: 4 }
        ]
      : align === "center"
        ? [
            { width: 16, x: 4 },
            { width: 10, x: 7 },
            { width: 14, x: 5 },
            { width: 8, x: 8 }
          ]
        : align === "right"
          ? [
              { width: 16, x: 4 },
              { width: 12, x: 8 },
              { width: 14, x: 6 },
              { width: 10, x: 10 }
            ]
          : [
              { width: 16, x: 4 },
              { width: 16, x: 4 },
              { width: 16, x: 4 },
              { width: 16, x: 4 }
            ];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      {lines.map((line, index) => (
        <path key={`${align}-${index}`} d={`M${line.x} ${6 + index * 4}H${line.x + line.width}`} />
      ))}
    </svg>
  );
}

function PositionIcon({
  axis,
  align
}: {
  axis: "horizontal" | "vertical";
  align: HorizontalPosition | VerticalPosition;
}) {
  const lines =
    axis === "horizontal"
      ? align === "left"
        ? [
            { x1: 4, y: 7, x2: 16 },
            { x1: 4, y: 12, x2: 19 },
            { x1: 4, y: 17, x2: 15 }
          ]
        : align === "center"
          ? [
              { x1: 6, y: 7, x2: 18 },
              { x1: 4.5, y: 12, x2: 19.5 },
              { x1: 6.5, y: 17, x2: 17.5 }
            ]
          : [
              { x1: 8, y: 7, x2: 20 },
              { x1: 5, y: 12, x2: 20 },
              { x1: 9, y: 17, x2: 20 }
            ]
      : align === "top"
        ? [
            { x1: 5, y: 6, x2: 19 },
            { x1: 7, y: 10, x2: 17 },
            { x1: 6, y: 14, x2: 18 }
          ]
        : align === "center"
          ? [
              { x1: 5, y: 9, x2: 19 },
              { x1: 7, y: 13, x2: 17 },
              { x1: 6, y: 17, x2: 18 }
            ]
          : [
              { x1: 5, y: 12, x2: 19 },
              { x1: 7, y: 16, x2: 17 },
              { x1: 6, y: 20, x2: 18 }
            ];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      {lines.map((line, index) => (
        <path key={`${axis}-${align}-${index}`} d={`M${line.x1} ${line.y}H${line.x2}`} />
      ))}
    </svg>
  );
}

export function TemplateInspector({
  selectedBox,
  editable,
  boxLibrary,
  tokenGroups,
  issues,
  onUpdateBox,
  onDeleteBox,
  onAddBox
}: TemplateInspectorProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("add");

  // Auto-switch to settings tab when a box is selected
  useEffect(() => {
    if (selectedBox) {
      setActiveTab("settings");
    }
  }, [selectedBox?.id]);

  const selectedIssues = selectedBox
    ? issues.filter((issue) => issue.boxId === selectedBox.id)
    : [];
  const supportsPositionAlignment =
    selectedBox?.type === "text" || selectedBox?.type === "image";
  const supportsValueAlignment = selectedBox?.type === "key_value_table";
  const rawTextAlign = selectedBox?.style?.textAlign;
  const selectedHorizontalPosition: HorizontalPosition =
    rawTextAlign === "center" || rawTextAlign === "right"
      ? rawTextAlign
      : "left";
  const selectedVerticalPosition: VerticalPosition = selectedBox?.style?.verticalAlign ?? "top";
  const selectedAlignment: TextAlignment = rawTextAlign ?? "left";

  const tabs: Array<{ id: PanelTab; label: string; disabled?: boolean }> = [
    { id: "add", label: "Thêm" },
    { id: "tokens", label: "Tokens" },
    { id: "settings", label: "Cài đặt", disabled: !selectedBox },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Tab bar */}
      <div className="flex rounded-2xl border border-white/70 bg-white/90 p-1 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 rounded-xl py-2 text-xs font-semibold transition",
              "disabled:cursor-not-allowed disabled:opacity-40",
              activeTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Thêm */}
      {activeTab === "add" && (
        <section className="space-y-3 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-text-primary">Thư viện box</h3>
          <div className="grid gap-2">
            {boxLibrary.map((item) => (
              <Button
                key={item.type}
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => onAddBox(item)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </section>
      )}

      {/* Tab: Tokens */}
      {activeTab === "tokens" && (
        <section className="space-y-3 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-text-primary">Token catalog</h3>
          <p className="text-xs text-text-muted">Click vào token để copy vào clipboard.</p>
          <div className="space-y-3">
            {tokenGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.tokens.map((token) => (
                    <button
                      key={token.key}
                      type="button"
                      className="rounded-full border border-border bg-bg-hover px-3 py-1 text-xs font-medium text-text-secondary transition hover:border-primary/40 hover:text-primary"
                      title={token.description}
                      onClick={() => navigator.clipboard.writeText(`{{${token.key}}}`)}
                    >
                      {token.key}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab: Cài đặt */}
      {activeTab === "settings" && (
        <>
          {!selectedBox ? (
            <div className="rounded-[20px] border border-dashed border-border bg-bg-hover/40 px-4 py-8 text-center">
              <p className="text-sm font-medium text-text-secondary">Click vào một box trên canvas</p>
              <p className="mt-1 text-xs text-text-muted">để chỉnh sửa thuộc tính, kích thước và style</p>
            </div>
          ) : (
            <section className="space-y-4 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
              {/* Box header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{selectedBox.id}</p>
                  <p className="text-xs text-text-muted">{selectedBox.type}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!editable}
                  onClick={onDeleteBox}
                >
                  Xóa box
                </Button>
              </div>

              {/* Position & size */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>X (mm)</Label>
                  <Input
                    type="number"
                    value={selectedBox.x}
                    disabled={!editable}
                    onChange={(event) =>
                      onUpdateBox((box) => ({ ...box, x: numberValue(event.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Y (mm)</Label>
                  <Input
                    type="number"
                    value={selectedBox.y}
                    disabled={!editable}
                    onChange={(event) =>
                      onUpdateBox((box) => ({ ...box, y: numberValue(event.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Rộng (mm)</Label>
                  <Input
                    type="number"
                    value={selectedBox.width}
                    disabled={!editable}
                    onChange={(event) =>
                      onUpdateBox((box) => ({ ...box, width: numberValue(event.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cao (mm)</Label>
                  <Input
                    type="number"
                    value={selectedBox.height}
                    disabled={!editable}
                    onChange={(event) =>
                      onUpdateBox((box) => ({ ...box, height: numberValue(event.target.value) }))
                    }
                  />
                </div>
              </div>

              {/* Style */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Font size</Label>
                  <Input
                    type="number"
                    value={selectedBox.style?.fontSize ?? 10}
                    disabled={!editable}
                    onChange={(event) =>
                      onUpdateBox((box) => ({
                        ...box,
                        style: { ...box.style, fontSize: numberValue(event.target.value) }
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Padding</Label>
                  <Input
                    type="number"
                    value={selectedBox.style?.padding ?? 2}
                    disabled={!editable}
                    onChange={(event) =>
                      onUpdateBox((box) => ({
                        ...box,
                        style: { ...box.style, padding: numberValue(event.target.value) }
                      }))
                    }
                  />
                </div>
              </div>

              {/* Alignment controls */}
              {supportsPositionAlignment ? (
                <div className="space-y-2">
                  <Label>Căn vị trí nội dung</Label>
                  <div className="inline-grid grid-cols-3 gap-1 rounded-xl border border-border bg-bg-hover p-1">
                    {VERTICAL_POSITION_OPTIONS.map((option) => {
                      const isActive = selectedVerticalPosition === option.value;
                      return (
                        <button
                          key={`vertical-${option.value}`}
                          type="button"
                          title={option.title}
                          aria-label={option.label}
                          disabled={!editable}
                          className={cn(
                            "inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition",
                            "hover:bg-white hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50",
                            isActive && "bg-white text-primary shadow-sm"
                          )}
                          onClick={() =>
                            onUpdateBox((box) => ({
                              ...box,
                              style: { ...box.style, verticalAlign: option.value }
                            }))
                          }
                        >
                          <PositionIcon axis="vertical" align={option.value} />
                        </button>
                      );
                    })}
                    {HORIZONTAL_POSITION_OPTIONS.map((option) => {
                      const isActive = selectedHorizontalPosition === option.value;
                      return (
                        <button
                          key={`horizontal-${option.value}`}
                          type="button"
                          title={option.title}
                          aria-label={option.label}
                          disabled={!editable}
                          className={cn(
                            "inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition",
                            "hover:bg-white hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50",
                            isActive && "bg-white text-primary shadow-sm"
                          )}
                          onClick={() =>
                            onUpdateBox((box) => ({
                              ...box,
                              style: { ...box.style, textAlign: option.value }
                            }))
                          }
                        >
                          <PositionIcon axis="horizontal" align={option.value} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {supportsValueAlignment ? (
                <div className="space-y-2">
                  <Label>Căn giá trị trong bảng</Label>
                  <div className="inline-flex rounded-xl border border-border bg-bg-hover p-1">
                    {TEXT_ALIGNMENT_OPTIONS.map((option) => {
                      const isActive = selectedAlignment === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          title={option.title}
                          aria-label={option.label}
                          disabled={!editable}
                          className={cn(
                            "inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition",
                            "hover:bg-white hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50",
                            isActive && "bg-white text-primary shadow-sm"
                          )}
                          onClick={() =>
                            onUpdateBox((box) => ({
                              ...box,
                              style: { ...box.style, textAlign: option.value }
                            }))
                          }
                        >
                          <AlignIcon align={option.value} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Box-type-specific content editors */}
              {selectedBox.type === "text" ? (
                <LocalizedTextEditor
                  label="Nội dung"
                  value={selectedBox.content.text}
                  disabled={!editable}
                  onChange={(next) =>
                    onUpdateBox((box) => {
                      const current = box as TemplateTextBox;
                      return { ...current, content: { text: next } };
                    })
                  }
                />
              ) : null}

              {selectedBox.type === "image" ? (
                <div className="space-y-1">
                  <Label>Src token / URL</Label>
                  <Input
                    value={selectedBox.content.src}
                    disabled={!editable}
                    onChange={(event) =>
                      onUpdateBox((box) => {
                        const current = box as TemplateImageBox;
                        return {
                          ...current,
                          content: { ...current.content, src: event.target.value }
                        };
                      })
                    }
                  />
                </div>
              ) : null}

              {selectedBox.type === "key_value_table" ? (
                <div className="space-y-3">
                  {selectedBox.content.rows.map((row) => (
                    <div key={row.id} className="space-y-2 rounded-xl border border-border/70 p-3">
                      <LocalizedTextEditor
                        label="Label"
                        value={row.label}
                        disabled={!editable}
                        onChange={(next) =>
                          onUpdateBox((box) => {
                            const current = box as TemplateKeyValueTableBox;
                            return {
                              ...current,
                              content: {
                                ...current.content,
                                rows: current.content.rows.map((r) =>
                                  r.id === row.id ? { ...r, label: next } : r
                                )
                              }
                            };
                          })
                        }
                      />
                      <div className="space-y-1">
                        <Label>Value token</Label>
                        <Input
                          value={row.value}
                          disabled={!editable}
                          onChange={(event) =>
                            onUpdateBox((box) => {
                              const current = box as TemplateKeyValueTableBox;
                              return {
                                ...current,
                                content: {
                                  ...current.content,
                                  rows: current.content.rows.map((r) =>
                                    r.id === row.id ? { ...r, value: event.target.value } : r
                                  )
                                }
                              };
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedBox.type === "line_items_table" ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Nguồn dữ liệu</Label>
                    <Input
                      value={selectedBox.content.source}
                      disabled={!editable}
                      onChange={(event) =>
                        onUpdateBox((box) => {
                          const current = box as TemplateLineItemsTableBox;
                          return {
                            ...current,
                            content: { ...current.content, source: event.target.value }
                          };
                        })
                      }
                    />
                  </div>

                  {selectedBox.content.columns.map((column, colIndex) => (
                    <div key={column.id} className="space-y-2 rounded-xl border border-border/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-text-muted">Cột {colIndex + 1}</span>
                        {editable ? (
                          <button
                            type="button"
                            className="rounded px-1.5 py-0.5 text-xs text-danger hover:bg-danger-bg"
                            onClick={() =>
                              onUpdateBox((box) => {
                                const current = box as TemplateLineItemsTableBox;
                                return {
                                  ...current,
                                  content: {
                                    ...current.content,
                                    columns: current.content.columns.filter((c) => c.id !== column.id)
                                  }
                                };
                              })
                            }
                          >
                            Xóa cột
                          </button>
                        ) : null}
                      </div>
                      <LocalizedTextEditor
                        label="Tiêu đề cột"
                        value={column.label}
                        disabled={!editable}
                        onChange={(next) =>
                          onUpdateBox((box) => {
                            const current = box as TemplateLineItemsTableBox;
                            return {
                              ...current,
                              content: {
                                ...current.content,
                                columns: current.content.columns.map((c) =>
                                  c.id === column.id ? { ...c, label: next } : c
                                )
                              }
                            };
                          })
                        }
                      />
                      <div className="space-y-1">
                        <Label>Value token</Label>
                        <Input
                          value={column.value}
                          disabled={!editable}
                          onChange={(event) =>
                            onUpdateBox((box) => {
                              const current = box as TemplateLineItemsTableBox;
                              return {
                                ...current,
                                content: {
                                  ...current.content,
                                  columns: current.content.columns.map((c) =>
                                    c.id === column.id ? { ...c, value: event.target.value } : c
                                  )
                                }
                              };
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}

                  {editable ? (
                    <button
                      type="button"
                      className="w-full rounded-xl border border-dashed border-border py-2 text-xs font-semibold text-text-secondary transition hover:border-primary/50 hover:text-primary"
                      onClick={() =>
                        onUpdateBox((box) => {
                          const current = box as TemplateLineItemsTableBox;
                          const newId = `col-${Date.now()}`;
                          return {
                            ...current,
                            content: {
                              ...current.content,
                              columns: [
                                ...current.content.columns,
                                {
                                  id: newId,
                                  label: { vi: "Cột mới", viEn: "New Column" },
                                  value: "{{}}",
                                  align: "left" as const
                                }
                              ]
                            }
                          };
                        })
                      }
                    >
                      + Thêm cột
                    </button>
                  ) : null}
                </div>
              ) : null}

              {selectedBox.type === "signature_block" ? (
                <div className="space-y-3">
                  <LocalizedTextEditor
                    label="Tiêu đề bên trái"
                    value={selectedBox.content.leftTitle}
                    disabled={!editable}
                    onChange={(next) =>
                      onUpdateBox((box) => {
                        const current = box as TemplateSignatureBlockBox;
                        return { ...current, content: { ...current.content, leftTitle: next } };
                      })
                    }
                  />
                  <LocalizedTextEditor
                    label="Tiêu đề bên phải"
                    value={selectedBox.content.rightTitle}
                    disabled={!editable}
                    onChange={(next) =>
                      onUpdateBox((box) => {
                        const current = box as TemplateSignatureBlockBox;
                        return { ...current, content: { ...current.content, rightTitle: next } };
                      })
                    }
                  />
                </div>
              ) : null}

              {selectedIssues.length > 0 ? (
                <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-sm font-semibold text-rose-700">Lỗi trên box này</p>
                  <ul className="space-y-1 text-sm text-rose-700">
                    {selectedIssues.map((issue, index) => (
                      <li key={`${issue.code}-${index}`}>{issue.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          )}
        </>
      )}
    </div>
  );
}
