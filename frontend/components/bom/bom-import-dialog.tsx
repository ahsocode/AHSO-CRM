"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { COST_GROUP_LABELS } from "@/lib/constants";
import { emptyRow, type EditorRow } from "@/lib/bom-editor";
import {
  buildImportRows,
  guessHeaderRow,
  guessMapping,
  IMPORT_FIELDS,
  readImportWorkbook,
  type ImportField,
  type ImportMapping,
  type ImportParsedRow,
  type ImportSheet
} from "@/lib/bom-excel";
import { formatVND } from "@/lib/format";
import type { ApiResponse, MaterialSelectItem } from "@/lib/types";

const PREVIEW_ROWS = 20;
const LOOKUP_CONCURRENCY = 6;

type MaterialCache = Map<string, MaterialSelectItem | null>;

function codeKey(code: string) {
  return code.trim().toLowerCase();
}

/** Looks up Material.code (exact, case-insensitive) for codes not yet cached. */
async function resolveCodes(codes: string[], cache: MaterialCache): Promise<void> {
  const pending = Array.from(new Set(codes.map((code) => code.trim()).filter((code) => code && !cache.has(codeKey(code)))));
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const code = pending[cursor];
      cursor += 1;
      const response = await apiClient.get<ApiResponse<MaterialSelectItem[]>>("/materials/select", {
        params: { search: code }
      });
      const match = response.data.data.find((item) => codeKey(item.code) === codeKey(code)) ?? null;
      cache.set(codeKey(code), match);
    }
  }
  await Promise.all(Array.from({ length: Math.min(LOOKUP_CONCURRENCY, pending.length) }, worker));
}

function toEditorRow(parsed: ImportParsedRow, cache: MaterialCache): EditorRow {
  const material = parsed.code ? cache.get(codeKey(parsed.code)) : null;
  const row = emptyRow(parsed.group);
  const notes = [parsed.notes, parsed.code && !material ? `Mã gốc: ${parsed.code}` : ""].filter(Boolean).join(" · ");
  return {
    ...row,
    materialId: material?.id ?? null,
    materialCode: material?.code ?? null,
    name: parsed.name,
    specification: parsed.specification,
    unit: parsed.unit || material?.unit || "",
    quantity: String(parsed.quantity),
    estUnitCost: String(parsed.estUnitCost),
    notes
  };
}

