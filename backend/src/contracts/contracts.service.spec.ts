import { BadRequestException } from "@nestjs/common";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../common/prisma.service";
import { UploadService } from "../upload/upload.service";
import { ContractsService } from "./contracts.service";

describe("ContractsService", () => {
  const user = {
    sub: "user-1",
    email: "admin@ahso.vn",
    name: "Admin",
    role: "ADMIN" as const,
    permissions: []
  };

  let service: ContractsService;
  let prisma: {
    $transaction: jest.Mock;
    contract: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
    payment: {
      create: jest.Mock;
    };
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
  let uploadService: {
    deleteFile: jest.Mock;
    isLocalUploadPath: jest.Mock;
  };
  let customFieldsService: {
    saveValues: jest.Mock;
  };
  let emailService: {
    sendEmail: jest.Mock;
  };
  let domainEvents: {
    emit: jest.Mock;
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
      contract: {
        findUnique: jest.fn(),
        findFirst: jest.fn()
      },
      payment: {
        create: jest.fn()
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    uploadService = {
      deleteFile: jest.fn().mockResolvedValue(true),
      isLocalUploadPath: jest.fn().mockReturnValue(false)
    };
    customFieldsService = {
      saveValues: jest.fn().mockResolvedValue(undefined)
    };
    emailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true })
    };
    domainEvents = {
      emit: jest.fn()
    };

    service = new ContractsService(
      prisma as unknown as PrismaService,
      customFieldsService as unknown as CustomFieldsService,
      uploadService as unknown as UploadService,
      emailService as unknown as EmailService,
      domainEvents as unknown as DomainEventsService
    );
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
    prisma.contract.findUnique.mockResolvedValue({
      id: "contract-1",
      contractNo: `HD-${currentYear}-005`,
      projectId: "project-1",
      status: "ACTIVE",
      value: 5_000_000,
      project: {
        name: "Dự án A",
        customer: {
          id: "customer-1",
          name: "Công ty A",
          assignedTo: {
            email: "manager@ahso.vn",
            name: "Manager"
          },
          contacts: []
        }
      }
    });

    await expect(
      service.create(
        {
          projectId: "project-1",
          sourceQuoteId: "quote-accepted",
          value: 5_000_000,
          status: "ACTIVE",
          notes: "Kích hoạt ngay sau khi khách xác nhận",
          customFieldValues: {}
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
          status: "ACTIVE",
          customFieldValues: {}
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
    prisma.contract.findUnique.mockResolvedValue({
      id: "contract-1",
      contractNo: "HD-2026-005",
      projectId: "project-1",
      status: "COMPLETED",
      value: 5_000_000,
      project: {
        name: "Dự án A",
        customer: {
          id: "customer-1",
          name: "Công ty A",
          assignedTo: {
            email: "manager@ahso.vn",
            name: "Manager"
          },
          contacts: []
        }
      }
    });

    await expect(
      service.update(
        "contract-1",
        {
          status: "COMPLETED",
          notes: "Nghiệm thu xong",
          customFieldValues: {}
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

  it("creates a payment when the new total does not exceed contract value", async () => {
    prisma.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      value: 10_000_000,
      payments: [{ amount: 3_000_000 }]
    });
    prisma.payment.create.mockResolvedValue({
      id: "payment-1",
      amount: 2_000_000,
      paidAt: new Date("2026-04-25T00:00:00.000Z"),
      method: "Chuyển khoản",
      reference: "UNC-001",
      notes: "Thanh toán đợt 2"
    });
    prisma.contract.findUnique.mockResolvedValue({
      id: "contract-1",
      contractNo: "HD-001",
      projectId: "project-1",
      status: "ACTIVE",
      value: 10_000_000,
      project: {
        id: "project-1",
        name: "Dự án A",
        customer: {
          id: "customer-1",
          name: "Công ty A",
          assignedTo: {
            id: "user-1",
            email: "manager@ahso.vn",
            name: "Manager"
          },
          contacts: []
        }
      }
    });

    await expect(
      service.createPayment(
        "contract-1",
        {
          amount: 2_000_000,
          paidAt: new Date("2026-04-25T00:00:00.000Z"),
          method: "Chuyển khoản",
          reference: "UNC-001",
          notes: "Thanh toán đợt 2"
        },
        user
      )
    ).resolves.toMatchObject({
      id: "payment-1",
      amount: 2_000_000,
      method: "Chuyển khoản"
    });

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        amount: 2_000_000,
        paidAt: new Date("2026-04-25T00:00:00.000Z"),
        method: "Chuyển khoản",
        reference: "UNC-001",
        notes: "Thanh toán đợt 2",
        contractId: "contract-1"
      }
    });
    expect(domainEvents.emit).toHaveBeenCalledWith(
      "payment.received",
      expect.objectContaining({
        paymentId: "payment-1",
        ownerUserId: "user-1",
        amount: 2_000_000
      })
    );
  });

  it("rejects payment creation when it would overpay the contract", async () => {
    prisma.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      value: 10_000_000,
      payments: [{ amount: 8_000_000 }]
    });

    await expect(
      service.createPayment(
        "contract-1",
        {
          amount: 3_000_000,
          paidAt: new Date("2026-04-25T00:00:00.000Z")
        },
        user
      )
    ).rejects.toThrow(
      new BadRequestException("Tổng thanh toán (11.000.000 VND) không được vượt giá trị hợp đồng (10.000.000 VND)")
    );

    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(domainEvents.emit).not.toHaveBeenCalledWith("payment.received", expect.anything());
  });
});
