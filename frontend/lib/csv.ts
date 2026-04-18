// Lightweight CSV utilities - no external dependency.
// Supports quoted fields, escaped double-quotes ("") and CRLF/LF line endings.

export type CsvRow = Record<string, string>;

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
}

/**
 * Parse a CSV string into header + rows. Rows are objects keyed by header.
 * Unknown number of columns in a row falls back to "" for missing fields.
 */
export function parseCsv(input: string): ParsedCsv {
  // Strip UTF-8 BOM if present
  const text = input.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (ch === "\r") {
      // swallow, let \n finalize
      continue;
    }

    if (ch === "\n") {
      currentRow.push(currentField);
      records.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += ch;
  }

  // Flush trailing field/row if file doesn't end with newline
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    records.push(currentRow);
  }

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0].map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let r = 1; r < records.length; r++) {
    const rec = records[r];
    // Skip empty lines
    if (rec.length === 1 && rec[0].trim() === "") continue;

    const row: CsvRow = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = (rec[c] ?? "").trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

/** Escape a field per RFC 4180. */
function escapeField(value: string | number | boolean | null | undefined): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a CSV string from rows + header list. */
export function buildCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const headerLine = headers.map((h) => escapeField(h)).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeField(row[h] as string | number | boolean | null | undefined)).join(",")
  );
  return [headerLine, ...dataLines].join("\r\n") + "\r\n";
}

/** Trigger browser download for CSV text. Adds UTF-8 BOM for Excel compatibility. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Read a File as text (UTF-8). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}
