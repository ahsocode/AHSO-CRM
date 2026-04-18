import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { ContractsService } from "./contracts.service";

describe("ContractsService", () => {
  const user = {
    sub: "user-1",
    email: "admin@ahso.vn",
    name: "Admin",
    role: "ADMIN" as const
  };

  let service: ContractsService;
  let prisma: {
    $transaction: jest.Mock;
  };
  let tx: {
    project: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    contract: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    tx = {
      project: {
        findFirst: jest.fn(),
        update: jest.fn()
      },
      contract: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    };

    prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };

    service = new ContractsService(prisma as unknown as PrismaService);
  });

  it("creates a contract from an accepted quote and moves the project into delivering", async () => {
    const currentYear = new Date().getFullYear();
    tx.project.findFirst.mockResolvedValue({
      id: "project-1",
      status: "WON",
      contract: null,
      quotes: [
        {
          id: "quote-accepted"
        }
      ]
    });
    tx.contract.findFirst.mockResolvedValue({
      contractNo: `HD-${currentYear}-004`
    });
    tx.contract.create.mockResolvedValue({
      id: "contract-1",
      contractNo: `HD-${currentYear}-005`,
      status: "ACTIVE"
    });

    await expect(
      service.create(
        {
          projectId: "project-1",
          sourceQuoteId: "quote-accepted",
          value: 5_000_000,
          status: "ACTIVE",
          notes: "Kích hoạt ngay sau khi khách xác nhận"
        },
        user
      )
    ).resolves.toEqual({
      id: "contract-1",
      contractNo: `HD-${currentYear}-005`,
      status: "ACTIVE"
    });

    expect(tx.contract.create).toHaveBeenCalledWith({
      data: {
        contractNo: `HD-${currentYear}-005`,
        signDate: undefined,
        startDate: undefined,
        endDate: undefined,
        value: 5_000_000,
        status: "ACTIVE",
        fileUrl: undefined,
        notes: "Kích hoạt ngay sau khi khách xác nhận",
        projectId: "project-1"
      },
      select: {
        id: true,
        contractNo: true,
        status: true
      }
    });
    expect(tx.project.update).toHaveBeenCalledWith({
      where: {
        id: "project-1"
      },
      data: {
        status: "DELIVERING"
      }
    });
  });

  it("rejects creating a second contract for the same project", async () => {
    tx.project.findFirst.mockResolvedValue({
      id: "project-1",
      status: "WON",
      contract: {
        id: "contract-existing"
      },
      quotes: [
        {
          id: "quote-accepted"
        }
      ]
    });

    await expect(
      service.create(
        {
          projectId: "project-1",
          sourceQuoteId: "quote-accepted",
          value: 5_000_000,
          status: "ACTIVE"
        },
        user
      )
    ).rejects.toThrow(new BadRequestException("Dự án này đã có hợp đồng"));

    expect(tx.contract.create).not.toHaveBeenCalled();
    expect(tx.project.update).not.toHaveBeenCalled();
  });

  it("updates a completed contract and synchronizes the project status", async () => {
    tx.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      status: "ACTIVE",
      project: {
        status: "DELIVERING"
      }
    });
    tx.contract.update.mockResolvedValue({
      id: "contract-1",
      contractNo: "HD-2026-005",
      status: "COMPLETED"
    });

    await expect(
      service.update(
        "contract-1",
        {
          status: "COMPLETED",
          notes: "Nghiệm thu xong"
        },
        user
      )
    ).resolves.toEqual({
      id: "contract-1",
      contractNo: "HD-2026-005",
      status: "COMPLETED"
    });

    expect(tx.contract.update).toHaveBeenCalledWith({
      where: {
        id: "contract-1"
      },
      data: {
        notes: "Nghiệm thu xong",
        status: "COMPLETED"
      },
      select: {
        id: true,
        contractNo: true,
        status: true
      }
    });
    expect(tx.project.update).toHaveBeenCalledWith({
      where: {
        id: "project-1"
      },
      data: {
        status: "COMPLETED"
      }
    });
  });
});
