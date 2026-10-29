import { DocumentType } from '@prisma/client';
import { assertDocumentRequirements, DOCUMENT_SOURCE_SCHEMAS, getDocumentMissingFields } from './document-requirements';

const expectedFields: Partial<Record<DocumentType, string[]>> = {
  DOC_HANDOVER: ['handedOverDocs', 'handoverDate'],
  MAINTENANCE_RECORD: ['issues', 'maintenanceDate', 'technician'],
  CONTRACT_ADDENDUM: ['modifications', 'addendumDate'],
  INSTALLATION_REPORT: ['installations', 'installationDate'],
  ACCEPTANCE_REPORT: ['testResults', 'acceptanceDate', 'conclusion'],
  PARTIAL_ACCEPTANCE: ['acceptedParts', 'acceptanceDate'],
  PAYMENT_REQUEST: ['milestone.id', 'paymentAmount', 'requestDate'],
  PAYMENT_RECEIPT: ['payment.id', 'receiptAmount', 'receiptDate', 'paymentMethod', 'cashier', 'payerName']
};
describe('document requirements', () => {
  it.each(Object.entries(expectedFields))('%s identifies the exact missing evidence with structured 422 errors', (type, fields) => {
    const context = {contract: {id: 'actual-contract'}};
    expect(getDocumentMissingFields(type as DocumentType, context).map(error => error.field)).toEqual(fields);
    try { assertDocumentRequirements(type as DocumentType, context); throw new Error('unexpected success'); }
    catch (error) {
      expect(error).toMatchObject({ getStatus: expect.any(Function) });
      const exception = error as { getStatus(): number; getResponse(): {statusCode: number; message: string; errors: Array<{field: string; message: string}>} };
      expect(exception.getStatus()).toBe(422);
      expect(exception.getResponse().errors.map(error => error.field)).toEqual(fields);
      expect(exception.getResponse().statusCode).toBe(422);
    }
  });
  it('does not print an unconditional acceptance or installation confirmation for failed results', () => {
    expect(DOCUMENT_SOURCE_SCHEMAS.ACCEPTANCE_REPORT.safeParse({testResults:[{name:'Thử nghiệm', status:'Không đạt'}], acceptanceDate:new Date().toISOString(), conclusion:'ACCEPTED'}).success).toBe(false);
    expect(DOCUMENT_SOURCE_SCHEMAS.INSTALLATION_REPORT.safeParse({installations:[{name:'Thiết bị', status:'Chưa hoàn thành'}], installationDate:new Date().toISOString()}).success).toBe(false);
  });
});
