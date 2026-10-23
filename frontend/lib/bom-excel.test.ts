import { describe, expect, it } from "vitest";
import { buildImportRows, guessHeaderRow, guessMapping } from "./bom-excel";

describe("BOM supplier workbook import", () => {
  it("recognizes Vietnamese and supplier column headings without reusing a column", () => {
    const mapping = guessMapping(["STT", "Part No", "Description", "Thông số", "ĐVT", "Qty", "Unit price", "Nhóm", "Note"]);
    expect(mapping).toEqual({ stt: 0, code: 1, name: 2, specification: 3, unit: 4, quantity: 5, estUnitCost: 6, group: 7, notes: 8 });
  });

  it("finds the actual header after a three-cell title row", () => {
    const rows = [
      ["AHSO", "Máy kiểm tra", "23/10/2026"],
      [],
      ["Mã VT", "Tên", "SL", "Đơn giá"],
      ["CAM-01", "Camera", "2", "125000"]
    ];
    expect(guessHeaderRow(rows)).toBe(2);
  });

  it("skips blank and total rows, preserves a free line and carries section groups", () => {
    const rows = [
      ["Mã", "Tên", "SL", "Đơn giá", "Nhóm"],
      ["", "A. Cơ khí", "", "", ""],
      ["KHUNG-01", "Khung máy", "2", "1.250.000", ""],
      [],
      ["", "Hạng mục tùy chỉnh", "", "", ""],
      ["CAM-01", "Camera kiểm tra", "1,5", "1,250.50", "Vision – camera"],
      ["", "Tổng cộng", "", "3.000.000", ""]
    ];
    const parsed = buildImportRows(rows, 0, guessMapping(rows[0]));
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ code: "KHUNG-01", group: "MECHANICAL", quantity: 2, estUnitCost: 1250000 });
    expect(parsed[1]).toMatchObject({ name: "Hạng mục tùy chỉnh", code: "", quantity: 1 });
    expect(parsed[2]).toMatchObject({ group: "VISION", quantity: 1.5, estUnitCost: 1250.5 });
  });
});
