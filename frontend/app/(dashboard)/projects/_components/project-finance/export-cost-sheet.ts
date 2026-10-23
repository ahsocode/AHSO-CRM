import { apiClient } from "@/lib/api-client";
import { COST_GROUP_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { ApiResponse } from "@/lib/types";
import { downloadBlob } from "@/lib/utils";
import type { AllocationCostSheet } from "@/types/bom";

const MONEY_FORMAT = '#,##0" ₫"';

/** Loads the cost sheet of one allocation batch and downloads it as an Excel file. */
export async function exportAllocationCostSheet(allocationId: string): Promise<void> {
  const response = await apiClient.get<ApiResponse<AllocationCostSheet>>(
    `/material-allocations/${allocationId}/cost-sheet`
  );
  const sheet = response.data.data;
  const invoiceNo = sheet.allocation.salesInvoiceNo ?? formatDate(sheet.allocation.salesInvoiceDate);

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Bảng kê giá vốn");
  worksheet.columns = [
    { width: 6 },
    { width: 18 },
    { width: 36 },
    { width: 10 },
    { width: 12 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 24 }
  ];

  const title = worksheet.addRow([`Bảng kê giá vốn hóa đơn bán số ${invoiceNo}`]);
  title.font = { bold: true, size: 14 };
  worksheet.mergeCells(title.number, 1, title.number, 10);
  worksheet.addRow([`Dự án: ${sheet.project.code} - ${sheet.project.name}`]);
  worksheet.addRow([`Khách hàng: ${sheet.customer.name}`]);
  worksheet.addRow([`Ngày hóa đơn bán: ${formatDate(sheet.allocation.salesInvoiceDate)}`]);
  worksheet.addRow([]);

  const materialsHeader = worksheet.addRow([
    "STT",
    "Mã vật tư",
    "Tên vật tư",
    "ĐVT",
    "Số lượng",
    "Đơn giá",
    "Thành tiền",
    "Kho",
    "Ngày HĐ mua",
    "Số HĐ mua / phiếu nhập"
  ]);
  materialsHeader.font = { bold: true };
  sheet.materials.forEach((row) => {
    const added = worksheet.addRow([
      row.stt,
      row.materialCode,
      row.materialName,
      row.unit,
      row.quantity,
      row.unitPrice,
      row.total,
      row.warehouse,
      formatDate(row.purchaseInvoiceDate),
      row.purchaseInvoiceNo ?? row.receiptNo ?? ""
    ]);
    added.getCell(6).numFmt = MONEY_FORMAT;
    added.getCell(7).numFmt = MONEY_FORMAT;
  });
  const materialTotal = worksheet.addRow(["", "", "Cộng giá vốn vật tư", "", "", "", sheet.totals.materialTotal]);
  materialTotal.font = { bold: true };
  materialTotal.getCell(7).numFmt = MONEY_FORMAT;

  if (sheet.costs.length > 0) {
    worksheet.addRow([]);
    const costHeader = worksheet.addRow([
      "STT",
      "Nhóm",
      "Nội dung",
      "",
      "VAT (%)",
      "",
      "Số tiền",
      "Nhà cung cấp",
      "Ngày hóa đơn",
      "Số hóa đơn"
    ]);
    costHeader.font = { bold: true };
    sheet.costs.forEach((row) => {
      const added = worksheet.addRow([
        row.stt,
        COST_GROUP_LABELS[row.group],
        row.description,
        "",
        row.vatRate ?? "",
        "",
        row.amount,
        row.supplier ?? "",
        formatDate(row.invoiceDate),
        row.invoiceNo ?? ""
      ]);
      added.getCell(7).numFmt = MONEY_FORMAT;
    });
    const costTotal = worksheet.addRow(["", "", "Cộng chi phí trực tiếp", "", "", "", sheet.totals.costTotal]);
    costTotal.font = { bold: true };
    costTotal.getCell(7).numFmt = MONEY_FORMAT;
  }

  worksheet.addRow([]);
  const grand = worksheet.addRow(["", "", "Tổng giá vốn", "", "", "", sheet.totals.grandTotal]);
  grand.font = { bold: true };
  grand.getCell(7).numFmt = MONEY_FORMAT;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const safeNo = invoiceNo.replace(/[^\p{L}\p{N}_-]+/gu, "-");
  downloadBlob(blob, `bang-ke-gia-von-${safeNo}.xlsx`);
}
