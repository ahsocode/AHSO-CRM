"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildCsv, CsvRow, downloadCsv, parseCsv, readFileAsText } from "@/lib/csv";
import { cn } from "@/lib/utils";

export interface CsvColumnSpec<TInput> {
  /** CSV column header, shown to the user (e.g. "Tên khách hàng *"). */
  header: string;
  /** Whether this column is required (used for the template + simple pre-validation). */
  required?: boolean;
  /** Example value included in the downloaded template. */
  example?: string;
  /** Map the raw string cell into the typed input. Return undefined to skip, or throw to error. */
  transform: (value: string, row: CsvRow) => TInput[keyof TInput] | undefined;
  /** Target key on the API input object. */
  key: keyof TInput;
}

export interface CsvImportResultItem {
  rowIndex: number;
  status: "success" | "error";
  message?: string;
  displayName?: string;
}

export interface CsvImportDialogProps<TInput> {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  templateFilename: string;
  columns: CsvColumnSpec<TInput>[];
  /** Called once per parsed row. Should throw on failure so error is captured. */
  submitRow: (input: TInput, row: CsvRow, index: number) => Promise<{ displayName?: string }>;
  /** Called after all rows finish, regardless of success/fail. */
  onFinish?: (results: CsvImportResultItem[]) => void;
}

type Stage = "upload" | "preview" | "submitting" | "done";

