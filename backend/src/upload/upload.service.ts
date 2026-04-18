import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class UploadService {
  private readonly allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg"
  ];

  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor(private configService: ConfigService) {}

  validateFileType(mimetype: string): boolean {
    return this.allowedMimeTypes.includes(mimetype);
  }

  validateFileSize(size: number): boolean {
    return size <= this.maxFileSize;
  }

  getFileDirectory(userId: string): string {
    const uploadDir = this.configService.get<string>("UPLOAD_DIR") ?? "./uploads";
    const userDir = path.join(uploadDir, userId);

    // Ensure directory exists
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    return userDir;
  }

  generateFileName(originalName: string): string {
    const timestamp = Date.now();
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    return `${timestamp}-${name}${ext}`;
  }

  getFileUrl(userId: string, filename: string): string {
    return `/api/upload/${userId}/${filename}`;
  }

  async saveFile(userId: string, file: Express.Multer.File): Promise<{url: string; filename: string; size: number; uploadedAt: string}> {
    const userDir = this.getFileDirectory(userId);
    const filename = this.generateFileName(file.originalname);
    const filepath = path.join(userDir, filename);

    fs.writeFileSync(filepath, file.buffer);

    return {
      url: this.getFileUrl(userId, filename),
      filename,
      size: file.size,
      uploadedAt: new Date().toISOString()
    };
  }

  deleteFile(userId: string, filename: string): boolean {
    const userDir = this.getFileDirectory(userId);
    const filepath = path.join(userDir, filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }

    return false;
  }

  getFileStream(userId: string, filename: string) {
    const userDir = this.getFileDirectory(userId);
    const filepath = path.join(userDir, filename);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    return fs.createReadStream(filepath);
  }
}
