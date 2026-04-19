import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../common/prisma.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UploadService } from "./upload.service";

@Controller("upload")
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser
  ) {
    void user;
    this.ensureFilePresent(file);
    this.ensureAllowedFile(file);
    return this.uploadService.saveFile(file, "files");
  }

  @Post("file")
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser
  ) {
    void user;
    this.ensureFilePresent(file);
    this.ensureAllowedFile(file);
    return this.uploadService.saveFile(file, "files");
  }

  @Post("logo")
  @UseInterceptors(FileInterceptor("file"))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser
  ) {
    this.ensureFilePresent(file);
    this.ensureAdmin(user);

    if (!this.uploadService.validateLogoType(file.mimetype)) {
      throw new BadRequestException("Logo chỉ chấp nhận PNG, JPG, SVG hoặc WEBP");
    }

    if (!this.uploadService.validateLogoSize(file.size)) {
      throw new BadRequestException("Kích thước logo vượt quá 5MB");
    }

    const previousLogo = await this.prisma.logo.findFirst({
      orderBy: {
        uploadedAt: "desc"
      }
    });
    const nextLogo = await this.uploadService.saveFile(file, "logos");

    try {
      const createdLogo = await this.prisma.logo.create({
        data: {
          url: nextLogo.url,
          filename: nextLogo.filename
        }
      });

      await this.prisma.setting.upsert({
        where: {
          key: "logo:url"
        },
        create: {
          key: "logo:url",
          value: JSON.stringify(nextLogo.url),
          description: "Company logo URL"
        },
        update: {
          value: JSON.stringify(nextLogo.url),
          description: "Company logo URL"
        }
      });

      if (previousLogo?.url && previousLogo.url !== nextLogo.url) {
        await this.uploadService.deleteFile(previousLogo.url);
      }

      return {
        ...nextLogo,
        id: createdLogo.id,
        uploadedAt: createdLogo.uploadedAt.toISOString()
      };
    } catch (error) {
      await this.uploadService.deleteFile(nextLogo.url);
      throw error;
    }
  }

  private ensureFilePresent(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Không có tệp được tải lên");
    }
  }

  private ensureAllowedFile(file: Express.Multer.File) {
    if (!this.uploadService.validateFileType(file.mimetype)) {
      throw new BadRequestException("Tệp chỉ chấp nhận PDF, PNG, JPG, XLSX hoặc DOCX");
    }

    if (!this.uploadService.validateFileSize(file.size)) {
      throw new BadRequestException("Kích thước tệp vượt quá 10MB");
    }
  }

  private ensureAdmin(user: JwtUser) {
    const roleValue = user.role as string | { name?: string };
    const roleName = typeof roleValue === "string" ? roleValue : roleValue?.name;

    if (roleName !== "ADMIN") {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
    }
  }
}