export function CsvImportDialog<TInput>({
  open,
  onClose,
  title,
  description,
  templateFilename,
  columns,
  submitRow,
  onFinish
}: CsvImportDialogProps<TInput>) {
  const [stage, setStage] = useState<Stage>("upload");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [results, setResults] = useState<CsvImportResultItem[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setStage("upload");
      setRows([]);
      setParseError(null);
      setResults([]);
      setProgress({ done: 0, total: 0 });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  const headers = useMemo(() => columns.map((c) => c.header), [columns]);

  const handleDownloadTemplate = () => {
    const exampleRow = columns.reduce<Record<string, string>>((acc, col) => {
      acc[col.header] = col.example ?? "";
      return acc;
    }, {});
    const csv = buildCsv(headers, [exampleRow]);
    downloadCsv(templateFilename, csv);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setParseError(null);
    try {
      const text = await readFileAsText(file);
      const parsed = parseCsv(text);
      if (parsed.rows.length === 0) {
        setParseError("File CSV không có dòng dữ liệu nào.");
        return;
      }
      const missingHeaders = columns
        .filter((col) => col.required)
        .filter((col) => !parsed.headers.includes(col.header))
        .map((col) => col.header);

      if (missingHeaders.length > 0) {
        setParseError(`Thiếu cột bắt buộc: ${missingHeaders.join(", ")}`);
        return;
      }

      setRows(parsed.rows);
      setStage("preview");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Không đọc được file CSV.");
    }
  };

  const handleImport = async () => {
    setStage("submitting");
    setProgress({ done: 0, total: rows.length });
    const out: CsvImportResultItem[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const input = {} as TInput;
        for (const col of columns) {
          const raw = row[col.header] ?? "";
          const transformed = col.transform(raw, row);
          if (transformed !== undefined) {
            (input as Record<string, unknown>)[col.key as string] = transformed as unknown;
          }
        }
        const res = await submitRow(input, row, i);
        out.push({ rowIndex: i + 1, status: "success", displayName: res.displayName });
      } catch (err) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : "Lỗi không xác định");
        out.push({ rowIndex: i + 1, status: "error", message });
      }
      setProgress({ done: i + 1, total: rows.length });
      setResults([...out]);
    }

    setStage("done");
    onFinish?.(out);
  };

  if (!open) return null;

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={stage === "submitting" ? undefined : onClose}
      />
      <div className="relative z-10 flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-xl border border-border bg-bg-card shadow-xl">
        <div className="flex items-start justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={stage === "submitting"}
            className="rounded-md p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-50"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {stage === "upload" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-dashed border-border bg-bg-hover/30 p-5 text-sm">
                <p className="font-medium text-text-primary">Các bước:</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-text-secondary">
                  <li>Tải file mẫu CSV và điền dữ liệu theo đúng tiêu đề cột.</li>
                  <li>Cột có dấu <span className="font-semibold text-danger">*</span> là bắt buộc.</li>
                  <li>Lưu file dạng <code>.csv</code> (UTF-8) rồi upload lên.</li>
                </ol>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
                  Tải file mẫu CSV
                </Button>
                <input
                  ref={fileInputRef}
                  id="csv-file-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="csv-file-input"
                  className={cn(
                    "inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-bg-card px-4 text-sm font-medium text-text-primary hover:bg-bg-hover"
                  )}
                >
                  Chọn file CSV...
                </label>
              </div>

              {parseError && (
                <div className="rounded-md border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
                  {parseError}
                </div>
              )}

              <div className="rounded-lg border border-border/60 bg-white/60 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Cột trong file
                </p>
                <div className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
                  {columns.map((col) => (
                    <div key={col.header} className="flex items-center gap-2 text-text-primary">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          col.required ? "bg-danger" : "bg-text-muted"
                        )}
                      />
                      <span>{col.header}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stage === "preview" && (
            <div className="space-y-4">
              <div className="rounded-md border border-info/40 bg-info-bg px-4 py-3 text-sm text-info">
                Đã đọc được <span className="font-semibold">{rows.length}</span> dòng. Kiểm tra trước
                khi nhập vào hệ thống.
              </div>

              <div className="overflow-auto rounded-lg border border-border max-h-[40vh]">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-bg-hover sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                        #
                      </th>
                      {columns.map((col) => (
                        <th
                          key={col.header}
                          className="px-3 py-2 text-left text-xs font-semibold text-text-secondary whitespace-nowrap"
                        >
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((row, index) => (
                      <tr key={index} className="border-t border-border/60">
                        <td className="px-3 py-2 text-text-secondary">{index + 1}</td>
                        {columns.map((col) => (
                          <td key={col.header} className="px-3 py-2 text-text-primary">
                            {row[col.header] || <span className="text-text-muted">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <div className="border-t border-border/60 px-3 py-2 text-xs text-text-secondary">
                    Hiển thị 50/{rows.length} dòng đầu tiên trong preview.
                  </div>
                )}
              </div>
            </div>
          )}

          {(stage === "submitting" || stage === "done") && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm font-medium text-text-primary">
                  <span>
                    {stage === "submitting" ? "Đang nhập..." : "Hoàn tất"} — {progress.done}/
                    {progress.total}
                  </span>
                  <span className="text-text-secondary">
                    {successCount} thành công · {errorCount} lỗi
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-hover">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : "0%"
                    }}
                  />
                </div>
              </div>

              <div className="max-h-[45vh] overflow-auto rounded-lg border border-border">
                <ul className="divide-y divide-border/60 text-sm">
                  {results.map((item) => (
                    <li
                      key={item.rowIndex}
                      className={cn(
                        "flex items-start gap-3 px-3 py-2",
                        item.status === "error" ? "bg-danger-bg/40" : "bg-success-bg/40"
                      )}
                    >
                      <span className="w-10 flex-none text-text-secondary">#{item.rowIndex}</span>
                      <span
                        className={cn(
                          "flex-none text-xs font-semibold uppercase",
                          item.status === "error" ? "text-danger" : "text-success"
                        )}
                      >
                        {item.status === "error" ? "Lỗi" : "OK"}
                      </span>
                      <span className="flex-1 break-words text-text-primary">
                        {item.status === "error" ? item.message : item.displayName ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-bg-hover/30 px-6 py-4">
          {stage === "upload" && (
            <Button type="button" variant="outline" onClick={onClose}>
              Đóng
            </Button>
          )}
          {stage === "preview" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRows([]);
                  setStage("upload");
                  setParseError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Chọn file khác
              </Button>
              <Button type="button" onClick={handleImport}>
                Nhập {rows.length} dòng
              </Button>
            </>
          )}
          {stage === "submitting" && (
            <Button type="button" disabled>
              Đang xử lý...
            </Button>
          )}
          {stage === "done" && (
            <Button type="button" onClick={onClose}>
              Đóng
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
