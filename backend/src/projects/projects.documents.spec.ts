import { ProjectsService } from './projects.service';

const user = { sub: 'admin', role: 'ADMIN', permissions: [], email: 'a@ahso.vn', name: 'A' } as const;
function setup() {
  const prisma = {
    project: { findFirst: jest.fn().mockResolvedValue({id: 'p1', customerId: 'customer', contract: {id: 'contract'}, quotes: [{id: 'draft-quote'}]}) },
    projectDocumentRequirement: {findMany: jest.fn().mockResolvedValue([{type: 'QUOTATION'}, {type: 'DOC_HANDOVER'}, {type: 'NDA'}])},
    document: {findFirst: jest.fn().mockImplementation(({where}) => where.type === 'NDA' ? {id: 'old', number: 'old-number'} : null)}
  };
  const documents = {
    getReadiness: jest.fn().mockImplementation(type => type === 'DOC_HANDOVER' ? {readiness: 'missing', missingFields: [{field: 'handedOverDocs', message: 'Chưa có danh mục bàn giao.'}]} : {readiness: 'ready', missingFields: []}),
    renderPdf: jest.fn().mockResolvedValue({documentId: 'new', number: 'BG-new', downloadUrl: '/api/documents/new/download'})
  };
  return {prisma, documents, service: new ProjectsService(prisma as never, {} as never, {} as never, documents as never, {} as never)};
}
describe('safe project document generation', () => {
  it.each(['missing', 'all'] as const)('respects existing documents and still skips missing data (mode %s)', async mode => {
    const {service, documents} = setup();
    const result = await service.generateDocumentPlan('p1', {mode}, user as never);
    expect(documents.renderPdf).toHaveBeenCalledTimes(mode === 'all' ? 2 : 1);
    expect(documents.renderPdf).toHaveBeenCalledWith('QUOTATION', 'draft-quote', 'vi', undefined, undefined, user, 'p1');
    expect(result.results).toEqual(expect.arrayContaining([
      {type:'QUOTATION', status:'created', reason: expect.any(String)},
      {type:'DOC_HANDOVER', status:'skipped', reason:'Chưa có danh mục bàn giao.'},
      {type:'NDA', status:mode === 'all' ? 'created' : 'skipped', reason: expect.any(String)}
    ]));
  });
  it('does not substitute a quote for a missing contract', async () => {
    const {service, prisma, documents} = setup();
    prisma.project.findFirst.mockResolvedValue({id:'p1', customerId:'customer', contract:null, quotes:[{id:'draft-quote'}]});
    await service.generateDocumentPlan('p1', {mode:'missing'}, user as never);
    expect(documents.getReadiness).not.toHaveBeenCalledWith('DOC_HANDOVER', 'draft-quote', expect.anything());
    expect(prisma.project.findFirst.mock.calls[0][0].select.quotes.where.status.in).toEqual(['DRAFT', 'SENT', 'ACCEPTED']);
  });
});
