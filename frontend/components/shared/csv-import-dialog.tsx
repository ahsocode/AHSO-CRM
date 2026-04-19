"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildCsv, CsvRow, downloadCsv, parseCsv, readFileAsText } from "@/lib/csv";
import { cn } from "@/lib/utils";

export interface CsvColumnSpec<TInput> {
  header: string;
  required?: boolean;
  example?: string;
  transform: (value: string, row: CsvRow) => TInput[keyof TInput] | undefined;
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
  submitRow: (input: TInput, row: CsvRow, index: number) => Promise<{ displayName?: string }>;
  onFinish?: (results: CsvImportResultItem[]) => void;
}

type Stage = "upload" | "mapping" | "preview" | "submitting" | "done";

interface PreviewRow<TInput> {
  rowIndex: number;
  canonicalRow: CsvRow;
  input?: TInput;
  errors: string[];
  isValid: boolean;
}

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

function extractErrorMessage(error: unknown) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (error instanceof Error ? error.message : "Lỗi không xác định")
  );
}

function buildDefaultMapping<TInput>(headers: string[], columns: CsvColumnSpec<TInput>[]) {
  const normalizedHeaders = headers.reduce<Record<string, string>>((acc, header) => {
    acc[normalizeHeader(header)] = header;
    return acc;
  }, {});

  return columns.reduce<Record<string, string>>((acc, column) => {
    const exactMatch = headers.find((header) => header === column.header);
    const normalizedMatch = normalizedHeaders[normalizeHeader(column.header)];
    acc[column.header] = exactMatch ?? normalizedMatch ?? "";
    return acc;
  }, {});
}

