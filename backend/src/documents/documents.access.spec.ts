import 'reflect-metadata';
import { DocumentType } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

const staff = {sub: 'owner', name: 'Staff', email: 'staff@ahso.vn', role: 'STAFF', permissions: ['documents.view']} as const;
function setup(owner = 'someone-else') {
  // A plain row store: omitting the owner or active-owner predicate returns the foreign row.
  const matches = (where: any) => {
    const customer = where.customer ?? where.project?.customer ?? where;
    return (!customer.assignedToId || customer.assignedToId === owner) && (!customer.assignedTo || customer.assignedTo.isActive === true);
  };
  const entity = {findFirst: jest.fn(async ({where}) => matches(where) ? {id: 'foreign'} : null)};
  const prisma = {
    customer: entity, project: entity, quote: entity, contract: entity, payment: entity,
    document: {findFirst: jest.fn(async ({where}) => matches(where) ? {id:'doc', type:'QUOTATION', entityId:'foreign', number:'N', pdfPath:'/uploads/foreign.pdf'} : null)},
    documentSourceData: {upsert: jest.fn()}
  };
  const loader = {loadBaseContext: jest.fn().mockResolvedValue({}), loadForQuotation: jest.fn().mockResolvedValue({customer:{id:'foreign'}, quote:{id:'foreign'}, items:[]})};
  const upload = {readStoredFile: jest.fn().mockResolvedValue({buffer: Buffer.from('pdf'), mimeType:'application/pdf'})};
  const service = new DocumentsService(prisma as never, loader as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, upload as never);
  (service as any).initialized = true;
  jest.spyOn(service as any, 'renderHtml').mockResolvedValue('<html>safe</html>');
  return {service, prisma, loader, upload};
}

describe('document STAFF scope and permissions', () => {
  it.each(['QUOTATION','PROPOSAL','CONTRACT','NDA','PAYMENT_RECEIPT'] as DocumentType[])('denies foreign %s preview, render and source edits before loading data', async type => {
    const {service, loader, prisma} = setup();
    await expect(service.renderPreview(type,'foreign','vi',staff as never)).rejects.toMatchObject({status:404});
    await expect(service.renderPdf(type,'foreign','vi',undefined,undefined,staff as never)).rejects.toMatchObject({status:404});
    await expect(service.getSourceData(type,'foreign',staff as never)).rejects.toMatchObject({status:404});
    await expect(service.saveSourceData(type,'foreign',{},staff as never)).rejects.toMatchObject({status:404});
    expect(loader.loadBaseContext).not.toHaveBeenCalled();
    expect(prisma.documentSourceData.upsert).not.toHaveBeenCalled();
  });
  it('denies both foreign download routes before reading the file', async () => {
    const {service, upload} = setup();
    await expect(service.downloadDocument('doc',staff as never)).rejects.toMatchObject({status:404});
    await expect(service.downloadLatest('QUOTATION','foreign','vi',staff as never)).rejects.toMatchObject({status:404});
    expect(upload.readStoredFile).not.toHaveBeenCalled();
  });
  it('allows preview and both downloads of an assigned customer with an active owner', async () => {
    const {service, upload, prisma} = setup('owner');
    await expect(service.renderPreview('QUOTATION','foreign','vi',staff as never)).resolves.toMatchObject({html:expect.any(String)});
    await service.downloadDocument('doc',staff as never);
    await service.downloadLatest('QUOTATION','foreign','vi',staff as never);
    expect(upload.readStoredFile).toHaveBeenCalledTimes(2);
    expect(prisma.quote.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({project:expect.objectContaining({customer:expect.objectContaining({assignedToId:'owner', assignedTo:{isActive:true}})})})}));
  });
  it.each([['preview','documents.view'],['render','documents.create'],['saveSourceData','documents.create'],['getSourceData','documents.view'],['downloadById','documents.view'],['download','documents.view']] as const)('%s requires %s at the HTTP boundary', (method,permission) => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, DocumentsController.prototype[method])).toEqual([permission]);
  });
});
