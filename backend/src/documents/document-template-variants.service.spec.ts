import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { DocumentDataLoaderService } from "./document-data-loader.service";
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
      new BadRequestException("Chỉ variant đã publish mới có thể đặt active.")
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
});
