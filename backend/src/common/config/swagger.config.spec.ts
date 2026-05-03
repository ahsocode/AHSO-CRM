import { isSwaggerEnabled } from "./swagger.config";

const config = (values: Record<string, string | undefined>) => ({
  get: <T = string>(key: string) => values[key] as T | undefined
});

describe("Swagger config", () => {
  it("is disabled by default in all environments", () => {
    expect(isSwaggerEnabled(config({ NODE_ENV: "development" }))).toBe(false);
    expect(isSwaggerEnabled(config({ NODE_ENV: "production" }))).toBe(false);
    expect(isSwaggerEnabled(config({ NODE_ENV: "test" }))).toBe(false);
    expect(isSwaggerEnabled(config({}))).toBe(false);
  });

  it("is enabled only when SWAGGER_ENABLED=true is explicitly set", () => {
    expect(isSwaggerEnabled(config({ SWAGGER_ENABLED: "true" }))).toBe(true);
    expect(isSwaggerEnabled(config({ NODE_ENV: "production", SWAGGER_ENABLED: "true" }))).toBe(true);
    expect(isSwaggerEnabled(config({ NODE_ENV: "development", SWAGGER_ENABLED: "false" }))).toBe(false);
  });
});
