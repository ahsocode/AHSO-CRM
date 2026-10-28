import { DocumentDataLoaderService, buildCompanyProfile } from "./document-data-loader.service";
import { pickAllowedExtra } from "./documents.service";
import { RENDER_EXTRA_ALLOWED_KEYS, renderDocumentSchema } from "./dto/render-document.dto";
import { FIXTURE_USER, createRenderHarness } from "./__fixtures__/document-fixtures";

/** Security: `extra` must not override company / bank / logo / signer identity on stored PDFs (audit E-07). */
const ATTACK = {
  company: { name: "CÔNG TY GIẢ MẠO", bankAccount: "6666666666", bankName: "Ngân hàng giả" },
  logo: "http://169.254.169.254/latest/meta-data",
  policies: { warrantyPeriodMonths: 99 },
  partyB: { name: "Người ký giả", title: "Giám đốc giả" },
  bankAccountNo: "6666666666",
  docNumber: "FAKE-001",
  generatedAt: "2000-01-01T00:00:00.000Z",
  user: { id: "x", name: "x", email: "x" }
};

describe("render `extra` allow-list", () => {
  it("allows exactly the documented keys", () => {
    expect([...RENDER_EXTRA_ALLOWED_KEYS]).toEqual(["signedCopies"]);
  });

  it("DTO rejects any non allow-listed key", () => {
    for (const [key, value] of Object.entries(ATTACK)) {
      expect(renderDocumentSchema.safeParse({ extra: { [key]: value } }).success).toBe(false);
    }
    expect(renderDocumentSchema.safeParse({ extra: { signedCopies: true } }).success).toBe(true);
    expect(renderDocumentSchema.safeParse({ extra: { signedCopies: "yes" } }).success).toBe(false);
  });

  it("service drops everything but allow-listed keys even if the DTO is bypassed", () => {
    expect(pickAllowedExtra({ ...ATTACK, signedCopies: true })).toEqual({ signedCopies: true });
    expect(pickAllowedExtra(undefined)).toEqual({});
  });

  it.each(["PAYMENT_REQUEST", "CONTRACT"] as const)("stored %s PDF ignores an override attempt", async (type) => {
    const harness = await createRenderHarness("full");
    await harness.service.renderPdf(type, "contract-orion", "vi", undefined, ATTACK as Record<string, unknown>, FIXTURE_USER);
    const html = harness.pdfHtml[0];
    expect(html).toBeDefined();
    for (const forged of ["CÔNG TY GIẢ MẠO", "6666666666", "169.254.169.254", "Người ký giả", "FAKE-001", "99 tháng"]) {
      expect(html).not.toContain(forged);
    }
    expect(html).toContain("CÔNG TY TNHH AHSO");
    expect(html).toContain("FX-2026-ORION-001-v1");
    if (type === "PAYMENT_REQUEST") expect(html).toContain("19036688990011");
  });
});

describe("company profile (audit E-02)", () => {
  it("aliases settings `taxId` to `taxCode` without dropping either", () => {
    expect(buildCompanyProfile({ name: "AHSO", taxId: "0316896939" })).toMatchObject({ taxId: "0316896939", taxCode: "0316896939" });
    expect(buildCompanyProfile({ taxCode: "111", taxId: "222" })).toMatchObject({ taxCode: "111", taxId: "222" });
    expect(buildCompanyProfile(undefined)).toEqual({});
    expect(buildCompanyProfile({ taxId: "  " })).not.toHaveProperty("taxCode");
  });

  it("is applied by loadBaseContext", async () => {
    const loader = new DocumentDataLoaderService(
      {} as never,
      { getAllSettings: async () => ({ company: { taxId: "0316896939" }, policies: {}, logo: null }) } as never,
      {} as never
    );
    const base = await loader.loadBaseContext(FIXTURE_USER, "vi");
    expect(base.company.taxCode).toBe("0316896939");
  });
});
