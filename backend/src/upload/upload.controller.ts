import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Param,
  Res,
  BadRequestException,
  NotFoundException,
  HttpStatus
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UploadService } from "./upload.service";
import { JwtUser } from "../auth/auth.types";

@Controller("upload")
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser
  ) {
    if (!file) {
      throw new BadRequestException("Không có tệp được tải lên");
    }

    if (!this.uploadService.validateFileType(file.mimetype)) {
      throw new BadRequestException(
        "Loại tệp không được hỗ trợ. Chỉ chấp nhận: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG"
      );
    }

    if (!this.uploadService.validateFileSize(file.size)) {
      throw new BadRequestException("Kích thước tệp vượt quá 10MB");
    }

    const uploadResult = await this.uploadService.saveFile(user.sub, file);

    return {
      data: uploadResult,
      meta: null
    };
  }

  @Get(":userId/:filename")
  async download(
    @Param("userId") userId: string,
    @Param("filename") filename: string,
    @CurrentUser() user: JwtUser,
    @Res() res: Response
  ) {
    // Authorization: only user can download their own files
    if (userId !== user.sub) {
      throw new BadRequestException("Không có quyền truy cập tệp này");
    }

    const fileStream = this.uploadService.getFileStream(userId, filename);

    if (!fileStream) {
      throw new NotFoundException("Tệp không tồn tại");
    }

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    fileStream.pipe(res);
  }

  @Delete(":userId/:filename")
  async delete(
    @Param("userId") userId: string,
    @Param("filename") filename: string,
    @CurrentUser() user: JwtUser
  ) {
    // Authorization: only user can delete their own files
    if (userId !== user.sub) {
      throw new BadRequestException("Không có quyền xoá tệp này");
    }

    const success = this.uploadService.deleteFile(userId, filename);

    if (!success) {
      throw new NotFoundException("Tệp không tồn tại");
    }

    return {
      data: { success: true, message: "Tệp đã được xoá" },
      meta: null
    };
  }
}
