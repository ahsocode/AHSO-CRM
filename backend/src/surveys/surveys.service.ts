import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, SurveyMediaKind } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { UploadService } from "../upload/upload.service";
import { AddSurveyNoteDto, CreateSurveyDto, SurveyListFilterDto, UpdateSurveyDto, UploadSurveyMediaDto } from "./dto/survey.dto";

const surveyInclude = {
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
  createdBy: {
    select: {
      id: true,
      name: true
    }
  },
  media: {
    orderBy: [{ isImportant: "desc" as const }, { createdAt: "desc" as const }]
  },
  notes: {
    include: {
      createdBy: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [{ isImportant: "desc" as const }, { createdAt: "desc" as const }]
  },
  _count: {
    select: {
      media: true,
      notes: true
    }
  }
} satisfies Prisma.SurveyInclude;

type SurveyRecord = Prisma.SurveyGetPayload<{ include: typeof surveyInclude }>;

@Injectable()
export class SurveysService {
  private readonly surveyMediaMimeTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ];
  private readonly maxSurveyMediaSize = 50 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService
  ) {}

  async findAll(filters: SurveyListFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SurveyWhereInput = {
      ...this.surveyAccessWhere(user),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" as const } },
              { location: { contains: filters.search, mode: "insensitive" as const } },
              { summary: { contains: filters.search, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            surveyedAt: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {})
            }
          }
        : {})
    };

    const [surveys, total] = await this.prisma.$transaction([
      this.prisma.survey.findMany({
        where,
        include: surveyInclude,
        orderBy: [{ surveyedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit
      }),
      this.prisma.survey.count({ where })
    ]);

    return {
      items: surveys.map((s) => this.mapSurvey(s)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async findOne(id: string, user: JwtUser) {
    const survey = await this.prisma.survey.findFirst({
      where: {
        id,
        ...this.surveyAccessWhere(user)
      },
      include: surveyInclude
    });

    if (!survey) {
      throw new NotFoundException("Không tìm thấy khảo sát");
    }

    return this.mapSurvey(survey);
  }

  async create(dto: CreateSurveyDto, user: JwtUser) {
    const link = await this.resolveSurveyLink(dto.customerId, dto.projectId, user);

    const survey = await this.prisma.survey.create({
      data: {
        title: dto.title,
        surveyedAt: dto.surveyedAt,
        location: dto.location,
        customerParticipants: dto.customerParticipants,
        objectives: dto.objectives,
        summary: dto.summary,
        nextStep: dto.nextStep,
        customerId: link.customerId,
        projectId: link.projectId,
        createdById: user.sub
      },
      include: surveyInclude
    });

    return this.mapSurvey(survey);
  }

  async update(id: string, dto: UpdateSurveyDto, user: JwtUser) {
    const current = await this.findAccessibleSurveyRecord(id, user);
    const link =
      dto.customerId || dto.projectId
        ? await this.resolveSurveyLink(dto.customerId ?? current.customerId, dto.projectId ?? current.projectId ?? undefined, user)
        : {
            customerId: current.customerId,
            projectId: current.projectId
          };

    const survey = await this.prisma.survey.update({
      where: {
        id
      },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.surveyedAt !== undefined ? { surveyedAt: dto.surveyedAt } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.customerParticipants !== undefined ? { customerParticipants: dto.customerParticipants } : {}),
        ...(dto.objectives !== undefined ? { objectives: dto.objectives } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
        ...(dto.nextStep !== undefined ? { nextStep: dto.nextStep } : {}),
        ...(dto.customerId !== undefined || dto.projectId !== undefined
          ? {
              customerId: link.customerId,
              projectId: link.projectId
            }
          : {})
      },
      include: surveyInclude
    });

    return this.mapSurvey(survey);
  }

  async addNote(id: string, dto: AddSurveyNoteDto, user: JwtUser) {
    await this.findAccessibleSurveyRecord(id, user);

    const note = await this.prisma.surveyNote.create({
      data: {
        surveyId: id,
        type: dto.type,
        content: dto.content,
        isImportant: dto.isImportant,
        createdById: user.sub
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return {
      id: note.id,
      surveyId: note.surveyId,
      type: note.type,
      content: note.content,
      isImportant: note.isImportant,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      createdBy: note.createdBy
    };
  }

  async addMedia(id: string, file: Express.Multer.File, dto: UploadSurveyMediaDto, user: JwtUser) {
    await this.findAccessibleSurveyRecord(id, user);
    this.ensureSurveyMediaFile(file);

    const upload = await this.uploadService.saveFile(file, `surveys/${id}`);
    const media = await this.prisma.surveyMedia.create({
      data: {
        surveyId: id,
        kind: this.resolveMediaKind(file.mimetype),
        url: upload.url,
        filename: upload.filename,
        mimeType: upload.mimeType,
        size: upload.size,
        caption: dto.caption,
        area: dto.area,
        isImportant: dto.isImportant,
        uploadedById: user.sub
      }
    });

    return {
      id: media.id,
      surveyId: media.surveyId,
      kind: media.kind,
      url: media.url,
      filename: media.filename,
      mimeType: media.mimeType,
      size: media.size,
      caption: media.caption,
      area: media.area,
      isImportant: media.isImportant,
      createdAt: media.createdAt
    };
  }

  async downloadMedia(mediaId: string, user: JwtUser) {
    const media = await this.prisma.surveyMedia.findFirst({
      where: {
        id: mediaId,
        survey: this.surveyAccessWhere(user)
      },
      select: {
        filename: true,
        mimeType: true,
        url: true
      }
    });

    if (!media) {
      throw new NotFoundException("Không tìm thấy media khảo sát");
    }

    const storedFile = await this.uploadService.readStoredFile(media.url);
    if (!storedFile) {
      throw new NotFoundException("Không tìm thấy file media khảo sát trên hệ thống lưu trữ");
    }

    return {
      buffer: storedFile.buffer,
      filename: media.filename,
      mimeType: media.mimeType || storedFile.mimeType
    };
  }

  async listByProject(projectId: string, user: JwtUser) {
    await this.assertProjectAccess(projectId, user);

    const surveys = await this.prisma.survey.findMany({
      where: {
        projectId
      },
      include: surveyInclude,
      orderBy: [{ surveyedAt: "desc" }, { createdAt: "desc" }]
    });

    return surveys.map((survey) => this.mapSurvey(survey));
  }

  private async resolveSurveyLink(customerId: string, projectId: string | undefined, user: JwtUser) {
    if (projectId) {
      const project = await this.assertProjectAccess(projectId, user);

      if (customerId && project.customerId !== customerId) {
        throw new BadRequestException("Khảo sát phải gắn với đúng khách hàng của dự án");
      }

      return {
        customerId: project.customerId,
        projectId: project.id
      };
    }

    await this.assertCustomerAccess(customerId, user);

    return {
      customerId,
      projectId: null
    };
  }

  private async assertProjectAccess(projectId: string, user: JwtUser) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        customer: {
          deletedAt: null,
          ...(isStaff(user) ? { assignedToId: user.sub } : {})
        }
      },
      select: {
        id: true,
        customerId: true
      }
    });

    if (!project) {
      throw new NotFoundException("Không tìm thấy dự án để gắn khảo sát");
    }

    return project;
  }

  private surveyAccessWhere(user: JwtUser): Prisma.SurveyWhereInput {
    return {
      OR: [
        {
          project: {
            deletedAt: null,
            customer: this.customerAccessWhere(user)
          }
        },
        {
          projectId: null,
          customer: this.customerAccessWhere(user)
        }
      ]
    };
  }

  private async assertCustomerAccess(customerId: string, user: JwtUser) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        deletedAt: null,
        ...(isStaff(user) ? { assignedToId: user.sub } : {})
      },
      select: {
        id: true
      }
    });

    if (!customer) {
      throw new NotFoundException("Không tìm thấy khách hàng để gắn khảo sát");
    }

    return customer;
  }

  private customerAccessWhere(user: JwtUser): Prisma.CustomerWhereInput {
    return {
      deletedAt: null,
      ...(isStaff(user) ? { assignedToId: user.sub } : {})
    };
  }

  private async findAccessibleSurveyRecord(id: string, user: JwtUser) {
    const survey = await this.prisma.survey.findFirst({
      where: {
        id,
        customer: {
          deletedAt: null,
          ...(isStaff(user) ? { assignedToId: user.sub } : {})
        }
      },
      select: {
        id: true,
        customerId: true,
        projectId: true
      }
    });

    if (!survey) {
      throw new NotFoundException("Không tìm thấy khảo sát");
    }

    return survey;
  }

  private ensureSurveyMediaFile(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Không có tệp khảo sát được tải lên");
    }

    if (!this.surveyMediaMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException("Media khảo sát chỉ chấp nhận ảnh, video MP4/WEBM/MOV, PDF, DOCX hoặc XLSX");
    }

    if (file.size > this.maxSurveyMediaSize) {
      throw new BadRequestException("Media khảo sát vượt quá 50MB");
    }
  }

  private resolveMediaKind(mimeType: string): SurveyMediaKind {
    if (mimeType.startsWith("image/")) {
      return "IMAGE";
    }

    if (mimeType.startsWith("video/")) {
      return "VIDEO";
    }

    return "FILE";
  }

  private mapSurvey(survey: SurveyRecord) {
    return {
      id: survey.id,
      title: survey.title,
      surveyedAt: survey.surveyedAt,
      location: survey.location,
      customerParticipants: survey.customerParticipants,
      objectives: survey.objectives,
      summary: survey.summary,
      nextStep: survey.nextStep,
      customerId: survey.customerId,
      projectId: survey.projectId,
      createdAt: survey.createdAt,
      updatedAt: survey.updatedAt,
      customer: survey.customer,
      project: survey.project,
      createdBy: survey.createdBy,
      media: survey.media.map((media) => ({
        id: media.id,
        surveyId: media.surveyId,
        kind: media.kind,
        url: media.url,
        filename: media.filename,
        mimeType: media.mimeType,
        size: media.size,
        caption: media.caption,
        area: media.area,
        isImportant: media.isImportant,
        createdAt: media.createdAt
      })),
      notes: survey.notes.map((note) => ({
        id: note.id,
        surveyId: note.surveyId,
        type: note.type,
        content: note.content,
        isImportant: note.isImportant,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        createdBy: note.createdBy
      })),
      counts: {
        media: survey._count.media,
        notes: survey._count.notes
      }
    };
  }
}
