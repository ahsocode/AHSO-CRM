import { validateEnv } from "./env.validation";

const baseEnv = {
  DATABASE_URL: "postgresql://ahso:password@localhost:5432/ahso_crm?schema=public",
  JWT_SECRET: "jwt-secret-with-at-least-32-characters",
  JWT_REFRESH_SECRET: "refresh-secret-with-at-least-32-chars",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef"
};
const productionEncryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("environment validation", () => {
  it("accepts the minimum development configuration and applies defaults", () => {
    const env = validateEnv(baseEnv);

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3001);
    expect(env.REDIS_URL).toBe("redis://127.0.0.1:6379");
    expect(env.THROTTLE_TTL).toBe(60);
    expect(env.THROTTLE_LIMIT).toBe(100);
  });

  it("rejects missing required production database and JWT settings", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({
      DATABASE_URL: baseEnv.DATABASE_URL,
      JWT_SECRET: "short",
      JWT_REFRESH_SECRET: baseEnv.JWT_REFRESH_SECRET,
      ENCRYPTION_KEY: baseEnv.ENCRYPTION_KEY
    })).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({
      DATABASE_URL: baseEnv.DATABASE_URL,
      JWT_SECRET: baseEnv.JWT_SECRET,
      JWT_REFRESH_SECRET: "short",
      ENCRYPTION_KEY: baseEnv.ENCRYPTION_KEY
    })).toThrow(/JWT_REFRESH_SECRET/);
  });

  it("requires FRONTEND_URL in production", () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: "production"
      })
    ).toThrow(/FRONTEND_URL/);
  });

  it("accepts both 32-char and 64-char hex ENCRYPTION_KEY in production", () => {
    // 32-char key (backward compatible with existing encrypted data on server)
    expect(
      validateEnv({
        ...baseEnv,
        NODE_ENV: "production",
        FRONTEND_URL: "https://crm.ahso.vn"
      }).ENCRYPTION_KEY
    ).toBe(baseEnv.ENCRYPTION_KEY);

    // 64-char hex key (preferred for new deployments)
    expect(
      validateEnv({
        ...baseEnv,
        NODE_ENV: "production",
        FRONTEND_URL: "https://crm.ahso.vn",
        ENCRYPTION_KEY: productionEncryptionKey
      }).ENCRYPTION_KEY
    ).toBe(productionEncryptionKey);
  });

  it("rejects partial external integration credentials", () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        SMTP_HOST: "smtp.example.com",
        SMTP_USER: "user"
      })
    ).toThrow(/SMTP_HOST/);

    expect(() =>
      validateEnv({
        ...baseEnv,
        TWILIO_SID: "sid"
      })
    ).toThrow(/TWILIO_SID/);

    expect(() =>
      validateEnv({
        ...baseEnv,
        VAPID_PUBLIC_KEY: "public"
      })
    ).toThrow(/VAPID_PUBLIC_KEY/);
  });
});
