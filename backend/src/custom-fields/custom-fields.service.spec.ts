import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CustomFieldsService } from "./custom-fields.service";

interface PrismaMock {
  customField: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  customFieldValue: {
    findMany: jest.Mock;
    upsert: jest.Mock;
  };
  $transaction: jest.Mock;
}

describe("CustomFieldsService", () => {
  let prisma: PrismaMock;
  let service: CustomFieldsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CustomFieldsService(prisma as never as PrismaService);
  });

  it("findAll returns fields filtered by resource", async () => {
    const fields = [
      {
        id: "field-1",
        resource: "customer",
        name: "factory_area",
        label: "Khu vực nhà máy",
        type: "text",
        order: 1
      }
    ];
    prisma.customField.findMany.mockResolvedValue(fields);

    await expect(service.findAll({ resource: "customer" })).resolves.toEqual(fields);

    expect(prisma.customField.findMany).toHaveBeenCalledWith({
      where: { resource: "customer" },
      orderBy: [{ resource: "asc" }, { order: "asc" }, { label: "asc" }]
    });
  });

  it("creates a field and relies on the database unique resource/name constraint", async () => {
    prisma.customField.create.mockResolvedValue({
      id: "field-1",
      resource: "customer",
      name: "industry_code"
    });

    await expect(service.create({
      resource: "customer",
      name: "industry_code",
      label: "Mã ngành",
      type: "select",
      options: ["F&B", "Water"],
      required: true,
      order: 2
    })).resolves.toEqual({
      id: "field-1",
      resource: "customer",
      name: "industry_code"
    });

    expect(prisma.customField.create).toHaveBeenCalledWith({
      data: {
        resource: "customer",
        name: "industry_code",
        label: "Mã ngành",
        type: "select",
        options: ["F&B", "Water"],
        required: true,
        order: 2
      }
    });
  });

  it("rejects select fields without options", async () => {
    await expect(service.create({
      resource: "project",
      name: "priority_group",
      label: "Nhóm ưu tiên",
      type: "select",
      required: false,
      order: 0
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.customField.create).not.toHaveBeenCalled();
  });

  it("updates label and options using the existing field as fallback", async () => {
    prisma.customField.findUnique.mockResolvedValue({
      id: "field-1",
      resource: "customer",
      name: "segment",
      label: "Phân khúc",
      type: "select",
      options: ["A", "B"],
      required: false,
      order: 1
    });
    prisma.customField.update.mockResolvedValue({
      id: "field-1",
      label: "Nhóm khách hàng",
      options: ["VIP", "Standard"]
    });

    await expect(service.update("field-1", {
      label: "Nhóm khách hàng",
      options: ["VIP", "Standard"]
    })).resolves.toEqual({
      id: "field-1",
      label: "Nhóm khách hàng",
      options: ["VIP", "Standard"]
    });

    expect(prisma.customField.update).toHaveBeenCalledWith({
      where: { id: "field-1" },
      data: {
        resource: "customer",
        name: "segment",
        label: "Nhóm khách hàng",
        type: "select",
        options: ["VIP", "Standard"],
        required: false,
        order: 1
      }
    });
  });

  it("throws NotFoundException when updating a missing field", async () => {
    prisma.customField.findUnique.mockResolvedValue(null);

    await expect(service.update("missing", { label: "Không tồn tại" }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it("removes a field using Prisma cascade behavior", async () => {
    prisma.customField.delete.mockResolvedValue({ id: "field-1" });

    await expect(service.remove("field-1")).resolves.toEqual({ success: true });

    expect(prisma.customField.delete).toHaveBeenCalledWith({
      where: { id: "field-1" }
    });
  });
});

function createPrismaMock(): PrismaMock {
  return {
    customField: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    customFieldValue: {
      findMany: jest.fn(),
      upsert: jest.fn()
    },
    $transaction: jest.fn()
  };
}
