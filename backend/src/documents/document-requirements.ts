import { UnprocessableEntityException } from '@nestjs/common';
import type { DocumentType } from '@prisma/client';
import { z } from 'zod';

const text = z.string({ required_error: 'Chưa nhập nội dung' }).trim().min(1, 'Chưa nhập nội dung').max(10000);
const date = z.string({ required_error: 'Chưa nhập ngày thực tế' }).datetime({ offset: true, message: 'Ngày thực tế không hợp lệ' });
const rows = <T extends z.ZodTypeAny>(row: T) => z.array(row, { required_error: 'Chưa có danh mục thực tế' }).min(1, 'Chưa có danh mục thực tế').max(200);
const result = z.object({ name: text, status: text, note: z.string().max(10000).optional() }).strict();

/** Explicitly recorded operational evidence, never arbitrary overrides of the render context. */
export const DOCUMENT_SOURCE_SCHEMAS = {
  CONTRACT_ADDENDUM: z.object({ modifications: rows(z.object({ content: text }).strict()), addendumDate: date }).strict(),
  DOC_HANDOVER: z.object({ handedOverDocs: rows(z.object({ name: text, format: text, note: z.string().max(10000).optional() }).strict()), handoverDate: date }).strict(),
  INSTALLATION_REPORT: z.object({ installations: rows(result.extend({ status: z.literal("Hoàn thành") })), installationDate: date }).strict(),
  ACCEPTANCE_REPORT: z.object({ testResults: rows(result.extend({ status: z.enum(["Đạt", "Đạt (Pass)", "Pass"]) })), acceptanceDate: date, conclusion: z.literal('ACCEPTED', { errorMap: () => ({ message: 'Cần xác nhận nghiệm thu đạt trước khi xuất biên bản' }) }) }).strict(),
  MAINTENANCE_RECORD: z.object({ issues: rows(result), maintenanceDate: date, technician: text }).strict(),
  DELIVERY_NOTE: z.object({ deliveredItems: rows(z.object({ name: text, description: z.string().max(10000).optional(), quantity: z.number().positive(), unit: text }).strict()), deliveryDate: date, conditionConfirmed: z.literal(true, { errorMap: () => ({ message: "Cần xác nhận tình trạng hàng hóa đúng như biên bản" }) }) }).strict(),
  AR_RECONCILIATION: z.object({ invoices: rows(z.object({ contractId: text, amount: z.number().nonnegative(), reference: text }).strict()) }).strict()
} satisfies Partial<Record<DocumentType, z.ZodTypeAny>>;

export type MissingDocumentField = { field: string; message: string };
type Context = Record<string, unknown>;
const hasText = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const hasDate = (v: unknown) => (v instanceof Date || hasText(v)) && Number.isFinite(new Date(v as string).getTime());
const hasRows = (v: unknown) => Array.isArray(v) && v.length > 0;
const positive = (v: unknown) => v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0;
const obj = (v: unknown): Context => v && typeof v === 'object' ? v as Context : {};
type Requirement = { field: string; message: string; present(context: Context): boolean };
const required = (field: string, message: string, test: (v: unknown) => boolean = hasText): Requirement => ({ field, message, present: c => test(field.split('.').reduce<unknown>((v, key) => obj(v)[key], c)) });
const contract = required('contract.id', 'Cần có hợp đồng thực tế.');
const SOURCE_FIELD_LABELS: Record<string, string> = {
  modifications: "Nội dung sửa đổi phụ lục", addendumDate: "Ngày phụ lục",
  handedOverDocs: "Danh mục tài liệu bàn giao", handoverDate: "Ngày bàn giao thực tế",
  installations: "Danh mục lắp đặt", installationDate: "Ngày lắp đặt thực tế",
  testResults: "Kết quả kiểm tra nghiệm thu", acceptanceDate: "Ngày nghiệm thu thực tế", conclusion: "Kết luận nghiệm thu",
  issues: "Kết quả bảo trì", maintenanceDate: "Ngày bảo trì thực tế", technician: "Kỹ thuật viên",
  deliveredItems: "Hàng hóa đã giao", deliveryDate: "Ngày giao hàng thực tế", conditionConfirmed: "Xác nhận tình trạng hàng hóa",
  invoices: "Hóa đơn thực tế", contractId: "Hợp đồng", amount: "Số tiền", reference: "Số chứng từ",
  name: "Tên hạng mục", status: "Kết quả", note: "Ghi chú", format: "Định dạng tài liệu", quantity: "Số lượng", unit: "Đơn vị", content: "Nội dung", description: "Mô tả"
};
const sourceLabel = (path: (string | number)[]) => path.map(part => typeof part === "number" ? `Mục ${part + 1}` : SOURCE_FIELD_LABELS[part] ?? part).join(" / ");
const evidence = (type: keyof typeof DOCUMENT_SOURCE_SCHEMAS, c: Context): MissingDocumentField[] => {
  const parsed = DOCUMENT_SOURCE_SCHEMAS[type].safeParse(c.sourceData ?? {});
  return parsed.success ? [] : parsed.error.issues.map(issue => ({ field: issue.path.join('.'), message: `${sourceLabel(issue.path)}: ${issue.message}` }));
};

