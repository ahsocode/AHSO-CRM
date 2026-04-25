import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().trim().min(1, "DATABASE_URL là bắt buộc"),
    REDIS_URL: z.string().trim().url("REDIS_URL không hợp lệ").default("redis://127.0.0.1:6379"),
    JWT_SECRET: z.string().trim().min(16, "JWT_SECRET phải có ít nhất 16 ký tự"),
    JWT_EXPIRES_IN: z.string().trim().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().trim().default("7d"),
    JWT_RESET_SECRET: optionalString,
    JWT_RESET_EXPIRES_IN: z.string().trim().default("15m"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    FRONTEND_URL: optionalUrl,
    CORS_ORIGIN: z.preprocess(emptyToUndefined, z.string().optional()),
    SWAGGER_ENABLED: z.enum(["true", "false"]).default("false"),
    THROTTLE_TTL: z.coerce.number().int().min(1).default(60),
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),
    UPLOAD_DIR: z.string().trim().default("./uploads"),
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug", "verbose"]).default("debug"),
    ANTHROPIC_API_KEY: optionalString,
    ANTHROPIC_MODEL: z.string().trim().default("claude-sonnet-4-20250514"),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    SMTP_FROM: z.string().trim().default("AHSO CRM <noreply@ahso.vn>"),
    TWILIO_SID: optionalString,
    TWILIO_TOKEN: optionalString,
    TWILIO_FROM: optionalString,
    SENTRY_DSN: optionalUrl,
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
    VAPID_PUBLIC_KEY: optionalString,
    VAPID_PRIVATE_KEY: optionalString,
    VAPID_SUBJECT: optionalString,
    PUPPETEER_EXECUTABLE_PATH: optionalString
  })
  .superRefine((env, context) => {
    const isProduction = env.NODE_ENV === "production";

    if (isProduction && !env.FRONTEND_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FRONTEND_URL"],
        message: "FRONTEND_URL là bắt buộc trong production"
      });
    }

    const smtpValues = [env.SMTP_HOST, env.SMTP_USER, env.SMTP_PASS].filter(Boolean);
    if (smtpValues.length > 0 && smtpValues.length < 3) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_HOST"],
        message: "SMTP_HOST, SMTP_USER và SMTP_PASS phải được cấu hình cùng nhau"
      });
    }

    const twilioValues = [env.TWILIO_SID, env.TWILIO_TOKEN, env.TWILIO_FROM].filter(Boolean);
    if (twilioValues.length > 0 && twilioValues.length < 3) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TWILIO_SID"],
        message: "TWILIO_SID, TWILIO_TOKEN và TWILIO_FROM phải được cấu hình cùng nhau"
      });
    }

    const vapidValues = [env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT].filter(Boolean);
    if (vapidValues.length > 0 && vapidValues.length < 3) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["VAPID_PUBLIC_KEY"],
        message: "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY và VAPID_SUBJECT phải được cấu hình cùng nhau"
      });
    }
  });

export type ValidatedEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (result.success) {
    return result.data;
  }

  const details = result.error.issues
    .map((issue) => `${issue.path.join(".") || "ENV"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Cấu hình môi trường không hợp lệ: ${details}`);
}
