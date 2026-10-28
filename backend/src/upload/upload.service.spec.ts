import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync } from "fs";
import { mkdtemp, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { UploadService } from "./upload.service";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const VALID_WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const VALID_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

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

  describe("magic bytes and extension hardening", () => {
    it("rejects a declared WEBP named x.svg whose content is SVG", () => {
      expect(() =>
        service.validateLogoType(createFile({
          originalname: "x.svg",
          mimetype: "image/webp",
          buffer: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>")
        }))
      ).toThrow(BadRequestException);
    });

    it("rejects a declared WEBP named p.js whose content is JavaScript", () => {
      expect(() =>
        service.validateAvatarType(createFile({
          originalname: "p.js",
          mimetype: "image/webp",
          buffer: Buffer.from("alert(1)")
        }))
      ).toThrow(BadRequestException);
    });

    it("rejects dangerous client extensions even with valid WEBP content", () => {
      expect(() =>
        service.validateAvatarType(createFile({ originalname: "p.js", mimetype: "image/webp", buffer: VALID_WEBP }))
      ).toThrow(BadRequestException);
    });

    it("rejects a declared DOCX whose content is HTML", () => {
      expect(() =>
        service.validateFileType(createFile({
          originalname: "report.docx",
          mimetype: DOCX_MIME,
          buffer: Buffer.from("<html><script>alert(1)</script></html>")
        }))
      ).toThrow(BadRequestException);
    });

    it("accepts a DOCX with a ZIP signature", () => {
      expect(service.validateFileType(createFile({
        originalname: "report.docx",
        mimetype: DOCX_MIME,
        buffer: VALID_ZIP
      }))).toBe(true);
    });

    it("rejects an SVG logo containing <script", () => {
      expect(() =>
        service.validateLogoType(createFile({
          originalname: "logo.svg",
          mimetype: "image/svg+xml",
          buffer: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>")
        }))
      ).toThrow(BadRequestException);
    });

    it.each([
      "<svg><a href=\"javascript:alert(1)\"><text>x</text></a></svg>",
      "<svg onload=\"alert(1)\"></svg>",
      "<svg><rect/onclick=alert(1)></svg>",
      "<html><body>not svg</body></html>"
    ])("rejects unsafe or non-SVG content declared as SVG: %s", (content) => {
      expect(() =>
        service.validateLogoType(createFile({ originalname: "logo.svg", mimetype: "image/svg+xml", buffer: Buffer.from(content) }))
      ).toThrow(BadRequestException);
    });

    it("accepts a clean SVG logo, including BOM and XML prolog", () => {
      const svg = "\uFEFF  <?xml version=\"1.0\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"><rect width=\"10\" height=\"10\" style=\"fill:#c00\"/></svg>";
      expect(service.validateLogoType(createFile({
        originalname: "logo.svg",
        mimetype: "image/svg+xml",
        buffer: Buffer.from(svg, "utf8")
      }))).toBe(true);
    });

    it("accepts an editor-exported SVG that starts with a comment and a plain DOCTYPE", () => {
      const svg = "<!-- Generator: Illustrator -->\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\n<svg xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"10\" height=\"10\"/></svg>";
      expect(service.validateLogoType(createFile({ originalname: "logo.svg", mimetype: "image/svg+xml", buffer: Buffer.from(svg) }))).toBe(true);
    });

    it.each([
      "<!-- x --><svg><script>alert(1)</script></svg>",
      "<!DOCTYPE svg [<!ENTITY x \"y\">]><svg></svg>",
      "<!-- x --><html><body>not svg</body></html>"
    ])("still rejects unsafe content hidden behind a leading comment or DOCTYPE: %s", (content) => {
      expect(() =>
        service.validateLogoType(createFile({ originalname: "logo.svg", mimetype: "image/svg+xml", buffer: Buffer.from(content) }))
      ).toThrow();
    });
  });

  describe("stored extension comes from MIME type only", () => {
    let uploadDir: string;
    let tmpService: UploadService;

    beforeEach(async () => {
      uploadDir = await mkdtemp(join(tmpdir(), "ahso-upload-spec-"));
      tmpService = new UploadService({
        get: jest.fn((key: string) => (key === "UPLOAD_DIR" ? uploadDir : undefined))
      } as unknown as ConfigService);
    });

    afterEach(async () => {
      await rm(uploadDir, { recursive: true, force: true });
    });

    it("stores a valid WEBP named x.svg with the .webp extension", async () => {
      const file = createFile({ originalname: "x.svg", mimetype: "image/webp", buffer: VALID_WEBP });
      expect(tmpService.validateLogoType(file)).toBe(true);

      const saved = await tmpService.saveFile(file, "logos");

      expect(saved.filename).toMatch(/^[0-9a-f-]{36}\.webp$/);
      expect(saved.url).toBe(`/uploads/logos/${saved.filename}`);
      expect(existsSync(join(uploadDir, "logos", saved.filename))).toBe(true);
      expect(await readdir(join(uploadDir, "logos"))).toEqual([saved.filename]);
    });

    it("stores a valid DOCX named x.xhtml with the .docx extension", async () => {
      // validateFileType would reject the ".xhtml" client name outright (blacklist); this
      // checks that even if such a name reaches saveFile, it never controls the stored name.
      const saved = await tmpService.saveFile(
        createFile({ originalname: "x.xhtml", mimetype: DOCX_MIME, buffer: VALID_ZIP }),
        "files"
      );

      expect(saved.filename).toMatch(/\.docx$/);
      expect(existsSync(join(uploadDir, "files", saved.filename))).toBe(true);
    });

    it("stores unknown MIME types from saveBuffer as .bin regardless of originalName", async () => {
      const saved = await tmpService.saveBuffer(Buffer.from("alert(1)"), {
        originalName: "evil.js",
        mimeType: "application/javascript",
        subfolder: "email-attachments"
      });

      expect(saved.filename).toMatch(/\.bin$/);
    });

    it("keeps the .pdf extension for generated PDFs", async () => {
      const saved = await tmpService.saveBuffer(Buffer.from("%PDF-1.7"), {
        originalName: "BG-2026-001.pdf",
        mimeType: "application/pdf",
        subfolder: "documents"
      });

      expect(saved.filename).toMatch(/\.pdf$/);
    });
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
