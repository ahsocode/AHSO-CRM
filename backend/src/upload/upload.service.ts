import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import { extname, isAbsolute, join, normalize, resolve } from "path";
import type { UploadResponseDto } from "./dto/upload-response.dto";

@Injectable()
export class UploadService {
  readonly logoMimeTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] as const;
  readonly avatarMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
  readonly fileMimeTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg"
  ] as const;
  readonly maxLogoSize = 5 * 1024 * 1024;
  readonly maxAvatarSize = 5 * 1024 * 1024;
  readonly maxFileSize = 10 * 1024 * 1024;
  private readonly dangerousExtensions = new Set([".html", ".htm", ".php", ".exe", ".sh"]);

  private readonly extensionMap: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp"
  };

  constructor(private readonly configService: ConfigService) {}

  validateLogoType(fileOrMimeType: Express.Multer.File | string) {
    return this.validateDeclaredType(fileOrMimeType, this.logoMimeTypes);
  }

  validateFileType(fileOrMimeType: Express.Multer.File | string) {
    return this.validateDeclaredType(fileOrMimeType, this.fileMimeTypes);
  }

  validateLogoSize(size: number) {
    return size <= this.maxLogoSize;
  }

  validateAvatarType(fileOrMimeType: Express.Multer.File | string) {
    return this.validateDeclaredType(fileOrMimeType, this.avatarMimeTypes);
  }

  validateAvatarSize(size: number) {
    return size <= this.maxAvatarSize;
  }

  validateFileSize(size: number) {
    return size <= this.maxFileSize;
  }

  getFileUrl(filename: string, subfolder = "files") {
    return `/uploads/${subfolder}/${filename}`;
  }

  async saveFile(file: Express.Multer.File, subfolder: string): Promise<UploadResponseDto> {
    const uploadRoot = this.getUploadRoot();
    const targetDirectory = resolve(uploadRoot, subfolder);
    const extension = this.resolveExtension(file.originalname, file.mimetype);
    const filename = `${randomUUID()}${extension}`;

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(join(targetDirectory, filename), file.buffer);

    return {
      url: this.getFileUrl(filename, subfolder),
      filename,
      size: file.size,
      mimeType: file.mimetype
    };
  }

  async saveBuffer(
    buffer: Buffer,
    options: {
      originalName?: string;
      mimeType: string;
      size?: number;
      subfolder: string;
    }
  ): Promise<UploadResponseDto> {
    const uploadRoot = this.getUploadRoot();
    const targetDirectory = resolve(uploadRoot, options.subfolder);
    const extension = this.resolveExtension(options.originalName ?? "", options.mimeType);
    const filename = `${randomUUID()}${extension}`;

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(join(targetDirectory, filename), buffer);

    return {
      url: this.getFileUrl(filename, options.subfolder),
      filename,
      size: options.size ?? buffer.byteLength,
      mimeType: options.mimeType
    };
  }

  async deleteFile(filePathOrUrl?: string | null) {
    const absolutePath = this.resolveStoredFilePath(filePathOrUrl);

    if (!absolutePath) {
      return false;
    }

    try {
      await stat(absolutePath);
    } catch {
      return false;
    }

    await rm(absolutePath, { force: true });
    return true;
  }

  isLocalUploadPath(filePathOrUrl?: string | null) {
    return Boolean(this.resolveStoredFilePath(filePathOrUrl));
  }

  resolveStoredFilePath(filePathOrUrl?: string | null) {
    return this.resolveStoredPath(filePathOrUrl);
  }

  async readFileAsDataUrl(filePathOrUrl?: string | null) {
    const absolutePath = this.resolveStoredPath(filePathOrUrl);

    if (!absolutePath) {
      return null;
    }

    try {
      const buffer = await readFile(absolutePath);
      const mimeType = this.resolveMimeType(extname(absolutePath).toLowerCase());
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    } catch {
      return null;
    }
  }

  async readStoredFile(filePathOrUrl?: string | null) {
    const absolutePath = this.resolveStoredPath(filePathOrUrl);

    if (!absolutePath) {
      return null;
    }

    try {
      const buffer = await readFile(absolutePath);
      return {
        buffer,
        mimeType: this.resolveMimeType(extname(absolutePath).toLowerCase()),
        absolutePath
      };
    } catch {
      return null;
    }
  }

  private getUploadRoot() {
    const configuredUploadDir = this.configService.get<string>("UPLOAD_DIR") ?? "./uploads";
    return isAbsolute(configuredUploadDir)
      ? configuredUploadDir
      : resolve(process.cwd(), configuredUploadDir);
  }

  private resolveExtension(originalName: string, mimeType: string) {
    const extensionFromName = extname(originalName).trim().toLowerCase();

    if (extensionFromName) {
      return extensionFromName;
    }

    return this.extensionMap[mimeType] ?? "";
  }

  private resolveStoredPath(filePathOrUrl?: string | null) {
    if (!filePathOrUrl) {
      return null;
    }

    const uploadRoot = this.getUploadRoot();
    const relativePath = filePathOrUrl.startsWith("/uploads/")
      ? filePathOrUrl.replace(/^\/uploads\//, "")
      : filePathOrUrl.replace(/^\/+/, "");
    const normalizedRelativePath = normalize(relativePath);

    if (normalizedRelativePath.startsWith("..")) {
      return null;
    }

    const absolutePath = resolve(uploadRoot, normalizedRelativePath);

    if (!absolutePath.startsWith(uploadRoot)) {
      return null;
    }

    return absolutePath;
  }

  private resolveMimeType(extension: string) {
    const match = Object.entries(this.extensionMap).find(([, mappedExtension]) => mappedExtension === extension);
    return match?.[0] ?? "application/octet-stream";
  }

  private validateDeclaredType(
    fileOrMimeType: Express.Multer.File | string,
    allowedMimeTypes: readonly string[]
  ) {
    const mimeType = typeof fileOrMimeType === "string" ? fileOrMimeType : fileOrMimeType.mimetype;
    if (!allowedMimeTypes.includes(mimeType)) {
      return false;
    }

    if (typeof fileOrMimeType === "string") {
      return true;
    }

    this.assertSafeExtension(fileOrMimeType.originalname);
    this.assertMagicBytesMatch(fileOrMimeType.buffer, mimeType);
    return true;
  }

  private assertSafeExtension(originalName: string) {
    const extension = extname(originalName).trim().toLowerCase();
    if (this.dangerousExtensions.has(extension)) {
      throw new BadRequestException("Định dạng tệp không được phép tải lên");
    }
  }

  private assertMagicBytesMatch(buffer: Buffer, mimeType: string) {
    if (mimeType === "image/jpeg" && !this.isJpeg(buffer)) {
      throw new BadRequestException("Nội dung tệp JPG không hợp lệ");
    }
    if (mimeType === "image/png" && !this.isPng(buffer)) {
      throw new BadRequestException("Nội dung tệp PNG không hợp lệ");
    }
    if (mimeType === "application/pdf" && !this.isPdf(buffer)) {
      throw new BadRequestException("Nội dung tệp PDF không hợp lệ");
    }
  }

  private isJpeg(buffer: Buffer) {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  private isPng(buffer: Buffer) {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  private isPdf(buffer: Buffer) {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }
}
