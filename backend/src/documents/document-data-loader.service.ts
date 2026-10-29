import { Injectable, NotFoundException } from "@nestjs/common";
import type { DocumentType, Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { UploadService } from "../upload/upload.service";
import type { DocumentLanguage } from "./dto/document-type.enum";
import { assertDocumentRequirements, DOCUMENT_SOURCE_SCHEMAS } from "./document-requirements";
import { buildQuoteTaxBreakdown } from "./helpers/quote-tax-breakdown";

// Mirror of frontend normalizeItemDescription — converts inline ✓ bullet
// markers stored without newlines ("✓ A ✓ B") into newline-separated form
// so Handlebars templates rendered with white-space:pre-wrap show each item
// on its own line.
function normalizeDescription(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  return text.replace(/\s+(?=✓\s)/g, "\n");
}

/**
 * Company profile for templates. Settings store the tax id under `taxId`
 * (settings/dto/update-setting.dto.ts) while templates print `company.taxCode`:
 * expose both so the seller tax id is never blank (audit E-02). Wording is unchanged.
 */
export function buildCompanyProfile(company: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const profile = { ...(company ?? {}) };
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const taxCode = text(profile.taxCode) || text(profile.taxId);
  if (taxCode) {
    profile.taxCode = taxCode;
    if (!text(profile.taxId)) profile.taxId = taxCode;
  }
  return profile;
}

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
 * Per-template loaders use business records or validated, explicitly recorded evidence.
 * Missing evidence is a 422; renderers must never manufacture business facts.
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
      company: buildCompanyProfile(settings.company),
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

  private mapQuoteItems(
    items: Array<{
      id: string;
      order: number;
      name: string;
      description: string | null;
      unit: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      total: Prisma.Decimal;
    }>
  ) {
    // Explicit field list: internal BOM / cost links (bomId…) must never reach print templates
    return items.map((item) => ({
      id: item.id,
      order: item.order,
      name: item.name,
      unit: item.unit,
      description: normalizeDescription(item.description),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total)
    }));
  }

  private mapContractItems(
    items: Array<{
      id: string;
      order: number;
      name: string;
      description: string | null;
      unit: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      total: Prisma.Decimal;
      quoteItemId: string | null;
    }>
  ) {
    return items.map((item) => ({
      ...item,
      description: normalizeDescription(item.description),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total)
    }));
  }

  private resolveContractScopeItems<
    TContractItem extends {
      id: string;
      order: number;
      name: string;
      description: string | null;
      unit: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      total: Prisma.Decimal;
      quoteItemId: string | null;
    },
    TQuoteItem extends {
      id: string;
      order: number;
      name: string;
      description: string | null;
      unit: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      total: Prisma.Decimal;
    }
  >(contractItems: TContractItem[], quoteItems: TQuoteItem[] = []) {
    const scopedItems = this.mapContractItems(contractItems);
    return scopedItems.length > 0 ? scopedItems : this.mapQuoteItems(quoteItems);
  }

  private async loadContractOrQuoteReference(entityId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: entityId },
      include: {
        project: {
          include: {
            customer: {
              include: {
                contacts: {
                  where: { isPrimary: true },
                  take: 1
                }
              }
            },
            quotes: {
              where: { status: "ACCEPTED" },
              include: { items: { orderBy: { order: "asc" } } },
              take: 1
            }
          }
        },
        items: {
          orderBy: { order: "asc" }
        },
        milestones: {
          orderBy: { dueDate: "asc" }
        }
      }
    });

    if (contract) {
      const linkedQuote = contract.project.quotes[0] || null;
      const contractItems = this.resolveContractScopeItems(contract.items, linkedQuote?.items ?? []);
      // The contract may cover only some quote lines: print VAT for those lines only,
      // using each source quote line's own rate (not the whole quote's breakdown).
      const sourceRates = new Map((linkedQuote?.items ?? []).map((item) => [item.id, item.taxRate]));
      const breakdownLines =
        contract.items.length > 0
          ? contract.items.map((item) => ({
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.quoteItemId && sourceRates.has(item.quoteItemId) ? sourceRates.get(item.quoteItemId) : undefined
            }))
          : (linkedQuote?.items ?? []);

      return {
        contract: {
          ...contract,
          value: Number(contract.value)
        },
        project: contract.project,
        customer: contract.project.customer,
        primaryContact: contract.project.customer.contacts[0] || null,
        linkedQuote: linkedQuote
          ? {
              ...linkedQuote,
              subtotal: Number(linkedQuote.subtotal),
              taxRate: Number(linkedQuote.taxRate),
              taxAmount: Number(linkedQuote.taxAmount),
              taxBreakdown: buildQuoteTaxBreakdown(breakdownLines, linkedQuote.taxRate),
              total: Number(linkedQuote.total),
              items: contractItems
            }
          : null,
        contractItems,
        milestones: contract.milestones.map((milestone) => ({
          ...milestone,
          paymentAmount: milestone.paymentAmount ? Number(milestone.paymentAmount) : null
        })),
        documentEntityType: "contract",
        documentEntityId: contract.id,
        isQuoteReference: false
      };
    }

    assertDocumentRequirements("CONTRACT", {});
    throw new NotFoundException("Không tìm thấy hợp đồng.");
  }

  async loadForQuotation(entityId: string): Promise<Record<string, unknown>> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: entityId },
      include: {
        items: {
          orderBy: { order: "asc" }
        },
        project: {
          include: {
            customer: {
              include: {
                contacts: {
                  where: { isPrimary: true },
                  take: 1
                }
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!quote) {
      throw new NotFoundException(`Không tìm thấy báo giá với ID: ${entityId}`);
    }

    return this.checked("QUOTATION", {
      title: "BÁO GIÁ / QUOTATION",
      quote: {
        ...quote,
        subtotal: Number(quote.subtotal),
        taxRate: Number(quote.taxRate),
        taxAmount: Number(quote.taxAmount),
        taxBreakdown: buildQuoteTaxBreakdown(quote.items, quote.taxRate),
        total: Number(quote.total),
        tableColumnWidths: quote.tableColumnWidths
      },
      tableColumnWidths: quote.tableColumnWidths,
      items: this.mapQuoteItems(quote.items),
      project: quote.project,
      customer: quote.project.customer,
      primaryContact: quote.project.customer.contacts[0] || null
    });
  }

  async loadForProposal(entityId: string): Promise<Record<string, unknown>> {
    const project = await this.prisma.project.findUnique({
      where: { id: entityId },
      include: {
        customer: {
          include: {
            contacts: {
              where: { isPrimary: true },
              take: 1
            }
          }
        },
        milestones: {
          orderBy: { dueDate: "asc" }
        },
        quotes: {
          where: {
            status: { in: ["ACCEPTED", "SENT", "DRAFT"] }
          },
          orderBy: [
            { status: "asc" }, // ACCEPTED comes first (A before D/S logically but wait, string sort... ACCEPTED(A), DRAFT(D), SENT(S). It happens to work!
            { version: "desc" }
          ],
          take: 1
        }
      }
    });

    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án với ID: ${entityId}`);
    }

    const linkedQuote = project.quotes[0] ? {
      ...project.quotes[0],
      total: Number(project.quotes[0].total)
    } : null;

    return this.checked("PROPOSAL", {
      title: "ĐỀ XUẤT DỰ ÁN / PROJECT PROPOSAL",
      project: {
        ...project,
        estimatedValue: Number(project.estimatedValue)
      },
      customer: project.customer,
      primaryContact: project.customer.contacts[0] || null,
      milestones: project.milestones.map(m => ({
        ...m,
        paymentAmount: m.paymentAmount ? Number(m.paymentAmount) : null
      })),
      linkedQuote
    });
  }

  async loadForSurveyReport(entityId: string): Promise<Record<string, unknown>> {
    const project = await this.prisma.project.findUnique({
      where: { id: entityId, deletedAt: null },
      include: {
        customer: {
          include: {
            contacts: { where: { isPrimary: true }, take: 1 }
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án với ID: ${entityId}`);
    }

    // Load most recent survey for this project with its notes
    const survey = await this.prisma.survey.findFirst({
      where: { projectId: entityId },
      orderBy: { surveyedAt: "desc" },
      include: {
        notes: { orderBy: { createdAt: "asc" } },
        createdBy: { select: { name: true } }
      }
    });

    const NOTE_TYPE_LABELS: Record<string, string> = {
      TECHNICAL_REQUIREMENT: "Yêu cầu kỹ thuật",
      COMMERCIAL_REQUIREMENT: "Yêu cầu thương mại",
      SITE_CONSTRAINT: "Ràng buộc thực địa",
      RISK: "Rủi ro",
      DECISION: "Quyết định",
      OPEN_QUESTION: "Câu hỏi mở",
      GENERAL: "Ghi chú chung"
    };

    const findings = survey?.notes?.map((note, index) => ({
      id: index + 1,
      type: note.type,
      typeLabel: NOTE_TYPE_LABELS[note.type as string] ?? String(note.type),
      title: NOTE_TYPE_LABELS[note.type as string] ?? String(note.type),
      description: note.content,
      isImportant: note.isImportant
    })) ?? [];

    return this.checked("SURVEY_REPORT", {
      title: "BÁO CÁO KHẢO SÁT / SURVEY REPORT",
      project,
      customer: project.customer,
      primaryContact: project.customer.contacts[0] ?? null,
      survey: survey ?? null,
      surveyorName: survey?.createdBy?.name ?? "",
      surveyDate: survey?.surveyedAt ?? null,
      location: survey?.location ?? "",
      objectives: survey?.objectives ?? "",
      summary: survey?.summary ?? "",
      findings,
      hasSurveyData: !!survey && findings.length > 0
    });
  }

  async loadForContract(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);

    return this.checked("CONTRACT", {
      title: "HỢP ĐỒNG KINH TẾ / ECONOMIC CONTRACT",
      ...reference
    });
  }

  async loadForContractAddendum(entityId: string): Promise<Record<string, unknown>> {
    return this.loadOperational("CONTRACT_ADDENDUM", entityId, "PHỤ LỤC HỢP ĐỒNG / CONTRACT ADDENDUM");
  }

  async loadForNda(entityId: string): Promise<Record<string, unknown>> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: entityId },
      include: {
        contacts: {
          where: { isPrimary: true },
          take: 1
        }
      }
    });

    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID: ${entityId}`);
    }

    return this.checked("NDA", {
      title: "THỎA THUẬN BẢO MẬT / NON-DISCLOSURE AGREEMENT",
      customer,
      primaryContact: customer.contacts[0] || null,
      ndaDate: new Date()
    });
  }

  async loadForDeliveryNote(entityId: string): Promise<Record<string, unknown>> {
    return this.loadOperational("DELIVERY_NOTE", entityId, "BIÊN BẢN GIAO HÀNG / DELIVERY NOTE");
  }

  async loadForDocHandover(entityId: string): Promise<Record<string, unknown>> {
    return this.loadOperational("DOC_HANDOVER", entityId, "BIÊN BẢN BÀN GIAO TÀI LIỆU / DOCUMENT HANDOVER");
  }

  async loadForInstallationReport(entityId: string): Promise<Record<string, unknown>> {
    return this.loadOperational("INSTALLATION_REPORT", entityId, "BIÊN BẢN CÀI ĐẶT & TRIỂN KHAI / INSTALLATION REPORT");
  }

  async loadForAcceptanceReport(entityId: string): Promise<Record<string, unknown>> {
    return this.loadOperational("ACCEPTANCE_REPORT", entityId, "BIÊN BẢN NGHIỆM THU KỸ THUẬT / UAT REPORT");
  }

  async loadForPartialAcceptance(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);
    const accepted = reference.milestones.filter(m => m.status === "ACCEPTED" && m.completedAt && Number(m.paymentAmount) > 0);
    const acceptedParts = accepted.map(m => ({
      name: m.name,
      ratio: Number(reference.contract.value) > 0 ? `${Number(m.paymentAmount) / Number(reference.contract.value) * 100}%` : "",
      value: Number(m.paymentAmount),
      note: m.notes ?? ""
    }));
    return this.checked("PARTIAL_ACCEPTANCE", {
      title: "BIÊN BẢN NGHIỆM THU GIAI ĐOẠN / PARTIAL ACCEPTANCE REPORT",
      ...reference, acceptedParts,
      acceptanceDate: accepted.length ? new Date(Math.max(...accepted.map(m => m.completedAt!.getTime()))) : null
    });
  }

  async loadForWarrantyCert(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);
    const settings = await this.settingsService.getAllSettings();
    const warrantyMonths = Number(settings.policies?.warrantyPeriodMonths);
    const warrantyStartDate = reference.project.completedAt;
    const warrantyEndDate = warrantyStartDate && Number.isFinite(warrantyMonths) ? new Date(warrantyStartDate) : null;
    if (warrantyEndDate) warrantyEndDate.setMonth(warrantyEndDate.getMonth() + warrantyMonths);
    return this.checked("WARRANTY_CERT", {
      title: "GIẤY CHỨNG NHẬN BẢO HÀNH / WARRANTY CERTIFICATE", ...reference,
      warrantyDate: warrantyStartDate, warrantyPeriodMonths: warrantyMonths, warrantyEndDate
    });
  }

  async loadForMaintenanceRecord(entityId: string): Promise<Record<string, unknown>> {
    return this.loadOperational("MAINTENANCE_RECORD", entityId, "BIÊN BẢN BẢO TRÌ & HỖ TRỢ / MAINTENANCE RECORD");
  }

  async loadForPaymentRequest(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);
    const companyInfo = await this.settingsService.getCompanyInfo();
    const nextMilestone = reference.milestones.find(m => m.status === "PENDING" && Number(m.paymentAmount) > 0) ?? null;
    return this.checked("PAYMENT_REQUEST", {
      title: "GIẤY ĐỀ NGHỊ THANH TOÁN / PAYMENT REQUEST", ...reference,
      requestDate: nextMilestone?.dueDate ?? null,
      paymentAmount: nextMilestone?.paymentAmount ?? null,
      paymentReason: nextMilestone ? `Thanh toán "${nextMilestone.name}" theo HĐ số ${reference.contract.contractNo}` : "",
      bankName: companyInfo.bankName ?? "", bankAccountNo: companyInfo.bankAccount ?? "",
      bankAccountName: companyInfo.bankAccountName ?? "", bankBranch: companyInfo.bankBranch ?? "",
      milestone: nextMilestone
    });
  }

  async loadForPaymentReceipt(entityId: string): Promise<Record<string, unknown>> {
    // A payment id selects an exact receipt; a contract id keeps the legacy latest-payment route.
    const selectedPayment = await this.prisma.payment.findUnique({ where: { id: entityId } });
    const reference = await this.loadContractOrQuoteReference(selectedPayment?.contractId ?? entityId);
    const companyInfo = await this.settingsService.getCompanyInfo();
    const payment = selectedPayment ?? await this.prisma.payment.findFirst({
      where: { contractId: reference.contract.id }, orderBy: [{ paidAt: "desc" }, { id: "desc" }]
    });
    return this.checked("PAYMENT_RECEIPT", {
      title: "PHIẾU THU / PAYMENT RECEIPT", ...reference,
      documentEntityType: payment ? "payment" : "contract", documentEntityId: payment?.id ?? entityId,
      receiptDate: payment?.paidAt ?? null, receiptAmount: payment ? Number(payment.amount) : null,
      paymentMethod: payment?.method ?? "", receiptReason: payment?.notes ?? `Thu tiền HĐ số ${reference.contract.contractNo}`,
      cashier: companyInfo.contactName ?? "", payerName: reference.primaryContact?.name ?? reference.customer.name, payment
    });
  }

  async loadForArReconciliation(entityId: string): Promise<Record<string, unknown>> {
    // entityId here is customerId (entityType: "customer" in registry)
    const customer = await this.prisma.customer.findUnique({
      where: { id: entityId },
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        projects: {
          include: {
            contract: true
          }
        }
      }
    });

    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID: ${entityId}`);
    }

    const sourceData = await this.loadSource("AR_RECONCILIATION", entityId);
    const invoices = (sourceData.invoices ?? []) as Array<{contractId: string; amount: number}>;

    // Load actual payment sums per contract in one query
    const contractIds = customer.projects
      .map((p) => p.contract?.id)
      .filter((id): id is string => Boolean(id));

    const paymentSums = contractIds.length > 0
      ? await this.prisma.payment.groupBy({
          by: ["contractId"],
          where: { contractId: { in: contractIds } },
          _sum: { amount: true }
        })
      : [];

    const paidByContract = new Map(
      paymentSums.map((p) => [p.contractId, Number(p._sum.amount ?? 0)])
    );

    // Build AR line items from all contracts
    const lineItems: Array<{
      contractNo: string;
      projectName: string;
      contractValue: number;
      invoiced: number;
      paid: number;
      outstanding: number;
      dueDate: Date | null;
    }> = [];

    let totalContractValue = 0;
    let totalInvoiced = 0;
    let totalPaid = 0;

    for (const project of customer.projects) {
      const contract = project.contract;

      if (!contract) {
        continue;
      }

      const contractValue = Number(contract.value ?? 0);
      const invoiced = invoices.filter(invoice => invoice.contractId === contract.id).reduce((sum, invoice) => sum + invoice.amount, 0);
      // paid = sum of actual Payment records for this contract
      const paid = paidByContract.get(contract.id) ?? 0;
      const outstanding = invoiced - paid;

      lineItems.push({
        contractNo: contract.contractNo,
        projectName: project.name,
        contractValue,
        invoiced,
        paid,
        outstanding,
        dueDate: contract.endDate
      });

      totalContractValue += contractValue;
      totalInvoiced += invoiced;
      totalPaid += paid;
    }

    const totalOutstanding = totalInvoiced - totalPaid;
    const reconDate = new Date();

    return this.checked("AR_RECONCILIATION", {
      title: "BẢNG ĐỐI CHIẾU CÔNG NỢ / AR RECONCILIATION STATEMENT",
      customer,
      primaryContact: customer.contacts[0] || null,
      reconDate,
      periodStart: new Date(reconDate.getFullYear(), 0, 1), // Jan 1 of current year
      periodEnd: reconDate,
      lineItems,
      sourceData,
      totals: {
        contractValue: totalContractValue,
        invoiced: totalInvoiced,
        paid: totalPaid,
        outstanding: totalOutstanding
      }
    });
  }
  private checked(type: DocumentType, context: Record<string, unknown>) {
    assertDocumentRequirements(type, context);
    return context;
  }

  private async loadSource(type: DocumentType, entityId: string): Promise<Record<string, unknown>> {
    const record = await this.prisma.documentSourceData.findUnique({ where: { type_entityId: { type, entityId } } });
    const schema = DOCUMENT_SOURCE_SCHEMAS[type as keyof typeof DOCUMENT_SOURCE_SCHEMAS];
    const parsed = schema?.safeParse(record?.data ?? {});
    return parsed?.success ? parsed.data : {};
  }

  private async loadOperational(type: keyof typeof DOCUMENT_SOURCE_SCHEMAS, entityId: string, title: string) {
    const reference = await this.loadContractOrQuoteReference(entityId);
    const sourceData = await this.loadSource(type, entityId);
    return this.checked(type, { title, ...reference, ...sourceData, sourceData });
  }

}
