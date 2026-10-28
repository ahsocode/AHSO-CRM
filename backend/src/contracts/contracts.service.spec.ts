import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../common/prisma.service";
import { UploadService } from "../upload/upload.service";
import { ContractsService } from "./contracts.service";
import { contractFilterSchema } from "./dto/contract-filter.dto";

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
      update: jest.Mock;
    };
    milestone: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    payment: {
      create: jest.Mock;
    };
  };
  let tx: {
    $executeRaw: jest.Mock;
    project: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    contract: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    payment: {
      create: jest.Mock;
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
      $executeRaw: jest.fn().mockResolvedValue(1),
      project: {
        findFirst: jest.fn(),
        update: jest.fn()
      },
      contract: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      payment: {
        create: jest.fn()
      }
    };

    prisma = {
      contract: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn()
      },
      milestone: {
        findFirst: jest.fn(),
        create: jest.fn()
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
          id: "quote-accepted",
          taxRate: 0,
          items: [
            {
              id: "quote-item-1",
              order: 1,
              name: "Máy đóng gói",
              description: "Phạm vi đã chốt",
              unit: "Bộ",
              quantity: 1,
              unitPrice: 5_000_000,
              total: 5_000_000,
              taxRate: 0
            }
          ]
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
        projectId: "project-1",
        items: {
          create: [
            {
              order: 1,
              name: "Máy đóng gói",
              description: "Phạm vi đã chốt",
              unit: "Bộ",
              quantity: 1,
              unitPrice: 5_000_000,
              total: 5_000_000,
              quoteItemId: "quote-item-1"
            }
          ]
        }
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
        status: "DELIVERING",
        estimatedValue: 5_000_000,
        stageChangedAt: expect.any(Date)
      }
    });
  });

  it("derives contract value from selected quote items instead of trusting the request value", async () => {
    const currentYear = new Date().getFullYear();
    tx.project.findFirst.mockResolvedValue({
      id: "project-1",
      status: "WON",
      contract: null,
      quotes: [
        {
          id: "quote-accepted",
          taxRate: 10,
          items: [
            {
              id: "quote-item-1",
              order: 1,
              name: "Hạng mục loại bỏ",
              description: null,
              unit: "Bộ",
              quantity: 1,
              unitPrice: 100,
              total: 100,
              taxRate: 10
            },
            {
              id: "quote-item-2",
              order: 2,
              name: "Hạng mục triển khai",
              description: null,
              unit: "Bộ",
              quantity: 1,
              unitPrice: 500,
              total: 500,
              taxRate: 10
            }
          ]
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
      value: 550,
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

    await service.create(
      {
        projectId: "project-1",
        sourceQuoteId: "quote-accepted",
        sourceQuoteItemIds: ["quote-item-2"],
        value: 999_999,
        status: "ACTIVE",
        customFieldValues: {}
      },
      user
    );

    expect(tx.contract.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        value: 550,
        items: {
          create: [
            expect.objectContaining({
              name: "Hạng mục triển khai",
              quoteItemId: "quote-item-2",
              total: 500
            })
          ]
        }
      })
    }));
    expect(tx.project.update).toHaveBeenCalledWith({
      where: {
        id: "project-1"
      },
      data: {
        status: "DELIVERING",
        estimatedValue: 550,
        stageChangedAt: expect.any(Date)
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
      },
      value: 5_000_000
    });
    tx.contract.update.mockResolvedValue({
      id: "contract-1",
      contractNo: "HD-2026-005",
      status: "COMPLETED",
      value: 5_000_000
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
        status: true,
        value: true
      }
    });
    expect(tx.project.update).toHaveBeenCalledWith({
      where: {
        id: "project-1"
      },
      data: {
        status: "COMPLETED",
        estimatedValue: 5_000_000,
        stageChangedAt: expect.any(Date)
      }
    });
  });

  it("creates a payment when the new total does not exceed contract value", async () => {
    tx.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      value: 10_000_000,
      payments: [{ amount: 3_000_000 }]
    });
    tx.payment.create.mockResolvedValue({
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

    expect(tx.payment.create).toHaveBeenCalledWith({
      data: {
        amount: 2_000_000,
        paidAt: new Date("2026-04-25T00:00:00.000Z"),
        method: "Chuyển khoản",
        reference: "UNC-001",
        notes: "Thanh toán đợt 2",
        projectId: "project-1",
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
    tx.contract.findFirst.mockResolvedValue({
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
      new BadRequestException("Tổng thanh toán (11.000.000 ₫) không được vượt giá trị hợp đồng (10.000.000 ₫)")
    );

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(domainEvents.emit).not.toHaveBeenCalledWith("payment.received", expect.anything());
  });

  it("takes the per-contract advisory lock before reading the paid total", async () => {
    tx.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      value: 10_000_000,
      payments: [{ amount: 8_000_000 }]
    });

    await expect(
      service.createPayment("contract-1", { amount: 3_000_000, paidAt: new Date("2026-04-25T00:00:00.000Z") }, user)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const [sqlParts, lockKey] = tx.$executeRaw.mock.calls[0] as [TemplateStringsArray, string];
    expect(sqlParts.join("?")).toContain("pg_advisory_xact_lock(hashtext(");
    expect(lockKey).toBe("contract_payment_contract-1");
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.contract.findFirst.mock.invocationCallOrder[0]
    );
  });

  it("only accepts payments for contracts that are not soft-deleted", async () => {
    tx.contract.findFirst.mockResolvedValue(null);

    await expect(
      service.createPayment("contract-deleted", { amount: 1_000_000, paidAt: new Date("2026-04-25T00:00:00.000Z") }, user)
    ).rejects.toThrow(new NotFoundException("Không tìm thấy hợp đồng"));

    expect(tx.contract.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "contract-deleted", deletedAt: null })
      })
    );
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(domainEvents.emit).not.toHaveBeenCalled();
  });

  it("hides soft-deleted contracts from detail and delete lookups", async () => {
    prisma.contract.findFirst.mockResolvedValue(null);

    await expect(service.findOne("contract-deleted", user)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove("contract-deleted", user)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.contract.findFirst).toHaveBeenCalledTimes(2);
    for (const [args] of prisma.contract.findFirst.mock.calls as Array<[{ where: Record<string, unknown> }]>) {
      expect(args.where).toMatchObject({ id: "contract-deleted", deletedAt: null });
    }
    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it("rejects milestones on soft-deleted contracts", async () => {
    prisma.contract.findFirst.mockResolvedValue(null);

    await expect(
      service.createMilestone("contract-deleted", { name: "Đợt 1", status: "PENDING" } as never, user)
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.contract.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
    expect(prisma.milestone.create).not.toHaveBeenCalled();
  });

  it("does not update milestones whose contract is soft-deleted", async () => {
    prisma.milestone.findFirst.mockResolvedValue(null);

    await expect(service.updateMilestone("milestone-1", { name: "x" } as never, user)).rejects.toBeInstanceOf(
      NotFoundException
    );

    expect(prisma.milestone.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "milestone-1",
        contract: expect.objectContaining({ deletedAt: null })
      })
    });
  });

  it("rejects updating a soft-deleted contract", async () => {
    tx.contract.findFirst.mockResolvedValue(null);

    await expect(service.update("contract-deleted", { notes: "x" } as never, user)).rejects.toBeInstanceOf(
      NotFoundException
    );

    expect(tx.contract.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
    expect(tx.contract.update).not.toHaveBeenCalled();
  });
  describe("findAll ordering and cancelled filter", () => {
    let list: { findMany: jest.Mock; count: jest.Mock };

    const row = (id: string) => ({
      id,
      contractNo: id,
      status: "ACTIVE",
      value: 0,
      payments: [],
      _count: { payments: 0, milestones: 0 },
      project: { id: "p", code: "P", name: "P", status: "ACTIVE", customer: { id: "c", name: "C", shortName: null, status: "ACTIVE", assignedTo: { id: "u", name: "U", role: "STAFF" } } }
    });
    const setup = (rows: Array<ReturnType<typeof row>>[], counts: number[]) => {
      list = { findMany: jest.fn(), count: jest.fn() };
      rows.forEach((r) => list.findMany.mockResolvedValueOnce(r));
      counts.forEach((c) => list.count.mockResolvedValueOnce(c));
      list.findMany.mockResolvedValue([]);
      list.count.mockResolvedValue(0);
      (prisma as unknown as { contract: typeof list }).contract = list;
      prisma.$transaction.mockImplementation(async (ops: unknown) => Promise.all(ops as Promise<unknown>[]));
    };

    it("hides CANCELLED by default and orders by recency", async () => {
      setup([[row("a")], []], [1]);
      await service.findAll({ page: 1, limit: 10 } as never, user);

      const listCall = list.findMany.mock.calls[0][0];
      expect(listCall.where.status).toEqual({ not: "CANCELLED" });
      expect(listCall.orderBy).toEqual([{ updatedAt: "desc" }, { createdAt: "desc" }]);
      // KPI summary query keeps its original scope (no hidden cancelled filter)
      const summaryCall = list.findMany.mock.calls[1][0];
      expect(summaryCall.where.status).toBeUndefined();
    });

    it("explicit status filter wins over the default hide", async () => {
      setup([[], []], [0]);
      await service.findAll({ page: 1, limit: 10, status: "CANCELLED" } as never, user);

      expect(list.findMany.mock.calls[0][0].where.status).toBe("CANCELLED");
    });

    it("puts cancelled contracts after non-cancelled when includeCancelled is on", async () => {
      // 1 active total; page of 3 -> 1 active + 2 cancelled
      setup([[row("act")], [row("c1"), row("c2")]], [1, 3]);
      await service.findAll({ page: 1, limit: 3, includeCancelled: true } as never, user);

      const [activeCall, cancelledCall] = list.findMany.mock.calls;
      expect(activeCall[0].where.status).toEqual({ not: "CANCELLED" });
      expect(cancelledCall[0].where.status).toBe("CANCELLED");
      expect(cancelledCall[0].skip).toBe(0);
      expect(cancelledCall[0].take).toBe(2);
    });

    it("skips into the cancelled group on later pages", async () => {
      setup([[row("c3")]], [3]);
      await service.findAll({ page: 2, limit: 4, includeCancelled: true } as never, user);

      const first = list.findMany.mock.calls[0][0];
      expect(first.where.status).toBe("CANCELLED");
      expect(first.skip).toBe(1);
    });

    it("uses sortBy directly without the cancelled-last split", async () => {
      setup([[], []], []);
      await service.findAll(
        { page: 1, limit: 10, includeCancelled: true, sortBy: "value", sortDir: "asc" } as never,
        user
      );

      const call = list.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual([{ value: "asc" }, { createdAt: "desc" }]);
      expect(call.where.status).toBeUndefined();
    });
  });

  describe("contractFilterSchema sort allow-list", () => {
    it("accepts allowed fields and rejects others", () => {
      expect(contractFilterSchema.safeParse({ sortBy: "contractNo", sortDir: "asc" }).success).toBe(true);
      expect(contractFilterSchema.safeParse({ sortBy: "passwordHash" }).success).toBe(false);
      expect(contractFilterSchema.safeParse({ sortDir: "sideways" }).success).toBe(false);
      expect(contractFilterSchema.parse({ includeCancelled: "true" }).includeCancelled).toBe(true);
    });
  });
});
