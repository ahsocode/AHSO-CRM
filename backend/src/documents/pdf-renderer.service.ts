import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
    const uint8 = await renderPdfBuffer(html, this.configService);
    return Buffer.from(uint8);
  }
}
