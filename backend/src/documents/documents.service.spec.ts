import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { DocumentDataLoaderService } from "./document-data-loader.service";
import { DocumentLayoutRendererService } from "./document-layout-renderer.service";
import { DocumentNumberService } from "./document-number.service";
import { DocumentTemplateVariantsService } from "./document-template-variants.service";
import { DocumentsService } from "./documents.service";
import { I18nService } from "./i18n.service";
import { PdfRendererService } from "./pdf-renderer.service";
import { QuotationFlowHtmlRendererService } from "./quotation-flow-html-renderer.service";
import { UploadService } from "../upload/upload.service";

describe("DocumentsService", () => {
  const user = {
    sub: "admin-1",
    email: "admin@ahso.vn",
    name: "Admin",
    role: "ADMIN" as const,
    permissions: []
  };

  let service: DocumentsService;
  let prisma: {
    document: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let documentNumbers: {
    reserveWithRetry: jest.Mock;
  };
  let pdfRenderer: {
    render: jest.Mock;
  };
  let uploadService: {
    saveBuffer: jest.Mock;
    readStoredFile: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      document: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn()
      }
    };
    documentNumbers = {
      reserveWithRetry: jest.fn(async (_type, _customerCode, _version, attempt) => {
        await attempt("BG-2026-AHSO-001-v1", 1);
        return "BG-2026-AHSO-001-v1";
      })
    };
    pdfRenderer = {
      render: jest.fn().mockResolvedValue(Buffer.from("pdf-binary"))
    };
    uploadService = {
      saveBuffer: jest.fn().mockResolvedValue({
        url: "/uploads/documents/generated.pdf",
        filename: "generated.pdf",
        size: 10,
        mimeType: "application/pdf"
      }),
      readStoredFile: jest.fn().mockResolvedValue({
        buffer: Buffer.from("stored-pdf"),
        mimeType: "application/pdf",
        absolutePath: "/tmp/generated.pdf"
      })
    };

    service = new DocumentsService(
      prisma as unknown as PrismaService,
      {} as DocumentDataLoaderService,
      documentNumbers as unknown as DocumentNumberService,
      pdfRenderer as unknown as PdfRendererService,
      {} as I18nService,
      {} as DocumentTemplateVariantsService,
      {} as DocumentLayoutRendererService,
      {} as QuotationFlowHtmlRendererService,
      uploadService as unknown as UploadService
    );


    (service as unknown as { initialized: boolean }).initialized = true;
    jest.spyOn(service as any, "buildRenderContext").mockResolvedValue({
      entry: {
        type: "QUOTATION",
        label: "Báo giá",
        templateDir: "QUOTATION",
        prefix: "BG",
        style: "modern",
        entityType: "quote",
        loaderMethod: "loadForQuotation",
        phase: 1,
        runtimeStatus: "production",
        endUserEnabled: true
      },
      title: "BÁO GIÁ",
      context: {
        customer: {
          id: "customer-1",
          code: "AHSO"
        }
      }
    } as never);
    jest
      .spyOn(service as any, "renderHtml")
      .mockResolvedValue("<html><body>pdf</body></html>" as never);
  });

  it("renders once, stores a PDF file and creates exactly one document record", async () => {
    prisma.document.create.mockResolvedValue({
      id: "document-1"
    });
    prisma.document.update.mockResolvedValue({
      id: "document-1",
      pdfPath: "/uploads/documents/generated.pdf"
    });

    await expect(
      service.renderPdf("QUOTATION", "quote-1", "vi", undefined, undefined, user)
    ).resolves.toMatchObject({
      documentId: "document-1",
      number: "BG-2026-AHSO-001-v1",
      downloadUrl: "/api/documents/document-1/download"
    });

    expect(documentNumbers.reserveWithRetry).toHaveBeenCalledTimes(1);
    expect(prisma.document.create).toHaveBeenCalledTimes(1);
    expect(uploadService.saveBuffer).toHaveBeenCalledWith(Buffer.from("pdf-binary"), {
      originalName: "BG-2026-AHSO-001-v1.pdf",
      mimeType: "application/pdf",
      subfolder: "documents"
    });
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "document-1" },
      data: {
        pdfPath: "/uploads/documents/generated.pdf"
      }
    });
  });

  it("downloads an existing document by id without creating a new record", async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: "document-1",
      number: "BG-2026-AHSO-001-v1",
      pdfPath: "/uploads/documents/generated.pdf"
    });

    await expect(service.downloadDocument("document-1", user)).resolves.toEqual({
      buffer: Buffer.from("stored-pdf"),
      filename: "BG-2026-AHSO-001-v1.pdf",
      mimeType: "application/pdf"
    });

    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(uploadService.readStoredFile).toHaveBeenCalledWith("/uploads/documents/generated.pdf");
  });

  it("fails legacy download when the entity has never been rendered", async () => {
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(service.downloadLatest("QUOTATION", "quote-404", "vi", user)).rejects.toThrow(
      new NotFoundException("Chưa render tài liệu cho đối tượng này.")
    );

    expect(documentNumbers.reserveWithRetry).not.toHaveBeenCalled();
    expect(pdfRenderer.render).not.toHaveBeenCalled();
  });
});