/** Used by both loaders (422) and the project readiness endpoint. */
export const DOCUMENT_REQUIREMENTS: Record<DocumentType, Requirement[]> = {
  QUOTATION: [required('quote.id', 'Cần có báo giá.')],
  PROPOSAL: [required('project.description', 'Chưa có mô tả phạm vi đề xuất.')],
  SURVEY_REPORT: [required('survey.id', 'Chưa có bản khảo sát.'), required('surveyDate', 'Chưa có ngày khảo sát thực tế.', hasDate), required('findings', 'Chưa có ghi nhận khảo sát.', hasRows)],
  CONTRACT: [contract, required('contract.signDate', 'Chưa có ngày ký hợp đồng.', hasDate)],
  CONTRACT_ADDENDUM: [contract], NDA: [required('customer.id', 'Cần có khách hàng.')], DELIVERY_NOTE: [contract], DOC_HANDOVER: [contract], INSTALLATION_REPORT: [contract], ACCEPTANCE_REPORT: [contract], MAINTENANCE_RECORD: [contract],
  PARTIAL_ACCEPTANCE: [contract, required('acceptedParts', 'Chưa có mốc đã nghiệm thu có giá trị và ngày hoàn thành.', hasRows), required('acceptanceDate', 'Chưa có ngày nghiệm thu thực tế.', hasDate)],
  WARRANTY_CERT: [contract, required('warrantyDate', 'Chưa có ngày hoàn thành thực tế để bắt đầu bảo hành.', hasDate), required('warrantyPeriodMonths', 'Chưa cấu hình số tháng bảo hành.', positive)],
  PAYMENT_REQUEST: [contract, required('milestone.id', 'Chưa có mốc thanh toán đang chờ.'), required('paymentAmount', 'Mốc thanh toán chưa có số tiền hợp lệ.', positive), required('requestDate', 'Mốc thanh toán chưa có hạn thanh toán.', hasDate)],
  PAYMENT_RECEIPT: [contract, required('payment.id', 'Chưa có khoản thanh toán thực tế.'), required('receiptAmount', 'Khoản thanh toán chưa có số tiền hợp lệ.', positive), required('receiptDate', 'Chưa có ngày thu thực tế.', hasDate), required('paymentMethod', 'Chưa ghi nhận phương thức thanh toán.'), required('cashier', 'Chưa cấu hình tên người thu tiền.'), required('payerName', 'Chưa có tên người nộp tiền.')],
  AR_RECONCILIATION: [required('customer.id', 'Cần có khách hàng.')]
};

export function getDocumentMissingFields(type: DocumentType, context: Context): MissingDocumentField[] {
  const missing = DOCUMENT_REQUIREMENTS[type].filter(r => !r.present(context)).map(({ field, message }) => ({ field, message }));
  if (type in DOCUMENT_SOURCE_SCHEMAS) missing.push(...evidence(type as keyof typeof DOCUMENT_SOURCE_SCHEMAS, context));
  return missing;
}

export function assertDocumentRequirements(type: DocumentType, context: Context): void {
  const errors = getDocumentMissingFields(type, context);
  if (errors.length) throw new UnprocessableEntityException({ statusCode: 422, message: 'Chưa đủ dữ liệu để sinh tài liệu.', errors });
}
