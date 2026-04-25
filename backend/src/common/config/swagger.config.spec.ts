import { isSwaggerEnabled } from "./swagger.config";

const config = (values: Record<string, string | undefined>) => ({
  get: <T = string>(key: string) => values[key] as T | undefined
});

describe("Swagger config", () => {
  it("is enabled outside production by default", () => {
    expect(isSwaggerEnabled(config({ NODE_ENV: "development" }))).toBe(true);
    expect(isSwaggerEnabled(config({ NODE_ENV: "test" }))).toBe(true);
  });

  it("is disabled in production unless explicitly enabled", () => {
    expect(isSwaggerEnabled(config({ NODE_ENV: "production" }))).toBe(false);
    expect(isSwaggerEnabled(config({ NODE_ENV: "production", SWAGGER_ENABLED: "true" }))).toBe(true);
  });
});