export function BomImportDialog({
  open,
  onOpenChange,
  existingCount,
  onImport
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCount: number;
  onImport: (rows: EditorRow[], mode: "append" | "replace") => void;
}) {
  const [sheets, setSheets] = useState<ImportSheet[]>([]);
  const [fileName, setFileName] = useState("");
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);
  const cacheRef = useRef<MaterialCache>(new Map());

  useEffect(() => {
    if (!open) {
      setSheets([]);
      setFileName("");
      setSheetIndex(0);
      setHeaderRow(1);
      setMapping(null);
      setMode("append");
      setError(null);
      setIsReading(false);
      setIsImporting(false);
    }
  }, [open]);

  const sheet = sheets[sheetIndex];
  const headers = useMemo(() => sheet?.rows[headerRow - 1] ?? [], [sheet, headerRow]);

  const parsedRows = useMemo(
    () => (sheet && mapping ? buildImportRows(sheet.rows, headerRow - 1, mapping) : []),
    [sheet, headerRow, mapping]
  );
  const previewRows = parsedRows.slice(0, PREVIEW_ROWS);

  // Resolve codes of the previewed rows so the preview can show matched / unmatched
  const previewCodes = previewRows.map((row) => row.code).join("\u0000");
  useEffect(() => {
    if (!previewCodes) return;
    let cancelled = false;
    void resolveCodes(previewCodes.split("\u0000"), cacheRef.current).then(() => {
      if (!cancelled) setCacheVersion((value) => value + 1);
    }).catch((lookupError: unknown) => {
      if (!cancelled) setError(getApiErrorMessage(lookupError, "Không thể đối chiếu mã vật tư."));
    });
    return () => {
      cancelled = true;
    };
  }, [previewCodes]);

  function applySheet(nextSheets: ImportSheet[], index: number) {
    const target = nextSheets[index];
    const headerIndex = target ? guessHeaderRow(target.rows) : 0;
    setSheetIndex(index);
    setHeaderRow(headerIndex + 1);
    setMapping(target ? guessMapping(target.rows[headerIndex] ?? []) : null);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setIsReading(true);
    try {
      const loaded = await readImportWorkbook(file);
      if (loaded.length === 0) {
        setError("Tệp Excel không có trang tính nào.");
        return;
      }
      setSheets(loaded);
      setFileName(file.name);
      applySheet(loaded, 0);
    } catch {
      setError("Không đọc được tệp. Hãy chọn tệp Excel (.xlsx).");
    } finally {
      setIsReading(false);
    }
  }

  function handleHeaderRowChange(value: number) {
    const next = Math.max(1, Math.min(value || 1, sheet?.rows.length ?? 1));
    setHeaderRow(next);
    setMapping(guessMapping(sheet?.rows[next - 1] ?? []));
  }

  async function handleConfirm() {
    if (parsedRows.length === 0) return;
    if (parsedRows.length + (mode === "append" ? existingCount : 0) > 1000) {
      setError("BOM tối đa 1000 dòng. Hãy giảm số dòng hoặc chọn thay thế.");
      return;
    }
    setIsImporting(true);
    setError(null);
    try {
      await resolveCodes(
        parsedRows.map((row) => row.code),
        cacheRef.current
      );
      onImport(
        parsedRows.map((row) => toEditorRow(row, cacheRef.current)),
        mode
      );
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể nhập dữ liệu từ Excel."));
    } finally {
      setIsImporting(false);
    }
  }

  const nameMapped = Boolean(mapping && mapping.name >= 0);
  const matchedCount = previewRows.filter((row) => row.code && cacheRef.current.get(codeKey(row.code))).length;
  // cacheVersion is read so the preview re-renders once lookups finish
  void cacheVersion;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-labelledby="bom-import-title" className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle id="bom-import-title">Nhập BOM từ Excel</DialogTitle>
          <DialogDescription>
            Chọn tệp, kiểm tra việc ghép cột rồi xem trước {PREVIEW_ROWS} dòng đầu. Mã vật tư khớp danh mục sẽ được gắn
            tự động, không khớp sẽ thành dòng tự do.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="bom-import-file" className="text-sm font-semibold text-text-primary">
              Tệp Excel (.xlsx)
            </label>
            <Input
              id="bom-import-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => void handleFile(event.target.files?.[0])}
              className="h-auto py-2"
            />
            {isReading ? <p className="text-sm text-text-secondary">Đang đọc tệp...</p> : null}
            {fileName && !isReading ? <p className="text-xs text-text-secondary">Đã chọn: {fileName}</p> : null}
          </div>

          {sheet && mapping ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="bom-import-sheet" className="text-sm font-semibold text-text-primary">
                    Trang tính
                  </label>
                  <Select
                    id="bom-import-sheet"
                    value={sheetIndex}
                    onChange={(event) => applySheet(sheets, Number(event.target.value))}
                  >
                    {sheets.map((item, index) => (
                      <option key={item.name} value={index}>
                        {item.name} ({item.rows.length} dòng)
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="bom-import-header" className="text-sm font-semibold text-text-primary">
                    Dòng tiêu đề
                  </label>
                  <Input
                    id="bom-import-header"
                    type="number"
                    min={1}
                    value={headerRow}
                    onChange={(event) => handleHeaderRowChange(Number(event.target.value))}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-text-primary">Ghép cột</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {IMPORT_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label htmlFor={`bom-map-${field.key}`} className="text-xs font-semibold text-text-secondary">
                        {field.label}
                        {field.required ? <span className="ml-1 text-danger">*</span> : null}
                      </label>
                      <Select
                        id={`bom-map-${field.key}`}
                        value={mapping[field.key]}
                        onChange={(event) =>
                          setMapping({ ...mapping, [field.key as ImportField]: Number(event.target.value) })
                        }
                        className="h-9 text-sm"
                      >
                        <option value={-1}>— Bỏ qua —</option>
                        {headers.map((header, index) => (
                          <option key={index} value={index}>
                            {`Cột ${index + 1}${header ? `: ${header}` : ""}`}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
                {!nameMapped ? (
                  <p className="mt-2 text-sm text-danger">Cần ghép cột “Tên” để nhập dữ liệu.</p>
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-text-primary">
                  Xem trước ({previewRows.length}/{parsedRows.length} dòng · {matchedCount} dòng khớp mã vật tư)
                </p>
                <div className="overflow-x-auto rounded-md bg-bg-subtle">
                  <table className="min-w-full text-left text-xs">
                    <thead className="text-text-secondary">
                      <tr>
                        <th className="px-2 py-2">Dòng</th>
                        <th className="px-2 py-2">Nhóm</th>
                        <th className="px-2 py-2">Mã</th>
                        <th className="px-2 py-2">Tên</th>
                        <th className="px-2 py-2">ĐVT</th>
                        <th className="px-2 py-2 text-right">SL</th>
                        <th className="px-2 py-2 text-right">Đơn giá</th>
                        <th className="px-2 py-2">Khớp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => {
                        const match = row.code ? cacheRef.current.get(codeKey(row.code)) : null;
                        return (
                          <tr key={row.sourceRow} className={match ? "" : "bg-warning-bg/60"}>
                            <td className="px-2 py-1.5 text-text-muted">{row.sourceRow}</td>
                            <td className="px-2 py-1.5">{COST_GROUP_LABELS[row.group]}</td>
                            <td className="px-2 py-1.5 font-mono">{row.code || "—"}</td>
                            <td className="px-2 py-1.5">{row.name}</td>
                            <td className="px-2 py-1.5">{row.unit}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{row.quantity}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{formatVND(row.estUnitCost)}</td>
                            <td className="px-2 py-1.5">{match ? "Đã gắn mã" : "Dòng tự do"}</td>
                          </tr>
                        );
                      })}
                      {previewRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-2 py-4 text-center text-text-secondary">
                            Không có dòng dữ liệu hợp lệ. Kiểm tra lại dòng tiêu đề và cột “Tên”.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-text-primary">Cách thêm vào BOM</legend>
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="radio" name="bom-import-mode" checked={mode === "append"} onChange={() => setMode("append")} />
                  Nối thêm vào cuối BOM
                </label>
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input
                    type="radio"
                    name="bom-import-mode"
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                  />
                  Thay thế toàn bộ {existingCount} dòng hiện có
                </label>
              </fieldset>
            </>
          ) : null}

          {error ? <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{error}</div> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!nameMapped || parsedRows.length === 0 || isImporting}
            onClick={() => void handleConfirm()}
          >
            {isImporting ? "Đang nhập..." : `Thêm vào BOM (${parsedRows.length} dòng)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
