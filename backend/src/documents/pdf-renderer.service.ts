import { Injectable } from "@nestjs/common";
import { execFile } from "child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export interface PdfRenderOptions {
  pageSize?: "A4" | "Letter";
  margins?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

@Injectable()
export class PdfRendererService {
  async render(html: string, _options: PdfRenderOptions = {}): Promise<Buffer> {
    return this.renderWithWeasyPrint(html);
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
