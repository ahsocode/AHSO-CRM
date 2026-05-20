import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Readable } from "stream";
import { UploadService } from "./upload.service";

describe("UploadService", () => {
  let service: UploadService;

  beforeEach(() => {
    service = new UploadService({ get: jest.fn() } as unknown as ConfigService);
  });

  it("rejects dangerous extensions even when MIME type is allowed", () => {
    expect(() =>
      service.validateFileType(createFile({
        originalname: "payload.html",
        mimetype: "application/pdf",
        buffer: Buffer.from("%PDF-1.7")
      }))
    ).toThrow(BadRequestException);
  });

  it("rejects declared PDF files when magic bytes do not match", () => {
    expect(() =>
      service.validateFileType(createFile({
        originalname: "document.pdf",
        mimetype: "application/pdf",
        buffer: Buffer.from("<script>alert(1)</script>")
      }))
    ).toThrow(BadRequestException);
  });

  it("accepts allowed image files with matching magic bytes", () => {
    expect(service.validateAvatarType(createFile({
      originalname: "avatar.png",
      mimetype: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00])
    }))).toBe(true);
  });
});

function createFile(input: {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: input.originalname,
    encoding: "7bit",
    mimetype: input.mimetype,
    size: input.buffer.byteLength,
    buffer: input.buffer,
    destination: "",
    filename: "",
    path: "",
    stream: Readable.from([])
  };
}
