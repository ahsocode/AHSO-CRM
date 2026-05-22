import { Injectable } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { DocumentsService } from "../documents/documents.service";
import { PdfRendererService } from "../documents/pdf-renderer.service";
import { QuotesService } from "./quotes.service";

@Injectable()
export class QuotesPdfService {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly documentsService: DocumentsService,
    private readonly pdfRenderer: PdfRendererService
  ) {}

  async generatePdf(quoteId: string, user: JwtUser) {
    const [quote, { html }] = await Promise.all([
      this.quotesService.findOne(quoteId, user),
      this.documentsService.renderPreview("QUOTATION", quoteId, undefined, user)
    ]);

    const buffer = await this.pdfRenderer.render(html);

    return {
      filename: `${quote.quoteNo}-v${quote.version}.pdf`,
      buffer
    };
  }
}
