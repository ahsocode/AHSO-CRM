"use client";

import { forwardRef, useEffect, useId, useRef, useState, type CSSProperties, type InputHTMLAttributes } from "react";
import { ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface EntityOption {
  id: string;
  label: string;
  description?: string | null;
}

export interface EntityComboboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onSelect"> {
  value?: string | null;
  onChange: (value: string) => void;
  options: EntityOption[];
  selectedOption?: EntityOption | null;
  onSearchChange: (search: string) => void;
  isLoading?: boolean;
  selectedLoading?: boolean;
  errorMessage?: string | null;
  selectedErrorMessage?: string | null;
  clearLabel?: string;
}

/** A controlled ID selector whose search text never becomes the form value. */
export const EntityCombobox = forwardRef<HTMLInputElement, EntityComboboxProps>(function EntityCombobox({
  value, onChange, options, selectedOption, onSearchChange, isLoading, selectedLoading,
  errorMessage, selectedErrorMessage, clearLabel = "Xóa lựa chọn", disabled, readOnly, className, placeholder = "Tìm và chọn...", onFocus, onBlur, onKeyDown, onClick, ...inputProps
}, forwardedRef) {
  const generatedId = useId();
  const listId = `${generatedId}-options`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [popupStyle, setPopupStyle] = useState<CSSProperties | null>(null);
  const [listHeight, setListHeight] = useState(256);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [sentSearch, setSentSearch] = useState("");
  const [pickedOption, setPickedOption] = useState<EntityOption | null>(null);
  const busy = isLoading || search.trim() !== sentSearch;
  const selected = selectedOption?.id === value ? selectedOption : options.find((option) => option.id === value) ?? (pickedOption?.id === value ? pickedOption : null);
  const blocked = disabled || readOnly;

  useEffect(() => {
    const timer = setTimeout(() => { onSearchChange(search.trim()); setSentSearch(search.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [onSearchChange, search]);

  useEffect(() => setActiveIndex(-1), [options]);
  useEffect(() => {
    if (!open || blocked) return;
    function measure() {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const dialog = input.closest('[role="dialog"]');
      const bounds = dialog?.getBoundingClientRect();
      const below = Math.min(innerHeight, bounds?.bottom ?? innerHeight) - rect.bottom - 8;
      const above = rect.top - Math.max(0, bounds?.top ?? 0) - 8;
      const upwards = below < 180 && above > below;
      setListHeight(Math.max(60, Math.min(256, upwards ? above : below)));
      // A dialog's transform is a containing block; stay local there. Outside
      // dialogs, fixed placement escapes horizontal filter-toolbar clipping.
      setPopupStyle(dialog ? {
        position: "absolute", left: 0, width: "100%", minWidth: 200,
        ...(upwards ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" })
      } : {
        position: "fixed", left: Math.max(8, Math.min(rect.left, innerWidth - Math.max(200, rect.width) - 8)),
        width: Math.min(innerWidth - 16, Math.max(200, rect.width)),
        ...(upwards ? { bottom: innerHeight - rect.top + 4 } : { top: rect.bottom + 4 })
      });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, blocked]);
  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  function close() {
    setOpen(false);
    setSearch("");
    setActiveIndex(-1);
  }

  function pick(option: EntityOption) {
    setPickedOption(option);
    onChange(option.id);
    close();
  }

  return (
    <div className="relative min-w-0" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) close();
    }}>
      <Input
        {...inputProps}
        ref={(element) => {
          inputRef.current = element;
          if (typeof forwardedRef === "function") forwardedRef(element);
          else if (forwardedRef) forwardedRef.current = element;
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && !blocked}
        aria-controls={open && !blocked ? listId : undefined}
        aria-activedescendant={open && !blocked && !busy && options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        disabled={disabled}
        readOnly={readOnly}
        className={cn("pr-14", className)}
        placeholder={value && selectedLoading && !selected ? "Đang tải lựa chọn..." : placeholder}
        value={open ? search : selected?.label ?? ""}
        onFocus={(event) => {
          if (!blocked) setOpen(true);
          onFocus?.(event);
        }}
        onClick={(event) => {
          if (!blocked) setOpen(true);
          onClick?.(event);
        }}
        onBlur={onBlur}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            if (!blocked && !busy && open && activeIndex >= 0 && options[activeIndex]) pick(options[activeIndex]);
          } else if (!blocked && !busy && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setOpen(true);
            const delta = event.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((current) => options.length ? (current < 0 ? (delta > 0 ? 0 : options.length - 1) : (current + delta + options.length) % options.length) : -1);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
          onKeyDown?.(event);
        }}
      />
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
        {value && !blocked ? <button type="button" aria-label={clearLabel} className="pointer-events-auto rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary" onMouseDown={(event) => event.preventDefault()} onClick={() => {
          onChange("");
          setSearch("");
          inputRef.current?.focus();
        }}><X className="h-3.5 w-3.5" /></button> : null}
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-text-muted" />
      </div>
      {selectedErrorMessage && !open ? <p role="alert" className="mt-1 text-xs text-danger">{selectedErrorMessage}</p> : null}
      {open && !blocked && popupStyle ? (
        <div style={popupStyle} className="z-50 rounded-lg bg-bg-card p-1 shadow-lg ring-1 ring-border">
          <ul id={listId} role="listbox" aria-label={inputProps["aria-label"] ?? placeholder} className="overflow-y-auto" style={{ maxHeight: listHeight }}>
            {busy ? <li role="presentation" className="px-3 py-2 text-sm text-text-secondary">Đang tải...</li> : errorMessage ? <li role="presentation" className="px-3 py-2 text-sm text-danger">{errorMessage}</li> : options.length ? options.map((option, index) => (
              <li
                key={option.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.id === value}
                className={cn("cursor-pointer rounded-md px-3 py-2 text-sm", index === activeIndex ? "bg-primary-bg text-primary" : "text-text-primary hover:bg-bg-hover")}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(option)}
              >
                <p className="font-medium">{option.label}</p>
                {option.description ? <p className="mt-0.5 text-xs text-text-secondary">{option.description}</p> : null}
              </li>
            )) : <li role="presentation" className="px-3 py-2 text-sm text-text-secondary">Không có kết quả</li>}
          </ul>
        </div>
      ) : null}
    </div>
  );
});
