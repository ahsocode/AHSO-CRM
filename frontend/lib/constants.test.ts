import { describe, expect, it } from "vitest";
import { normalizeBackendUrl } from "./constants";

describe("normalizeBackendUrl", () => {
  it("strips trailing /api from NEXT_PUBLIC_API_URL-style values", () => {
    expect(normalizeBackendUrl("https://crm.ahso.vn/api")).toBe("https://crm.ahso.vn");
    expect(normalizeBackendUrl("https://crm.ahso.vn/api/")).toBe("https://crm.ahso.vn");
  });

  it("keeps backend origins without api suffix unchanged", () => {
    expect(normalizeBackendUrl("http://localhost:3001")).toBe("http://localhost:3001");
    expect(normalizeBackendUrl(" https://crm.ahso.vn/ ")).toBe("https://crm.ahso.vn");
  });
});
