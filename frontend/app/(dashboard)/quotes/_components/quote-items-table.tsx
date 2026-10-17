"use client";

import { useEffect, useState } from "react";
import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Copy, FileText, GripVertical, MoreHorizontal, Trash2 } from "lucide-react";
import { AppIcon } from "@/components/shared/app-icon";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createEmptyQuoteItem, type QuoteFormValues } from "./form-schemas";
import { MaterialPickerButton } from "./material-picker-button";

const ROW_GRID =
  "grid grid-cols-[20px_28px_minmax(0,1fr)_64px_64px_112px_112px_32px] items-center gap-1.5";

const NUMBER_INPUT_CLASS =
  "h-9 px-2 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// Drag-and-drop shell for each line item — renders only the sortable wrapper,
// exposes drag handle props via render-prop so inner content stays unchanged.
function SortableItemShell({
  id,
  disabled,
  children
}: {
  id: string;
  disabled?: boolean;
  children: (handleProps: React.HTMLAttributes<HTMLElement>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      className={isDragging ? "relative z-50 bg-bg-card opacity-40" : undefined}
    >
      {children(listeners ?? {})}
    </div>
  );
}

function readOnlyClass(editable: boolean) {
  return editable ? "" : "border-transparent bg-transparent focus:border-transparent focus:ring-0";
}

export function QuoteItemsTable({
  form,
  itemsFieldArray,
  isEditable,
  items,
  subtotal,
  taxRate,
  taxAmount,
  grandTotal
}: {
  form: UseFormReturn<QuoteFormValues>;
  itemsFieldArray: UseFieldArrayReturn<QuoteFormValues, "items">;
  isEditable: boolean;
  items: QuoteFormValues["items"];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
}) {
  const { fields, append, remove, insert, move } = itemsFieldArray;
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(() => new Set());
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.id === active.id);
    const to = fields.findIndex((f) => f.id === over.id);
    if (from !== -1 && to !== -1) move(from, to);
  }

  // Focus the name input of a freshly appended row once it has rendered and registered.
  useEffect(() => {
    if (pendingFocusIndex === null || pendingFocusIndex >= fields.length) return;
    form.setFocus(`items.${pendingFocusIndex}.name`);
    setPendingFocusIndex(null);
  }, [fields.length, form, pendingFocusIndex]);

  function expandDescription(id: string) {
    setExpandedDescriptions((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function appendRow() {
    append(createEmptyQuoteItem());
    setPendingFocusIndex(fields.length);
  }

  function duplicateRow(index: number) {
    const source = form.getValues(`items.${index}`);
    insert(index + 1, { ...source });
  }

  return (
    <div className="space-y-3">
      <div>
        <div
          className={cn(
            ROW_GRID,
            "rounded-md bg-bg-subtle px-2 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary"
          )}
        >
          <span />
          <span>#</span>
          <span>Tên hạng mục</span>
          <span>ĐVT</span>
          <span className="text-right">SL</span>
          <span className="text-right">Đơn giá</span>
          <span className="text-right">Thành tiền</span>
          <span />
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {fields.map((field, index) => {
              const errors = form.formState.errors.items?.[index];
              const rowDescription = items[index]?.description;
              const showDescription =
                expandedDescriptions.has(field.id) || (typeof rowDescription === "string" && rowDescription.length > 0);
              const rowTotal = Math.round(
                (Number(items[index]?.quantity) || 0) * (Number(items[index]?.unitPrice) || 0)
              );
              const isLast = index === fields.length - 1;
              const rowError =
                errors?.name?.message ??
                errors?.unit?.message ??
                errors?.quantity?.message ??
                errors?.unitPrice?.message ??
                errors?.description?.message;

              return (
                <SortableItemShell key={field.id} id={field.id} disabled={!isEditable}>
                  {(dragHandleProps) => (
                    <div className="border-b border-border-light px-2 py-1.5">
                      <div className={cn(ROW_GRID, "min-h-[40px]")}>
                        {isEditable ? (
                          <div
                            {...dragHandleProps}
                            className="cursor-grab rounded p-0.5 text-text-muted hover:bg-bg-hover hover:text-text-secondary active:cursor-grabbing"
                            title="Kéo để sắp xếp"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                        ) : (
                          <span />
                        )}
                        <span className="text-sm tabular-nums text-text-secondary">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <div className="flex min-w-0 items-center gap-1.5">
                          <Input
                            id={`items.${index}.name`}
                            aria-label={`Tên hạng mục ${index + 1}`}
                            placeholder="Tên hạng mục"
                            readOnly={!isEditable}
                            className={cn("h-9 min-w-0 flex-1 px-2", readOnlyClass(isEditable))}
                            {...form.register(`items.${index}.name`)}
                          />
                          {isEditable && (
                            <MaterialPickerButton
                              onSelect={(material) => {
                                form.setValue(`items.${index}.name`, material.name);
                                form.setValue(`items.${index}.unit`, material.unit);
                                form.setValue(`items.${index}.unitPrice`, material.salePrice);
                              }}
                            />
                          )}
                        </div>

                        <Input
                          id={`items.${index}.unit`}
                          aria-label={`Đơn vị tính ${index + 1}`}
                          placeholder="Bộ"
                          readOnly={!isEditable}
                          className={cn("h-9 px-2", readOnlyClass(isEditable))}
                          {...form.register(`items.${index}.unit`)}
                        />

                        <Input
                          id={`items.${index}.quantity`}
                          aria-label={`Số lượng ${index + 1}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          readOnly={!isEditable}
                          className={cn(NUMBER_INPUT_CLASS, readOnlyClass(isEditable))}
                          {...form.register(`items.${index}.quantity`, {
                            setValueAs: (value) => (value === "" ? 0 : Number(value))
                          })}
                        />

                        <Input
                          id={`items.${index}.unitPrice`}
                          aria-label={`Đơn giá ${index + 1}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="1"
                          readOnly={!isEditable}
                          className={cn(NUMBER_INPUT_CLASS, readOnlyClass(isEditable))}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            // Enter on a price cell must not submit the whole quote.
                            event.preventDefault();
                            if (isEditable && isLast) appendRow();
                          }}
                          {...form.register(`items.${index}.unitPrice`, {
                            setValueAs: (value) => (value === "" ? 0 : Number(value))
                          })}
                        />

                        <div className="text-right text-sm font-semibold tabular-nums text-text-primary">
                          <CurrencyDisplay amount={rowTotal} />
                        </div>

                        {isEditable ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-8 w-8 px-0"
                                aria-label={`Thao tác dòng ${index + 1}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => expandDescription(field.id)}>
                                <FileText className="mr-2 h-4 w-4" />
                                Thêm mô tả
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => duplicateRow(index)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Nhân bản dòng
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={fields.length === 1}
                                onSelect={() => remove(index)}
                                className="text-danger"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Xóa dòng
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span />
                        )}
                      </div>

                      {showDescription ? (
                        <div className="mt-1.5 pl-[52px] pr-9">
                          <Textarea
                            id={`items.${index}.description`}
                            aria-label={`Mô tả hạng mục ${index + 1}`}
                            placeholder="Quy cách, phạm vi, model, thông số kỹ thuật..."
                            rows={2}
                            readOnly={!isEditable}
                            className={cn("text-sm", readOnlyClass(isEditable))}
                            {...form.register(`items.${index}.description`)}
                            onFocus={() => expandDescription(field.id)}
                          />
                        </div>
                      ) : null}

                      {rowError ? <p className="mt-1 pl-[52px] text-sm text-danger">{rowError}</p> : null}
                    </div>
                  )}
                </SortableItemShell>
              );
            })}
          </SortableContext>
        </DndContext>

        <div className="mt-2 space-y-1 rounded-md bg-bg-subtle px-3 py-3 text-sm">
          <div className="flex items-center justify-between text-text-secondary">
            <span>Tạm tính</span>
            <span className="tabular-nums text-text-primary">
              <CurrencyDisplay amount={subtotal} />
            </span>
          </div>
          <div className="flex items-center justify-between text-text-secondary">
            <span>VAT {taxRate}%</span>
            <span className="tabular-nums text-text-primary">
              <CurrencyDisplay amount={taxAmount} />
            </span>
          </div>
          <div className="flex items-center justify-between font-bold text-text-primary">
            <span>Tổng cộng</span>
            <span className="tabular-nums">
              <CurrencyDisplay amount={grandTotal} />
            </span>
          </div>
        </div>
      </div>

      {isEditable ? (
        <Button onClick={appendRow} type="button" variant="outline">
          <AppIcon name="plus" className="h-4 w-4" />
          Thêm hạng mục
        </Button>
      ) : null}
    </div>
  );
}
