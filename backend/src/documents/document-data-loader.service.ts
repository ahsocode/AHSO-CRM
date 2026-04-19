import { Injectable, NotImplementedException } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { UploadService } from "../upload/upload.service";
import type { DocumentLanguage } from "./dto/document-type.enum";

export interface BaseDocumentContext {
  company: Record<string, unknown>;
  policies: Record<string, unknown>;
  logo: string | null;
  language: DocumentLanguage;
  generatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Per-template data loaders. Phase 0 ships the shared `loadBaseContext`
 * and explicit stubs for every template — later phases replace each stub
 * with a real implementation that fetches the relevant entity.
 */
@Injectable()
export class DocumentDataLoaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly uploadService: UploadService
  ) {}

  async loadBaseContext(user: JwtUser, language: DocumentLanguage): Promise<BaseDocumentContext> {
    const settings = await this.settingsService.getAllSettings();
    const logo = await this.resolveLogo(settings.logo);
    return {
      company: settings.company ?? {},
      policies: settings.policies ?? {},
      logo,
      language,
      generatedAt: new Date(),
      user: {
        id: user.sub,
        name: user.name,
        email: user.email
      }
    };
  }

  private async resolveLogo(logoUrl?: string | null): Promise<string | null> {
    if (!logoUrl) return null;
    if (
      logoUrl.startsWith("http://") ||
      logoUrl.startsWith("https://") ||
      logoUrl.startsWith("data:")
    ) {
      return logoUrl;
    }
    return this.uploadService.readFileAsDataUrl(logoUrl);
  }

  // -------------------------------------------------------------------------
  // Per-template stubs — all throw NotImplementedException in Phase 0.
  // Phases 1-16 replace these with real loaders.
  // -------------------------------------------------------------------------

  async loadForQuotation(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template QUOTATION sẽ được triển khai ở Phase 1.");
  }

  async loadForProposal(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template PROPOSAL sẽ được triển khai ở Phase 2.");
  }

  async loadForSurveyReport(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template SURVEY_REPORT sẽ được triển khai ở Phase 3.");
  }

  async loadForContract(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template CONTRACT sẽ được triển khai ở Phase 4.");
  }

  async loadForContractAddendum(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template CONTRACT_ADDENDUM sẽ được triển khai ở Phase 5.");
  }

  async loadForNda(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template NDA sẽ được triển khai ở Phase 6.");
  }

  async loadForDeliveryNote(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template DELIVERY_NOTE sẽ được triển khai ở Phase 7.");
  }

  async loadForDocHandover(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template DOC_HANDOVER sẽ được triển khai ở Phase 8.");
  }

  async loadForInstallationReport(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template INSTALLATION_REPORT sẽ được triển khai ở Phase 9.");
  }

  async loadForAcceptanceReport(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template ACCEPTANCE_REPORT sẽ được triển khai ở Phase 10.");
  }

  async loadForPartialAcceptance(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template PARTIAL_ACCEPTANCE sẽ được triển khai ở Phase 11.");
  }

  async loadForWarrantyCert(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template WARRANTY_CERT sẽ được triển khai ở Phase 12.");
  }

  async loadForMaintenanceRecord(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template MAINTENANCE_RECORD sẽ được triển khai ở Phase 13.");
  }

  async loadForPaymentRequest(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template PAYMENT_REQUEST sẽ được triển khai ở Phase 14.");
  }

  async loadForPaymentReceipt(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template PAYMENT_RECEIPT sẽ được triển khai ở Phase 15.");
  }

  async loadForArReconciliation(_entityId: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException("Template AR_RECONCILIATION sẽ được triển khai ở Phase 16.");
  }
}