function buildPreviewRows<TInput>(
  rows: CsvRow[],
  columns: CsvColumnSpec<TInput>[],
  mapping: Record<string, string>
): PreviewRow<TInput>[] {
  return rows.map((sourceRow, index) => {
    const canonicalRow = columns.reduce<CsvRow>((acc, column) => {
      const mappedHeader = mapping[column.header];
      acc[column.header] = mappedHeader ? sourceRow[mappedHeader] ?? "" : "";
      return acc;
    }, {});

    const errors: string[] = [];
    const input = {} as TInput;

    for (const column of columns) {
      const mappedHeader = mapping[column.header];

      if (!mappedHeader) {
        if (column.required) {
          errors.push(`Chưa map cột bắt buộc "${column.header}"`);
        }
        continue;
      }

      try {
        const transformed = column.transform(canonicalRow[column.header] ?? "", canonicalRow);
        if (transformed !== undefined) {
          (input as Record<string, unknown>)[column.key as string] = transformed;
        }
      } catch (error) {
        errors.push(extractErrorMessage(error));
      }
    }

    return {
      rowIndex: index + 1,
      canonicalRow,
      input: errors.length === 0 ? input : undefined,
      errors,
      isValid: errors.length === 0
    };
  });
}

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
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [results, setResults] = useState<CsvImportResultItem[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [skipInvalidRows, setSkipInvalidRows] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setStage("upload");
      setRows([]);
      setParsedHeaders([]);
      setColumnMapping({});
      setParseError(null);
      setResults([]);
      setProgress({ done: 0, total: 0 });
      setSkipInvalidRows(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open]);

  const templateHeaders = useMemo(() => columns.map((column) => column.header), [columns]);
  const previewRows = useMemo(
    () => buildPreviewRows(rows, columns, columnMapping),
    [columnMapping, columns, rows]
  );
  const previewValidCount = previewRows.filter((row) => row.isValid).length;
  const previewErrorRows = previewRows.filter((row) => !row.isValid);
  const hasMissingRequiredMapping = columns.some(
    (column) => column.required && !columnMapping[column.header]
  );

  const handleDownloadTemplate = () => {
    const exampleRow = columns.reduce<Record<string, string>>((acc, column) => {
      acc[column.header] = column.example ?? "";
      return acc;
    }, {});
    downloadCsv(templateFilename, buildCsv(templateHeaders, [exampleRow]));
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setParseError(null);

    try {
      const text = await readFileAsText(file);
      const parsed = parseCsv(text);

      if (parsed.rows.length === 0) {
        setParseError("File CSV không có dòng dữ liệu nào.");
        return;
      }

      if (parsed.headers.length === 0) {
        setParseError("File CSV không có tiêu đề cột hợp lệ.");
        return;
      }

      setRows(parsed.rows);
      setParsedHeaders(parsed.headers);
      setColumnMapping(buildDefaultMapping(parsed.headers, columns));
      setStage("mapping");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Không đọc được file CSV.");
    }
  };

  const handleDownloadErrorReport = () => {
    const errorRows =
      stage === "done"
        ? results
            .filter((item) => item.status === "error")
            .map((item) => ({
              rowIndex: item.rowIndex,
              message: item.message ?? "Lỗi không xác định"
            }))
        : previewErrorRows.map((row) => ({
            rowIndex: row.rowIndex,
            message: row.errors.join(" | ")
          }));

    if (!errorRows.length) {
      return;
    }

    downloadCsv("csv-import-errors.csv", buildCsv(["rowIndex", "message"], errorRows));
  };

  const handleImport = async () => {
    const processableRows = skipInvalidRows ? previewRows.filter((row) => row.isValid) : previewRows;
    const initialResults = skipInvalidRows
      ? previewRows
          .filter((row) => !row.isValid)
          .map<CsvImportResultItem>((row) => ({
            rowIndex: row.rowIndex,
            status: "error",
            message: row.errors.join(" | ")
          }))
      : [];

    setStage("submitting");
    setProgress({ done: 0, total: processableRows.length });
    setResults(initialResults);

    const output: CsvImportResultItem[] = [...initialResults];
    let processedCount = 0;

    for (const row of processableRows) {
      if (!row.isValid || !row.input) {
        output.push({
          rowIndex: row.rowIndex,
          status: "error",
          message: row.errors.join(" | ") || "Dòng dữ liệu không hợp lệ"
        });
        processedCount += 1;
        setProgress({ done: processedCount, total: processableRows.length });
        setResults([...output].sort((a, b) => a.rowIndex - b.rowIndex));
        continue;
      }

      try {
        const response = await submitRow(row.input, row.canonicalRow, row.rowIndex - 1);
        output.push({
          rowIndex: row.rowIndex,
          status: "success",
          displayName: response.displayName
        });
      } catch (error) {
        output.push({
          rowIndex: row.rowIndex,
          status: "error",
          message: extractErrorMessage(error)
        });
      }

      processedCount += 1;
      setProgress({ done: processedCount, total: processableRows.length });
      setResults([...output].sort((a, b) => a.rowIndex - b.rowIndex));
    }

    const sortedResults = [...output].sort((a, b) => a.rowIndex - b.rowIndex);
    setResults(sortedResults);
    setStage("done");
    onFinish?.(sortedResults);
  };

  if (!open) {
    return null;
  }

  const successCount = results.filter((item) => item.status === "success").length;
  const errorCount = results.filter((item) => item.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={stage === "submitting" ? undefined : onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-bg-card shadow-xl">
        <div className="flex items-start justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
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
          {stage === "upload" ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-dashed border-border bg-bg-hover/30 p-5 text-sm">
                <p className="font-medium text-text-primary">Luồng import</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-text-secondary">
                  <li>Tải file mẫu hoặc dùng file CSV hiện có của bạn.</li>
                  <li>Map cột từ file upload vào cột chuẩn của hệ thống.</li>
                  <li>Xem preview, kiểm tra lỗi từng dòng rồi import toàn phần hoặc partial.</li>
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
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-bg-card px-4 text-sm font-medium text-text-primary hover:bg-bg-hover"
                >
                  Chọn file CSV...
                </label>
              </div>

              {parseError ? (
                <div className="rounded-md border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
                  {parseError}
                </div>
              ) : null}

              <div className="rounded-lg border border-border/60 bg-white/60 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Cột chuẩn của hệ thống
                </p>
                <div className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
                  {columns.map((column) => (
                    <div key={column.header} className="flex items-center gap-2 text-text-primary">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          column.required ? "bg-danger" : "bg-text-muted"
                        )}
                      />
                      <span>{column.header}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {stage === "mapping" ? (
            <div className="space-y-5">
              <div className="rounded-md border border-info/40 bg-info-bg px-4 py-3 text-sm text-info">
                Đã đọc được <span className="font-semibold">{rows.length}</span> dòng và{" "}
                <span className="font-semibold">{parsedHeaders.length}</span> cột từ file upload.
              </div>

              <div className="rounded-lg border border-border/60 bg-white/70 p-4">
                <p className="text-sm font-semibold text-text-primary">Map cột</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Chọn cột nguồn tương ứng cho từng cột chuẩn trước khi xem preview.
                </p>

                <div className="mt-4 space-y-3">
                  {columns.map((column) => (
                    <div
                      key={column.header}
                      className="grid gap-3 rounded-2xl border border-border/60 bg-bg-hover/20 px-4 py-3 md:grid-cols-[1fr_1fr]"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {column.header}
                          {column.required ? <span className="ml-1 text-danger">*</span> : null}
                        </p>
                        {column.example ? (
                          <p className="mt-1 text-xs text-text-secondary">Ví dụ: {column.example}</p>
                        ) : null}
                      </div>

                      <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                          Cột từ file upload
                        </span>
                        <select
                          value={columnMapping[column.header] ?? ""}
                          onChange={(event) =>
                            setColumnMapping((current) => ({
                              ...current,
                              [column.header]: event.target.value
                            }))
                          }
                          className="flex h-11 w-full rounded-md border border-border bg-bg-input px-4 py-2 text-sm text-text-primary outline-none transition focus:border-border-focus focus:ring-2 focus:ring-info/15"
                        >
                          <option value="">{column.required ? "Chưa map" : "Bỏ qua cột này"}</option>
                          {parsedHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {hasMissingRequiredMapping ? (
                <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                  Vẫn còn cột bắt buộc chưa được map. Hoàn tất mapping trước khi xem preview.
                </div>
              ) : null}
            </div>
          ) : null}

          {stage === "preview" ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-lg border border-border/60 bg-white/70 p-4">
                  <p className="text-sm font-semibold text-text-primary">Tóm tắt preview</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-bg-hover/30 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Tổng dòng</p>
                      <p className="mt-2 text-2xl font-bold text-text-primary">{previewRows.length}</p>
                    </div>
                    <div className="rounded-2xl border border-success/20 bg-success-bg/40 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success">Hợp lệ</p>
                      <p className="mt-2 text-2xl font-bold text-text-primary">{previewValidCount}</p>
                    </div>
                    <div className="rounded-2xl border border-danger/20 bg-danger-bg/40 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-danger">Có lỗi</p>
                      <p className="mt-2 text-2xl font-bold text-text-primary">{previewErrorRows.length}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-white/70 p-4">
                  <p className="text-sm font-semibold text-text-primary">Cách import</p>
                  <label className="mt-4 flex items-start gap-3 rounded-2xl border border-border/60 bg-bg-hover/20 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={skipInvalidRows}
                      onChange={(event) => setSkipInvalidRows(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm text-text-primary">
                      Bỏ qua các dòng lỗi và chỉ import các dòng hợp lệ.
                      <span className="mt-1 block text-text-secondary">
                        Tắt tùy chọn này nếu bạn muốn thấy toàn bộ lỗi ở màn kết quả mà không bỏ qua bước xử lý từng dòng.
                      </span>
                    </span>
                  </label>

                  {previewErrorRows.length > 0 ? (
                    <Button type="button" variant="outline" className="mt-4" onClick={handleDownloadErrorReport}>
                      Tải error report
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="overflow-auto rounded-lg border border-border max-h-[40vh]">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="sticky top-0 bg-bg-hover">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Trạng thái</th>
                      {columns.map((column) => (
                        <th
                          key={column.header}
                          className="px-3 py-2 text-left text-xs font-semibold text-text-secondary whitespace-nowrap"
                        >
                          {column.header}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Lỗi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 50).map((row) => (
                      <tr key={row.rowIndex} className="border-t border-border/60">
                        <td className="px-3 py-2 text-text-secondary">{row.rowIndex}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                              row.isValid
                                ? "bg-success-bg text-success"
                                : "bg-danger-bg text-danger"
                            )}
                          >
                            {row.isValid ? "Sẵn sàng" : "Có lỗi"}
                          </span>
                        </td>
                        {columns.map((column) => (
                          <td key={column.header} className="px-3 py-2 text-text-primary">
                            {row.canonicalRow[column.header] || <span className="text-text-muted">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-sm text-danger">
                          {row.errors.length ? row.errors.join(" | ") : <span className="text-success">OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRows.length > 50 ? (
                  <div className="border-t border-border/60 px-3 py-2 text-xs text-text-secondary">
                    Hiển thị 50/{previewRows.length} dòng đầu tiên trong preview.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {stage === "submitting" || stage === "done" ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm font-medium text-text-primary">
                  <span>
                    {stage === "submitting" ? "Đang nhập..." : "Hoàn tất"} — {progress.done}/{progress.total}
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

              {errorCount > 0 ? (
                <Button type="button" variant="outline" onClick={handleDownloadErrorReport}>
                  Tải error report
                </Button>
              ) : null}

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
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-bg-hover/30 px-6 py-4">
          {stage === "upload" ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Đóng
            </Button>
          ) : null}

          {stage === "mapping" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStage("upload");
                  setRows([]);
                  setParsedHeaders([]);
                  setColumnMapping({});
                  setParseError(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                Chọn file khác
              </Button>
              <Button
                type="button"
                onClick={() => setStage("preview")}
                disabled={hasMissingRequiredMapping}
              >
                Xem preview
              </Button>
            </>
          ) : null}

          {stage === "preview" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStage("mapping")}>
                Quay lại mapping
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={previewValidCount === 0}
              >
                Nhập {skipInvalidRows ? previewValidCount : previewRows.length} dòng
              </Button>
            </>
          ) : null}

          {stage === "submitting" ? (
            <Button type="button" disabled>
              Đang xử lý...
            </Button>
          ) : null}

          {stage === "done" ? (
            <Button type="button" onClick={onClose}>
              Đóng
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
