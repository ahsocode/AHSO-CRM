import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { UploadService } from "../upload/upload.service";
import type { DocumentLanguage } from "./dto/document-type.enum";

// Mirror of frontend normalizeItemDescription — converts inline ✓ bullet
// markers stored without newlines ("✓ A ✓ B") into newline-separated form
// so Handlebars templates rendered with white-space:pre-wrap show each item
// on its own line.
function normalizeDescription(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  return text.replace(/\s+(?=✓\s)/g, "\n");
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
 * Per-template data loaders. `QUOTATION` and `CONTRACT` are wired to live
 * business data for production runtime. The remaining beta templates still
 * use partial or sample sections where the domain model has not been mapped
 * end-to-end yet.
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
    return items.map((item) => ({
      ...item,
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
            },
            milestones: {
              orderBy: { dueDate: "asc" }
            }
          }
        }
      }
    });

    if (!quote) {
      throw new NotFoundException(`Không tìm thấy hợp đồng hoặc báo giá với ID: ${entityId}`);
    }

    const quoteItems = this.mapQuoteItems(quote.items);
    const syntheticContract = {
      id: quote.id,
      contractNo: `Theo báo giá ${quote.quoteNo}`,
      signDate: quote.acceptedAt ?? quote.sentAt ?? quote.createdAt,
      startDate: quote.project.startDate,
      endDate: quote.project.expectedEndDate,
      expectedEndDate: quote.project.expectedEndDate,
      value: Number(quote.total),
      status: "ACTIVE",
      fileUrl: null,
      notes: quote.terms,
      projectId: quote.projectId,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      deletedAt: quote.deletedAt
    };

    return {
      contract: syntheticContract,
      project: quote.project,
      customer: quote.project.customer,
      primaryContact: quote.project.customer.contacts[0] || null,
      linkedQuote: {
        ...quote,
        subtotal: Number(quote.subtotal),
        taxRate: Number(quote.taxRate),
        taxAmount: Number(quote.taxAmount),
        total: Number(quote.total),
        items: quoteItems
      },
      contractItems: quoteItems,
      milestones: quote.project.milestones.map((milestone) => ({
        ...milestone,
        paymentAmount: milestone.paymentAmount ? Number(milestone.paymentAmount) : null
      })),
      documentEntityType: "quote",
      documentEntityId: quote.id,
      isQuoteReference: true
    };
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

    return {
      title: "BÁO GIÁ / QUOTATION",
      quote: {
        ...quote,
        subtotal: Number(quote.subtotal),
        taxRate: Number(quote.taxRate),
        taxAmount: Number(quote.taxAmount),
        total: Number(quote.total),
        tableColumnWidths: quote.tableColumnWidths
      },
      tableColumnWidths: quote.tableColumnWidths,
      items: this.mapQuoteItems(quote.items),
      project: quote.project,
      customer: quote.project.customer,
      primaryContact: quote.project.customer.contacts[0] || null
    };
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

    return {
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
    };
  }

  async loadForSurveyReport(entityId: string): Promise<Record<string, unknown>> {
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
        activities: {
          where: { type: "SURVEY" },
          orderBy: { scheduledAt: "desc" },
          take: 1,
          include: {
            user: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án với ID: ${entityId}`);
    }

    const surveyActivity = project.activities[0] || null;

    // In a real app, findings might come from a specific relation or JSON field on activity.
    // For Phase 3, we structure mock/fallback data based on the plan.
    const findings = [
      { id: 1, title: "Hạ tầng mạng hiện tại", description: "Hệ thống cáp mạng cũ, tủ rack chưa được tối ưu, ảnh hưởng đến hiệu suất và an toàn." }
    ];

    return {
      title: "BÁO CÁO KHẢO SÁT / SURVEY REPORT",
      project,
      customer: project.customer,
      primaryContact: project.customer.contacts[0] || null,
      surveyActivity,
      surveyorName: surveyActivity?.user?.name || "Bộ phận Kỹ thuật AHSO",
      surveyDate: surveyActivity?.doneAt || surveyActivity?.scheduledAt || new Date(),
      findings
    };
  }

  async loadForContract(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);

    return {
      title: "HỢP ĐỒNG KINH TẾ / ECONOMIC CONTRACT",
      ...reference
    };
  }

  async loadForContractAddendum(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);

    // Mock changes for the addendum. In a real app, these could be stored in a ContractAddendum entity.
    const modifications = [
      { content: "Gia hạn thời gian thực hiện hợp đồng thêm 30 ngày." },
      { content: "Thay đổi hình thức thanh toán từ tiền mặt sang chuyển khoản." }
    ];

    return {
      title: "PHỤ LỤC HỢP ĐỒNG / CONTRACT ADDENDUM",
      ...reference,
      modifications,
      addendumDate: new Date()
    };
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

    return {
      title: "THỎA THUẬN BẢO MẬT / NON-DISCLOSURE AGREEMENT",
      customer,
      primaryContact: customer.contacts[0] || null,
      ndaDate: new Date()
    };
  }

  async loadForDeliveryNote(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);
    const deliveredItems = reference.contractItems.map((item) => ({
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit
    }));

    return {
      title: "BIÊN BẢN GIAO HÀNG / DELIVERY NOTE",
      ...reference,
      deliveredItems,
      deliveryDate: new Date()
    };
  }

  async loadForDocHandover(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);

    const handedOverDocs = [
      { name: "Tài liệu Hướng dẫn sử dụng (User Manual)", format: "Bản cứng & Bản mềm", note: "Đã bao gồm tài khoản quản trị" },
      { name: "Sơ đồ kiến trúc hệ thống (System Architecture)", format: "Bản mềm (PDF)", note: "" },
      { name: "Biên bản nghiệm thu kỹ thuật", format: "Bản cứng (02 bản gốc)", note: "Ký ngày hoàn thành" }
    ];

    return {
      title: "BIÊN BẢN BÀN GIAO TÀI LIỆU / DOCUMENT HANDOVER",
      ...reference,
      handedOverDocs,
      handoverDate: new Date()
    };
  }

  async loadForInstallationReport(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);
    const scopeItems = reference.contractItems;
    const installations = scopeItems.length > 0
      ? scopeItems.map((item) => ({
          name: item.name,
          status: "Theo hợp đồng",
          note: item.description ?? "Hạng mục nằm trong phạm vi triển khai đã chốt"
        }))
      : [
          { name: "Cài đặt Môi trường máy chủ (Server OS & DB)", status: "Hoàn thành", note: "Phiên bản Linux, PostgreSQL 15, Redis" },
          { name: "Triển khai mã nguồn CRM Hệ thống lõi", status: "Hoàn thành", note: "Đã trỏ tên miền và cài đặt SSL" },
          { name: "Cấu hình Email/SMS Gateway", status: "Hoàn thành", note: "Đã test gửi nhận thành công" }
        ];

    return {
      title: "BIÊN BẢN CÀI ĐẶT & TRIỂN KHAI / INSTALLATION REPORT",
      ...reference,
      installations,
      installationDate: new Date()
    };
  }

  async loadForAcceptanceReport(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);
    const scopeItems = reference.contractItems;
    const testResults = scopeItems.length > 0
      ? scopeItems.map((item) => ({
          name: item.name,
          status: "Chờ nghiệm thu",
          note: item.description ?? "Nghiệm thu theo phạm vi hợp đồng"
        }))
      : [
          { name: "Kiểm thử chức năng đăng nhập/Phân quyền (SSO)", status: "Đạt (Pass)", note: "" },
          { name: "Kiểm thử quy trình tạo Đơn hàng/Báo giá", status: "Đạt (Pass)", note: "Đã xuất PDF thành công" },
          { name: "Kiểm thử tích hợp hệ thống Kế toán", status: "Đạt (Pass)", note: "API đồng bộ thời gian thực" },
          { name: "Nghiệm thu hiệu năng (Load Testing)", status: "Đạt (Pass)", note: "1000 CCU không gián đoạn" }
        ];

    return {
      title: "BIÊN BẢN NGHIỆM THU KỸ THUẬT / UAT REPORT",
      ...reference,
      testResults,
      acceptanceDate: new Date()
    };
  }

  async loadForPartialAcceptance(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);
    const scopeItems = reference.contractItems;
    const acceptedParts = scopeItems.length > 0
      ? scopeItems.map((item) => {
          const ratio =
            Number(reference.contract.value) > 0 && item.total > 0
              ? `${Math.round((item.total / Number(reference.contract.value)) * 100)}%`
              : "Theo giá trị";

          return {
            name: item.name,
            ratio,
            value: item.total,
            note: item.description ?? "Hạng mục thuộc phạm vi nghiệm thu"
          };
        })
      : reference.milestones
      .filter((milestone) => ["DONE", "ACCEPTED", "IN_PROGRESS"].includes(milestone.status))
      .map((milestone) => {
        const value = milestone.paymentAmount ? Number(milestone.paymentAmount) : 0;
        const ratio =
          Number(reference.contract.value) > 0 && value > 0 ? `${Math.round((value / Number(reference.contract.value)) * 100)}%` : "Theo giá trị";

        return {
          name: milestone.name,
          ratio,
          value,
          note: ["DONE", "ACCEPTED"].includes(milestone.status) ? "Đã hoàn thành" : "Đang thực hiện"
        };
      });

    if (acceptedParts.length === 0) {
      acceptedParts.push({ name: "Giai đoạn 1: Triển khai thiết kế", ratio: "30%", value: Number(reference.contract.value) * 0.3, note: "" });
    }

    return {
      title: "BIÊN BẢN NGHIỆM THU GIAI ĐOẠN / PARTIAL ACCEPTANCE REPORT",
      ...reference,
      acceptedParts,
      acceptanceDate: new Date()
    };
  }

  async loadForLiquidation(entityId: string): Promise<Record<string, unknown>> {
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
            }
          }
        }
      }
    });

    if (!contract) {
      throw new NotFoundException(`Không tìm thấy hợp đồng với ID: ${entityId}`);
    }

    // Default to 12 months if warranty is not specified
    const warrantyMonths = 12;
    const warrantyEndDate = new Date();
    warrantyEndDate.setMonth(warrantyEndDate.getMonth() + warrantyMonths);

    return {
      title: "BIÊN BẢN THANH LÝ HỢP ĐỒNG / LIQUIDATION REPORT",
      contract: {
        ...contract,
        value: Number(contract.value)
      },
      project: contract.project,
      customer: contract.project.customer,
      primaryContact: contract.project.customer.contacts[0] || null,
      liquidationDate: new Date(),
      warrantyPeriodMonths: warrantyMonths,
      warrantyEndDate
    };
  }

  async loadForWarrantyCert(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);

    const warrantyMonths = 12;
    const warrantyEndDate = new Date();
    warrantyEndDate.setMonth(warrantyEndDate.getMonth() + warrantyMonths);

    return {
      title: "GIẤY CHỨNG NHẬN BẢO HÀNH / WARRANTY CERTIFICATE",
      ...reference,
      warrantyDate: new Date(),
      warrantyPeriodMonths: warrantyMonths,
      warrantyEndDate
    };
  }

  async loadForMaintenanceRecord(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);

    const issues = [
      { name: "Kiểm tra tình trạng Server", status: "Hoạt động bình thường", note: "CPU < 40%, RAM < 60%" },
      { name: "Backup dữ liệu định kỳ", status: "Đã hoàn thành", note: "Sao lưu lên Cloud AWS" },
      { name: "Cập nhật bản vá bảo mật", status: "Đã hoàn thành", note: "Bản vá v1.2.4" }
    ];

    return {
      title: "BIÊN BẢN BẢO TRÌ & HỖ TRỢ / MAINTENANCE RECORD",
      ...reference,
      issues,
      maintenanceDate: new Date(),
      technician: "Nguyễn Văn Kỹ Thuật"
    };
  }

  async loadForPaymentRequest(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);

    // Usually payment request is for a specific milestone or total
    const paymentAmount = reference.contract.value ? Number(reference.contract.value) * 0.3 : 0; // Requesting 30% for demo
    const paymentReason = "Thanh toán tạm ứng đợt 1 theo hợp đồng (30%)";

    return {
      title: "GIẤY ĐỀ NGHỊ THANH TOÁN / PAYMENT REQUEST",
      ...reference,
      requestDate: new Date(),
      paymentAmount,
      paymentReason,
      bankName: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)",
      bankAccountNo: "0123456789",
      bankAccountName: "CONG TY TNHH AHSO"
    };
  }

  async loadForPaymentReceipt(entityId: string): Promise<Record<string, unknown>> {
    const reference = await this.loadContractOrQuoteReference(entityId);

    const receiptAmount = reference.contract.value ? Number(reference.contract.value) * 0.3 : 0;
    const paymentMethod = "Chuyển khoản (Bank Transfer)";
    const receiptReason = `Thu tiền tạm ứng HĐ số ${reference.contract.contractNo}`;

    return {
      title: "PHIẾU THU / PAYMENT RECEIPT",
      ...reference,
      receiptDate: new Date(),
      receiptAmount,
      paymentMethod,
      receiptReason,
      cashier: "Nguyễn Thu Ngân",
      payerName: reference.primaryContact?.name || "Đại diện khách hàng"
    };
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
      const invoiced = contractValue * 0.7;
      const paid = contractValue * 0.3;
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

    return {
      title: "BẢNG ĐỐI CHIẾU CÔNG NỢ / AR RECONCILIATION STATEMENT",
      customer,
      primaryContact: customer.contacts[0] || null,
      reconDate,
      periodStart: new Date(reconDate.getFullYear(), 0, 1), // Jan 1 of current year
      periodEnd: reconDate,
      lineItems,
      totals: {
        contractValue: totalContractValue,
        invoiced: totalInvoiced,
        paid: totalPaid,
        outstanding: totalOutstanding
      }
    };
  }
}
