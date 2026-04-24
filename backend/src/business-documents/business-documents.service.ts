import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { UploadService } from "../upload/upload.service";
import {
  BusinessDocumentFileDto,
  CreateBusinessDocumentDto,
  SupersedeBusinessDocumentDto,
  UpdateBusinessDocumentDto
} from "./dto/business-document.dto";

const businessDocumentInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      shortName: true
    }
  },
  project: {
    select: {
      id: true,
      code: true,
      name: true
    }
  },
  quote: {
    select: {
      id: true,
      quoteNo: true,
      version: true
    }
  },
  contract: {
    select: {
      id: true,
      contractNo: true
    }
  },
  payment: {
    select: {
      id: true,
      amount: true,
      paidAt: true
    }
  },
  generatedDocument: {
    select: {
      id: true,
      number: true,
      pdfPath: true
    }
  },
  parent: {
    select: {
      id: true,
      title: true,
      status: true
    }
  },
  createdBy: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.BusinessDocumentInclude;

type BusinessDocumentRecord = Prisma.BusinessDocumentGetPayload<{ include: typeof businessDocumentInclude }>;

@Injectable()
export class BusinessDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService
  ) {}

  async create(dto: CreateBusinessDocumentDto, user: JwtUser) {
    const link = await this.resolveBusinessLink(dto, user);
    await this.assertLinkedDocumentAccess(dto, user);

    const document = await this.prisma.businessDocument.create({
      data: {
        type: dto.type,
        source: dto.source,
        status: dto.status,
        title: dto.title,
        documentNo: dto.documentNo,
        documentDate: dto.documentDate,
        notes: dto.notes,
        customerId: link.customerId,
        projectId: link.projectId,
        quoteId: link.quoteId,
        contractId: link.contractId,
        paymentId: link.paymentId,
        generatedDocumentId: dto.generatedDocumentId,
        parentId: dto.parentId,
        createdById: user.sub
      },
      include: businessDocumentInclude
    });

    return this.mapDocument(document);
  }

  async update(id: string, dto: UpdateBusinessDocumentDto, user: JwtUser) {
    await this.findAccessibleDocumentRecord(id, user);
    const link = this.hasLinkUpdate(dto) ? await this.resolveBusinessLink(dto, user) : null;
    await this.assertLinkedDocumentAccess(dto, user);

    const document = await this.prisma.businessDocument.update({
      where: {
        id
      },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.source !== undefined ? { source: dto.source } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.documentNo !== undefined ? { documentNo: dto.documentNo } : {}),
        ...(dto.documentDate !== undefined ? { documentDate: dto.documentDate } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.generatedDocumentId !== undefined ? { generatedDocumentId: dto.generatedDocumentId } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(link
          ? {
              customerId: link.customerId,
              projectId: link.projectId,
              quoteId: link.quoteId,
              contractId: link.contractId,
              paymentId: link.paymentId
            }
          : {})
      },
      include: businessDocumentInclude
    });

    return this.mapDocument(document);
  }

  async uploadFile(id: string, file: Express.Multer.File, dto: BusinessDocumentFileDto, user: JwtUser) {
    const current = await this.findAccessibleDocumentRecord(id, user);
    this.ensureBusinessFile(file);

    const upload = await this.uploadService.saveFile(file, "business-documents");
    let document: BusinessDocumentRecord;

    try {
      document = await this.prisma.businessDocument.update({
        where: {
          id
        },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.documentNo !== undefined ? { documentNo: dto.documentNo } : {}),
          ...(dto.documentDate !== undefined ? { documentDate: dto.documentDate } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          fileUrl: upload.url,
          filename: upload.filename,
          mimeType: upload.mimeType,
          size: upload.size
        },
        include: businessDocumentInclude
      });
    } catch (error) {
      await this.uploadService.deleteFile(upload.url);
      throw error;
    }

    if (current.fileUrl && current.fileUrl !== upload.url) {
      await this.uploadService.deleteFile(current.fileUrl);
    }

    return this.mapDocument(document);
  }

  async downloadFile(id: string, user: JwtUser) {
    const document = await this.findAccessibleDocumentRecord(id, user);

    if (!document.fileUrl) {
      throw new NotFoundException("Tài liệu này chưa có file đính kèm");
    }

    const storedFile = await this.uploadService.readStoredFile(document.fileUrl);
    if (!storedFile) {
      throw new NotFoundException("Không tìm thấy file tài liệu trên hệ thống lưu trữ");
    }

    return {
      buffer: storedFile.buffer,
      filename: document.filename ?? `${document.title}.bin`,
      mimeType: document.mimeType ?? storedFile.mimeType
    };
  }

  async markSigned(id: string, user: JwtUser) {
    await this.findAccessibleDocumentRecord(id, user);

    const document = await this.prisma.businessDocument.update({
      where: {
        id
      },
      data: {
        status: "SIGNED",
        source: "SIGNED_UPLOAD"
      },
      include: businessDocumentInclude
    });

    return this.mapDocument(document);
  }

  async supersede(id: string, dto: SupersedeBusinessDocumentDto, user: JwtUser) {
    const current = await this.findAccessibleDocumentRecord(id, user);

    if (dto.nextDocumentId) {
      await this.findAccessibleDocumentRecord(dto.nextDocumentId, user);
    }

    const document = await this.prisma.businessDocument.update({
      where: {
        id
      },
      data: {
        status: "SUPERSEDED",
        notes: dto.reason ? [current.notes, `Lý do thay thế: ${dto.reason}`].filter(Boolean).join("\n") : current.notes
      },
      include: businessDocumentInclude
    });

    if (dto.nextDocumentId) {
      await this.prisma.businessDocument.update({
        where: {
          id: dto.nextDocumentId
        },
        data: {
          parentId: id
        }
      });
    }

    return this.mapDocument(document);
  }

  async remove(id: string, user: JwtUser) {
    const current = await this.findAccessibleDocumentRecord(id, user);

    await this.prisma.businessDocument.delete({
      where: { id }
    });

    if (current.fileUrl) {
      await this.uploadService.deleteFile(current.fileUrl);
    }

    return { success: true };
  }

  async listByProject(projectId: string, user: JwtUser) {
    await this.assertProjectAccess(projectId, user);

    const documents = await this.prisma.businessDocument.findMany({
      where: {
        OR: [
          { projectId },
          { quote: { projectId } },
          { contract: { projectId } },
          { payment: { contract: { projectId } } }
        ]
      },
      include: businessDocumentInclude,
      orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }]
    });

    return documents.map((document) => this.mapDocument(document));
  }

  private async resolveBusinessLink(dto: Partial<CreateBusinessDocumentDto>, user: JwtUser) {
    let projectId = dto.projectId ?? null;
    let customerId = dto.customerId ?? null;
    const quoteId = dto.quoteId ?? null;
    let contractId = dto.contractId ?? null;
    const paymentId = dto.paymentId ?? null;

    if (paymentId) {
      const payment = await this.prisma.payment.findFirst({
        where: {
          id: paymentId,
          contract: {
            project: this.projectAccessWhere(user)
          }
        },
        select: {
          id: true,
          contract: {
            select: {
              id: true,
              projectId: true,
              project: {
                select: {
                  customerId: true
                }
              }
            }
          }
        }
      });

      if (!payment) {
        throw new NotFoundException("Không tìm thấy thanh toán để gắn tài liệu");
      }

      contractId = payment.contract.id;
      projectId = payment.contract.projectId;
      customerId = payment.contract.project.customerId;
    }

    if (contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: {
          id: contractId,
          project: this.projectAccessWhere(user)
        },
        select: {
          id: true,
          projectId: true,
          project: {
            select: {
              customerId: true
            }
          }
        }
      });

      if (!contract) {
        throw new NotFoundException("Không tìm thấy hợp đồng để gắn tài liệu");
      }

      projectId = contract.projectId;
      customerId = contract.project.customerId;
    }

    if (quoteId) {
      const quote = await this.prisma.quote.findFirst({
        where: {
          id: quoteId,
          project: this.projectAccessWhere(user)
        },
        select: {
          id: true,
          projectId: true,
          project: {
            select: {
              customerId: true
            }
          }
        }
      });

      if (!quote) {
        throw new NotFoundException("Không tìm thấy báo giá để gắn tài liệu");
      }

      projectId = quote.projectId;
      customerId = quote.project.customerId;
    }

    if (projectId) {
      const project = await this.assertProjectAccess(projectId, user);
      customerId = project.customerId;
    }

    if (!projectId && customerId) {
      await this.assertCustomerAccess(customerId, user);
    }

    if (!projectId && !customerId && !quoteId && !contractId && !paymentId) {
      throw new BadRequestException("Tài liệu cần được gắn với khách hàng, dự án, báo giá, hợp đồng hoặc thanh toán");
    }

    return {
      customerId,
      projectId,
      quoteId,
      contractId,
      paymentId
    };
  }

  private async assertLinkedDocumentAccess(
    dto: Partial<Pick<CreateBusinessDocumentDto, "generatedDocumentId" | "parentId">>,
    user: JwtUser
  ) {
    if (dto.generatedDocumentId) {
      const generatedDocument = await this.prisma.document.findFirst({
        where: {
          id: dto.generatedDocumentId,
          ...this.documentAccessWhere(user)
        },
        select: { id: true }
      });

      if (!generatedDocument) {
        throw new NotFoundException("Không tìm thấy tài liệu hệ thống để liên kết");
      }
    }

    if (dto.parentId) {
      await this.findAccessibleDocumentRecord(dto.parentId, user);
    }
  }

  private async findAccessibleDocumentRecord(id: string, user: JwtUser) {
    const document = await this.prisma.businessDocument.findFirst({
      where: {
        id,
        OR: [
          { project: this.projectAccessWhere(user) },
          { quote: { project: this.projectAccessWhere(user) } },
          { contract: { project: this.projectAccessWhere(user) } },
          { payment: { contract: { project: this.projectAccessWhere(user) } } },
          { customer: this.customerAccessWhere(user) }
        ]
      },
      select: {
        id: true,
        fileUrl: true,
        filename: true,
        mimeType: true,
        title: true,
        notes: true
      }
    });

    if (!document) {
      throw new NotFoundException("Không tìm thấy tài liệu nghiệp vụ");
    }

    return document;
  }

  private async assertProjectAccess(projectId: string, user: JwtUser) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...this.projectAccessWhere(user)
      },
      select: {
        id: true,
        customerId: true
      }
    });

    if (!project) {
      throw new NotFoundException("Không tìm thấy dự án để gắn tài liệu");
    }

    return project;
  }

  private async assertCustomerAccess(customerId: string, user: JwtUser) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        ...this.customerAccessWhere(user)
      },
      select: {
        id: true
      }
    });

    if (!customer) {
      throw new NotFoundException("Không tìm thấy khách hàng để gắn tài liệu");
    }

    return customer;
  }

  private projectAccessWhere(user: JwtUser): Prisma.ProjectWhereInput {
    return {
      deletedAt: null,
      customer: this.customerAccessWhere(user)
    };
  }

  private customerAccessWhere(user: JwtUser): Prisma.CustomerWhereInput {
    return {
      deletedAt: null,
      ...(isStaff(user) ? { assignedToId: user.sub } : {})
    };
  }

  private documentAccessWhere(user: JwtUser): Prisma.DocumentWhereInput {
    if (!isStaff(user)) {
      return {};
    }

    return {
      customer: this.customerAccessWhere(user)
    };
  }

  private hasLinkUpdate(dto: UpdateBusinessDocumentDto) {
    return Boolean(dto.customerId || dto.projectId || dto.quoteId || dto.contractId || dto.paymentId);
  }

  private ensureBusinessFile(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Không có tài liệu được tải lên");
    }

    if (!this.uploadService.validateFileType(file.mimetype)) {
      throw new BadRequestException("Tài liệu chỉ chấp nhận PDF, PNG, JPG, XLSX hoặc DOCX");
    }

    if (!this.uploadService.validateFileSize(file.size)) {
      throw new BadRequestException("Kích thước tài liệu vượt quá 10MB");
    }
  }

  private mapDocument(document: BusinessDocumentRecord) {
    return {
      id: document.id,
      type: document.type,
      source: document.source,
      status: document.status,
      title: document.title,
      documentNo: document.documentNo,
      documentDate: document.documentDate,
      fileUrl: document.fileUrl,
      filename: document.filename,
      mimeType: document.mimeType,
      size: document.size,
      notes: document.notes,
      customerId: document.customerId,
      projectId: document.projectId,
      quoteId: document.quoteId,
      contractId: document.contractId,
      paymentId: document.paymentId,
      generatedDocumentId: document.generatedDocumentId,
      parentId: document.parentId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      customer: document.customer,
      project: document.project,
      quote: document.quote,
      contract: document.contract,
      payment: document.payment
        ? {
            ...document.payment,
            amount: Number(document.payment.amount)
          }
        : null,
      generatedDocument: document.generatedDocument,
      parent: document.parent,
      createdBy: document.createdBy
    };
  }
}
