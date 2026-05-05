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

  it("tolerates legacy raw string setting values", async () => {
    prisma.setting.findMany.mockResolvedValue([
      {
        key: "company:name",
        value: "AHSO Legacy",
        description: null
      },
      {
        key: "company:website",
        value: JSON.stringify("https://www.ahso.vn"),
        description: null
      }
    ]);

    await expect(service.getCompanyInfo()).resolves.toEqual({
      name: "AHSO Legacy",
      website: "https://www.ahso.vn"
    });
  });

  it("serializes null instead of undefined when clearing a setting value", async () => {
    prisma.setting.upsert.mockResolvedValue({
      key: "company:phone",
      value: "null",
      description: "Company phone"
    });

    await service.upsertSetting("company:phone", undefined, "Company phone");

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ value: "null" }),
        update: expect.objectContaining({ value: "null" })
      })
    );
  });

  it("returns a safe default public company profile when company settings are missing", async () => {
    jest.spyOn(service, "getCompanyInfo").mockResolvedValue({});

    await expect(service.getPublicCompanyInfo()).resolves.toEqual({
      name: "AHSO CRM",
      shortName: "AHSO",
      taxId: null,
      address: null,
      phone: null,
      email: null,
      website: null
    });
  });

  it("falls back when public company fields are empty strings", async () => {
    jest.spyOn(service, "getCompanyInfo").mockResolvedValue({
      name: "",
      shortName: "   "
    } as any);

    await expect(service.getPublicCompanyInfo()).resolves.toMatchObject({
      name: "AHSO CRM",
      shortName: "AHSO"
    });
  });

  it("returns a safe public settings bundle", async () => {
    jest.spyOn(service, "getCompanyInfo").mockResolvedValue({
      name: "AHSO",
      bankAccount: "secret"
    } as any);
    prisma.setting.findUnique.mockResolvedValue(null);

    await expect(service.getPublicSettings()).resolves.toEqual({
      company: {
        name: "AHSO",
        shortName: "AHSO",
        taxId: null,
        address: null,
        phone: null,
        email: null,
        website: null
      },
      logo: null
    });
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

  it("supports legacy raw logo setting values", async () => {
    prisma.setting.findUnique.mockResolvedValue({
      key: "logo:url",
      value: "/uploads/logos/logo.png"
    });
    uploadService.readFileAsDataUrl.mockResolvedValue("data:image/png;base64,abc");

    await expect(service.getLogoUrl()).resolves.toBe("data:image/png;base64,abc");
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
