export type SourceDocumentType = "CONTRACT_ADDENDUM" | "DOC_HANDOVER" | "INSTALLATION_REPORT" | "ACCEPTANCE_REPORT" | "MAINTENANCE_RECORD" | "DELIVERY_NOTE" | "AR_RECONCILIATION";
export interface SourceField {
  key: string;
  label: string;
  control?: "number" | "select" | "contracts";
  options?: string[];
  optional?: boolean;
}
interface SourceForm {
  rowsKey: string;
  rowsLabel: string;
  rowFields: SourceField[];
  date?: {key: string; label: string};
  text?: {key: string; label: string};
  confirmation?: {key: string; label: string; value: true | "ACCEPTED"};
}
const note: SourceField = {key:"note", label:"Ghi chú", optional:true};
const name: SourceField = {key:"name", label:"Tên hạng mục"};

/** Mirrors the seven DOCUMENT_SOURCE_SCHEMAS; no factual result is selected by default. */
export const DOCUMENT_SOURCE_FORMS: Record<SourceDocumentType, SourceForm> = {
  CONTRACT_ADDENDUM: {rowsKey:"modifications", rowsLabel:"Nội dung sửa đổi", rowFields:[{key:"content", label:"Nội dung sửa đổi"}], date:{key:"addendumDate", label:"Ngày phụ lục"}},
  DOC_HANDOVER: {rowsKey:"handedOverDocs", rowsLabel:"Tài liệu đã bàn giao", rowFields:[{key:"name", label:"Tên tài liệu"}, {key:"format", label:"Định dạng tài liệu"}, note], date:{key:"handoverDate", label:"Ngày bàn giao thực tế"}},
  INSTALLATION_REPORT: {rowsKey:"installations", rowsLabel:"Hạng mục lắp đặt", rowFields:[name, {key:"status", label:"Kết quả lắp đặt", control:"select", options:["Hoàn thành"]}, note], date:{key:"installationDate", label:"Ngày lắp đặt thực tế"}},
  ACCEPTANCE_REPORT: {rowsKey:"testResults", rowsLabel:"Kết quả kiểm tra nghiệm thu", rowFields:[name, {key:"status", label:"Kết quả kiểm tra", control:"select", options:["Đạt", "Đạt (Pass)", "Pass"]}, note], date:{key:"acceptanceDate", label:"Ngày nghiệm thu thực tế"}, confirmation:{key:"conclusion", label:"Xác nhận kết luận nghiệm thu đạt", value:"ACCEPTED"}},
  MAINTENANCE_RECORD: {rowsKey:"issues", rowsLabel:"Công việc bảo trì", rowFields:[name, {key:"status", label:"Kết quả bảo trì"}, note], date:{key:"maintenanceDate", label:"Ngày bảo trì thực tế"}, text:{key:"technician", label:"Kỹ thuật viên"}},
  DELIVERY_NOTE: {rowsKey:"deliveredItems", rowsLabel:"Hàng hóa đã giao", rowFields:[name, {key:"description", label:"Mô tả", optional:true}, {key:"quantity", label:"Số lượng", control:"number"}, {key:"unit", label:"Đơn vị"}], date:{key:"deliveryDate", label:"Ngày giao hàng thực tế"}, confirmation:{key:"conditionConfirmed", label:"Xác nhận tình trạng hàng hóa đúng như nội dung biên bản", value:true}},
  AR_RECONCILIATION: {rowsKey:"invoices", rowsLabel:"Hóa đơn thực tế", rowFields:[{key:"contractId", label:"Hợp đồng", control:"contracts"}, {key:"amount", label:"Số tiền hóa đơn", control:"number"}, {key:"reference", label:"Số chứng từ"}]}
};

export function isSourceDocumentType(type: string): type is SourceDocumentType {
  return Object.prototype.hasOwnProperty.call(DOCUMENT_SOURCE_FORMS, type);
}

/** DateInput supplies a calendar date. Preserve that date at midnight in Vietnam, independent of the browser TZ. */
export function sourceDateToISO(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00+07:00` : date;
}

export function sourceDateFromISO(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(new Date(value).getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Ho_Chi_Minh", year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(new Date(value));
  const part = (key: string) => parts.find(item => item.type === key)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
