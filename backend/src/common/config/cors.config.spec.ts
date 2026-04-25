import { buildCorsOptions, resolveAllowedCorsOrigins } from "./cors.config";

describe("CORS config", () => {
  it("uses localhost and 127.0.0.1 defaults for development and CI", () => {
    expect(resolveAllowedCorsOrigins({})).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ]);
  });

  it("deduplicates CORS_ORIGIN and FRONTEND_URL values", () => {
    const origins = resolveAllowedCorsOrigins({
      CORS_ORIGIN: "https://crm.ahso.vn, http://localhost:3000",
      FRONTEND_URL: "https://crm.ahso.vn"
    });

    expect(origins).toEqual(["https://crm.ahso.vn", "http://localhost:3000"]);
  });

  it("returns a single origin string when only one origin is configured", () => {
    expect(buildCorsOptions({ CORS_ORIGIN: "https://crm.ahso.vn" })).toEqual({
      origin: "https://crm.ahso.vn",
      credentials: true
    });
  });
});
