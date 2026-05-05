import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { UploadService } from "../upload/upload.service";
import { BusinessDocumentsService } from "./business-documents.service";

describe("BusinessDocumentsService", () => {
  const managerUser = {
    sub: "manager-1",
    email: "manager@ahso.vn",
    name: "Manager",
    role: {
      id: "role-manager",
      name: "MANAGER",
      permissions: ["documents.view", "documents.create", "documents.edit"]
    },
    permissions: ["documents.view", "documents.create", "documents.edit"]
  };

  const staffUser = {
    sub: "staff-1",
    email: "staff@ahso.vn",
    name: "Staff",
    role: {
      id: "role-staff",
      name: "STAFF",
      permissions: ["documents.view"]
    },
    permissions: ["documents.view"]
  };

  let service: BusinessDocumentsService;
  let prisma: {
    businessDocument: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    project: {
      findFirst: jest.Mock;
    };
    customer: {
      findFirst: jest.Mock;
    };
    quote: {
      findFirst: jest.Mock;
    };
    contract: {
      findFirst: jest.Mock;
    };
    payment: {
      findFirst: jest.Mock;
    };
    document: {
      findFirst: jest.Mock;
    };
  };
  let uploadService: {
    saveFile: jest.Mock;
    deleteFile: jest.Mock;
    readStoredFile: jest.Mock;
    validateFileType: jest.Mock;
    validateFileSize: jest.Mock;
  };

  const mappedDocument = {
    id: "doc-1",
    type: "CUSTOMER_PO",
    source: "RECEIVED",
    status: "RECEIVED",
    title: "PO khách hàng",
    documentNo: "PO-001",
    documentDate: new Date("2026-04-25T00:00:00.000Z"),
    fileUrl: null,
    filename: null,
    mimeType: null,
    size: null,
    notes: null,
    customerId: "customer-1",
    projectId: "project-1",
    quoteId: null,
    contractId: null,
    paymentId: null,
    generatedDocumentId: null,
    parentId: null,
    createdAt: new Date("2026-04-25T01:00:00.000Z"),
    updatedAt: new Date("2026-04-25T01:00:00.000Z"),
    customer: { id: "customer-1", name: "Khách hàng A", shortName: null },
    project: { id: "project-1", code: "PRJ-001", name: "Dự án A" },
    quote: null,
    contract: null,
    payment: null,
    generatedDocument: null,
    parent: null,
    createdBy: { id: "manager-1", name: "Manager" }
  };

  beforeEach(() => {
    prisma = {
      businessDocument: {
        create: jest.fn().mockResolvedValue(mappedDocument),
        update: jest.fn().mockResolvedValue(mappedDocument),
        delete: jest.fn().mockResolvedValue({ id: "doc-1" }),
        findMany: jest.fn().mockResolvedValue([mappedDocument]),
        findFirst: jest.fn()
      },
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: "project-1", customerId: "customer-1" })
      },
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: "customer-1" })
      },
      quote: {
        findFirst: jest.fn()
      },
      contract: {
        findFirst: jest.fn()
      },
      payment: {
        findFirst: jest.fn()
      },
      document: {
        findFirst: jest.fn()
      }
    };
    uploadService = {
      saveFile: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      readStoredFile: jest.fn(),
      validateFileType: jest.fn().mockReturnValue(true),
      validateFileSize: jest.fn().mockReturnValue(true)
    };

    service = new BusinessDocumentsService(
      prisma as unknown as PrismaService,
      uploadService as unknown as UploadService
    );
  });

  it("creates a project-linked business document after resolving project access", async () => {
    await expect(
      service.create(
        {
          type: "CUSTOMER_PO",
          source: "RECEIVED",
          status: "RECEIVED",
          title: "PO khách hàng",
          projectId: "project-1"
        },
        managerUser
      )
    ).resolves.toMatchObject({
      id: "doc-1",
      customerId: "customer-1",
      projectId: "project-1"
    });

    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "project-1",
          deletedAt: null
        })
      })
    );
    expect(prisma.businessDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "customer-1",
          projectId: "project-1",
          createdById: "manager-1"
        })
      })
    );
  });

  it("rejects documents without any business link", async () => {
    await expect(
      service.create(
        {
          type: "OTHER",
          source: "RECEIVED",
          status: "RECEIVED",
          title: "Tài liệu rời"
        },
        managerUser
      )
    ).rejects.toEqual(
      new BadRequestException("Tài liệu cần được gắn với khách hàng, dự án, báo giá, hợp đồng hoặc thanh toán")
    );
  });

  it("scopes staff project access to assigned customers", async () => {
    await service.listByProject("project-1", staffUser);

    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "project-1",
          deletedAt: null,
          customer: {
            deletedAt: null,
            assignedToId: "staff-1"
          }
        })
      })
    );
  });

  it("downloads only accessible documents that have a stored file", async () => {
    prisma.businessDocument.findFirst.mockResolvedValue({
      id: "doc-1",
      title: "PO khách hàng",
      fileUrl: "/uploads/business-documents/po.pdf",
      filename: "po.pdf",
      mimeType: "application/pdf",
      notes: null
    });
    uploadService.readStoredFile.mockResolvedValue({
      buffer: Buffer.from("pdf"),
      mimeType: "application/pdf"
    });

    await expect(service.downloadFile("doc-1", managerUser)).resolves.toEqual({
      buffer: Buffer.from("pdf"),
      filename: "po.pdf",
      mimeType: "application/pdf"
    });
  });

  it("returns a clear error when the document has no file attachment", async () => {
    prisma.businessDocument.findFirst.mockResolvedValue({
      id: "doc-1",
      title: "PO khách hàng",
      fileUrl: null,
      filename: null,
      mimeType: null,
      notes: null
    });

    await expect(service.downloadFile("doc-1", managerUser)).rejects.toEqual(
      new NotFoundException("Tài liệu này chưa có file đính kèm")
    );
  });

  it("cleans up the previous local file after replacing an attachment", async () => {
    prisma.businessDocument.findFirst.mockResolvedValue({
      id: "doc-1",
      title: "PO khách hàng",
      fileUrl: "/uploads/business-documents/old.pdf",
      filename: "old.pdf",
      mimeType: "application/pdf",
      notes: null
    });
    uploadService.saveFile.mockResolvedValue({
      url: "/uploads/business-documents/new.pdf",
      filename: "new.pdf",
      mimeType: "application/pdf",
      size: 1234
    });
    prisma.businessDocument.update.mockResolvedValue({
      ...mappedDocument,
      fileUrl: "/uploads/business-documents/new.pdf",
      filename: "new.pdf",
      mimeType: "application/pdf",
      size: 1234
    });

    await service.uploadFile(
      "doc-1",
      {
        mimetype: "application/pdf",
        size: 1234
      } as Express.Multer.File,
      {},
      managerUser
    );

    expect(uploadService.deleteFile).toHaveBeenCalledWith("/uploads/business-documents/old.pdf");
  });
});
