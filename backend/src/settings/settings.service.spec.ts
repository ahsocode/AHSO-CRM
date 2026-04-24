import { PrismaService } from "src/common/prisma.service";
import { UploadService } from "src/upload/upload.service";
import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  let service: SettingsService;
  let prisma: {
    setting: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let uploadService: {
    readFileAsDataUrl: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      setting: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn()
      }
    };
    uploadService = {
      readFileAsDataUrl: jest.fn()
    };

    service = new SettingsService(prisma as unknown as PrismaService, uploadService as unknown as UploadService);
  });

  it("returns only the safe public company fields", async () => {
    jest.spyOn(service, "getCompanyInfo").mockResolvedValue({
      name: "AHSO",
      shortName: "AHSO",
      taxId: "0316896939",
      address: "Ho Chi Minh City",
      phone: "0900",
      email: "contact@ahso.vn",
      website: "ahso.vn",
      bankName: "Vietcombank",
      bankAccount: "123456789",
      bankBranch: "District 1",
      bankAccountName: "AHSO Co., Ltd"
    } as any);

    const publicInfo = await service.getPublicCompanyInfo();

    expect(publicInfo).toEqual({
      name: "AHSO",
      shortName: "AHSO",
      taxId: "0316896939",
      address: "Ho Chi Minh City",
      phone: "0900",
      email: "contact@ahso.vn",
      website: "ahso.vn"
    });
    expect(publicInfo).not.toHaveProperty("bankName");
    expect(publicInfo).not.toHaveProperty("bankAccount");
    expect(publicInfo).not.toHaveProperty("bankBranch");
    expect(publicInfo).not.toHaveProperty("bankAccountName");
  });

  it("returns data url for local logo paths when file can be read", async () => {
    prisma.setting.findUnique.mockResolvedValue({
      key: "logo:url",
      value: JSON.stringify("/uploads/logos/logo.png")
    });
    uploadService.readFileAsDataUrl.mockResolvedValue("data:image/png;base64,abc");

    await expect(service.getLogoUrl()).resolves.toBe("data:image/png;base64,abc");
    expect(uploadService.readFileAsDataUrl).toHaveBeenCalledWith("/uploads/logos/logo.png");
  });

  it("falls back to the stored path when a local logo cannot be converted", async () => {
    prisma.setting.findUnique.mockResolvedValue({
      key: "logo:url",
      value: JSON.stringify("/uploads/logos/logo.png")
    });
    uploadService.readFileAsDataUrl.mockResolvedValue(null);

    await expect(service.getLogoUrl()).resolves.toBe("/uploads/logos/logo.png");
  });
});
