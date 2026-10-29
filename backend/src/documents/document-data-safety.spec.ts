import { DocumentType } from '@prisma/client';
import { DocumentDataLoaderService } from './document-data-loader.service';
import { createFixturePrisma, createRenderHarness, FIXTURE_ENTITY_IDS, stripStyles } from './__fixtures__/document-fixtures';

const sourceTypes: DocumentType[] = ['DOC_HANDOVER', 'MAINTENANCE_RECORD', 'CONTRACT_ADDENDUM', 'INSTALLATION_REPORT', 'ACCEPTANCE_REPORT', 'DELIVERY_NOTE'];
const methods = {
  DOC_HANDOVER: 'loadForDocHandover', MAINTENANCE_RECORD: 'loadForMaintenanceRecord', CONTRACT_ADDENDUM: 'loadForContractAddendum', INSTALLATION_REPORT: 'loadForInstallationReport', ACCEPTANCE_REPORT: 'loadForAcceptanceReport', DELIVERY_NOTE: 'loadForDeliveryNote',
  PARTIAL_ACCEPTANCE: 'loadForPartialAcceptance', PAYMENT_REQUEST: 'loadForPaymentRequest', PAYMENT_RECEIPT: 'loadForPaymentReceipt'
} as const;

describe('live document data has no invented fallback', () => {
  it.each([...sourceTypes, 'PARTIAL_ACCEPTANCE', 'PAYMENT_REQUEST', 'PAYMENT_RECEIPT'] as DocumentType[])('%s refuses to render without actual evidence', async type => {
    const prisma = createFixturePrisma('full');
    prisma.documentSourceData.findUnique = async () => ({ data: {} });
    const contract = await prisma.contract.findUnique({ where: { id: 'contract-orion' } });
    contract!.milestones = [];
    prisma.contract.findUnique = async () => contract;
    prisma.payment.findFirst = async () => null;
    const loader = new DocumentDataLoaderService(prisma as never, { getCompanyInfo: async () => ({}), getAllSettings: async () => ({policies: {}}) } as never, {} as never);
    const method = methods[type as keyof typeof methods];
    const action = loader[method]('contract-orion');
    await expect(action).rejects.toMatchObject({ response: { statusCode: 422, errors: expect.arrayContaining([expect.objectContaining({ field: expect.any(String), message: expect.any(String) })]) } });
    const fields = await action.catch(error => error.getResponse().errors.map((field: {field: string}) => field.field));
    if (type === 'PARTIAL_ACCEPTANCE') expect(fields).toEqual(['acceptedParts', 'acceptanceDate']);
    if (type === 'PAYMENT_REQUEST') expect(fields).toEqual(['milestone.id', 'paymentAmount', 'requestDate']);
    if (type === 'PAYMENT_RECEIPT') expect(fields).toEqual(['payment.id', 'receiptAmount', 'receiptDate', 'paymentMethod', 'cashier']);
  });
  it.each(Object.keys(methods) as Array<keyof typeof methods>)('%s renders clean HTML when explicitly supplied evidence is complete', async type => {
    const harness = await createRenderHarness('full');
    const html = stripStyles(await harness.render(type, 'vi', FIXTURE_ENTITY_IDS[type]));
    expect(html).not.toMatch(/\{\{|\bundefined\b|\bnull\b|\bNaN\b/);
    expect(html).not.toMatch(/CPU &lt; 40%|Cloud AWS|1000 CCU|Server OS &amp; DB|Giai đoạn 1: Triển khai thiết kế|94%/);
  });
  it('does not use contract items, unfinished milestones or a pretax ratio as acceptance evidence', async () => {
    const prisma = createFixturePrisma('full');
    const contract = await prisma.contract.findUnique({ where: { id: 'contract-orion' } });
    contract!.milestones.forEach(m => { m.status = 'IN_PROGRESS'; });
    prisma.contract.findUnique = async () => contract;
    const loader = new DocumentDataLoaderService(prisma as never, {} as never, {} as never);
    await expect(loader.loadForPartialAcceptance('contract-orion')).rejects.toMatchObject({response: {statusCode: 422}});
  });
});
