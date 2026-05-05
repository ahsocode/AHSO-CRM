import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { DocumentDataLoaderService } from "./document-data-loader.service";
import { createDefaultLayoutForType } from "./document-template-catalog";
import type { DocumentTemplateLayout } from "./document-template.types";
import { DocumentTemplateVariantsService } from "./document-template-variants.service";

const layoutJson = {
  version: 1,
  page: {
    widthMm: 210,
    heightMm: 297,
    gridMm: 5,
    marginMm: {
      top: 12,
      right: 12,
      bottom: 12,
      left: 12
    }
  },
  pages: [{ id: "page-1", boxes: [] }]
};

function makeVariant(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date("2026-04-20T09:00:00.000Z");

  return {
    id: "variant-1",
    type: "QUOTATION",
    name: "Quotation v1",
    status: "PUBLISHED",
    isActive: false,
    version: 1,
    layoutJson,
    createdById: "admin-1",
    approvedById: "admin-1",
    approvedAt: now,
    basedOnVariantId: null,
    createdAt: now,
    updatedAt: now,
    createdBy: {
      id: "admin-1",
      name: "Admin",
      email: "admin@ahso.vn"
    },
    approvedBy: {
      id: "admin-1",
      name: "Admin",
      email: "admin@ahso.vn"
    },
    ...overrides
  };
}

describe("DocumentTemplateVariantsService", () => {
  let service: DocumentTemplateVariantsService;
  let prisma: {
    $transaction: jest.Mock;
    documentTemplateVariant: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let tx: {
    documentTemplateVariant: {
      updateMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    tx = {
      documentTemplateVariant: {
        updateMany: jest.fn(),
        update: jest.fn()
      }
    };

    prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      documentTemplateVariant: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn()
      }
    };

    service = new DocumentTemplateVariantsService(
      prisma as unknown as PrismaService,
      {} as DocumentDataLoaderService
    );
  });

  it("rejects setting active for a variant that has not been published", async () => {
    prisma.documentTemplateVariant.findUnique.mockResolvedValue(
      makeVariant({
        status: "DRAFT"
      })
    );

    await expect(service.setActive("variant-1")).rejects.toThrow(
      new BadRequestException("Chỉ phiên bản template đã xuất bản mới có thể đặt làm bản đang dùng.")
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("deactivates the previous active variant before activating the published target", async () => {
    prisma.documentTemplateVariant.findUnique
      .mockResolvedValueOnce(makeVariant({ id: "variant-2" }))
      .mockResolvedValueOnce(makeVariant({ id: "variant-2", isActive: true }));

    await expect(service.setActive("variant-2")).resolves.toMatchObject({
      id: "variant-2",
      isActive: true,
      status: "PUBLISHED"
    });

    expect(tx.documentTemplateVariant.updateMany).toHaveBeenCalledWith({
      where: {
        type: "QUOTATION",
        isActive: true
      },
      data: {
        isActive: false
      }
    });
    expect(tx.documentTemplateVariant.update).toHaveBeenCalledWith({
      where: { id: "variant-2" },
      data: {
        isActive: true
      }
    });
  });

  it("does not falsely flag the default quotation intro as overflowing", () => {
    const issues = service.validateLayout(createDefaultLayoutForType("QUOTATION"), {
      customer: {
        name: "CÔNG TY TNHH AHSO INDUSTRIAL SOLUTIONS"
      },
      project: {
        name: "Nâng cấp hệ thống PLC trạm bơm và tích hợp giám sát vận hành"
      },
      quote: {
        quoteNo: "BG-2026-002",
        version: 1,
        validUntil: "2026-05-20T00:00:00.000Z"
      },
      items: []
    });

    expect(issues.find((issue) => issue.boxId === "quote-intro")).toBeUndefined();
  });

  it("reports text overflow as a warning instead of blocking publish", () => {
    const overflowLayout: DocumentTemplateLayout = {
      version: 1,
      page: layoutJson.page,
      pages: [
        {
          id: "page-1",
          boxes: [
            {
              id: "custom-text",
              type: "text",
              page: 0,
              x: 12,
              y: 12,
              width: 30,
              height: 10,
              zIndex: 10,
              visible: true,
              style: {
                fontSize: 10,
                lineHeight: 1.4,
                padding: 2
              },
              content: {
                text: {
                  vi: "Đây là đoạn nội dung rất dài dùng để kiểm tra cảnh báo overflow cho box text tùy chỉnh."
                }
              }
            }
          ]
        }
      ]
    };

    const issues = service.validateLayout(
      overflowLayout,
      {}
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        boxId: "custom-text",
        code: "overflow",
        severity: "warning"
      })
    );
  });
});
