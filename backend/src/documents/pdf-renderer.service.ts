import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execFile } from "child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { renderPdfBuffer } from "../common/pdf/pdf.utils";

export interface PdfRenderOptions {
  pageSize?: "A4" | "Letter";
  margins?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

/**
 * Thin wrapper around `renderPdfBuffer` that:
 * - centralizes page/margin defaults for the Documents module,
 * - keeps a single injection surface so phase-N code swaps HTML → Buffer without
 *   knowing about Puppeteer directly.
 *
 * The underlying Puppeteer call sets format/margins from its own defaults;
 * we forward the HTML as-is, and the template CSS (@page) is the source of
 * truth for layout. Options are accepted for API parity with future callers
 * but are not yet enforced — Phase 1+ templates set layout via CSS.
 */
@Injectable()
export class PdfRendererService {
  constructor(private readonly configService: ConfigService) {}

  async render(html: string, _options: PdfRenderOptions = {}): Promise<Buffer> {
    if (this.isWeasyPrintEngine()) {
      return this.renderWithWeasyPrint(html);
    }

    const uint8 = await renderPdfBuffer(html, this.configService);
    return Buffer.from(uint8);
  }

  isWeasyPrintEngine(): boolean {
    return this.configService.get<string>("DOCUMENT_PDF_ENGINE") === "weasyprint";
  }

  private async renderWithWeasyPrint(html: string): Promise<Buffer> {
    const tempDir = await mkdtemp(join(tmpdir(), "ahso-weasyprint-"));
    const inputPath = join(tempDir, "input.html");
    const outputPath = join(tempDir, "output.pdf");

    try {
      await writeFile(inputPath, html, "utf-8");
      await this.runWeasyPrint(inputPath, outputPath);

      const { size } = await stat(outputPath);
      if (size === 0) {
        throw new Error("WeasyPrint produced an empty PDF file");
      }

      return await readFile(outputPath);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private runWeasyPrint(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        "weasyprint",
        [inputPath, outputPath],
        { timeout: 60_000, maxBuffer: 50 * 1024 * 1024 },
        (error, _stdout, stderr) => {
          if (error) {
            const parts: string[] = [];
            if (error.code !== undefined) parts.push(`exit=${String(error.code)}`);
            if (error.signal) parts.push(`signal=${error.signal}`);
            const stderrText = typeof stderr === "string" ? stderr.trim() : "";
            if (stderrText) parts.push(`stderr=${stderrText}`);
            else if (error.message) parts.push(error.message);
            reject(new Error(`WeasyPrint PDF rendering failed: ${parts.join(", ") || "unknown error"}`));
            return;
          }

          resolve();
        }
      );
    });
  }
}
