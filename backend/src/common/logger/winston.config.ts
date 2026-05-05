import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { WinstonModuleOptions, utilities as nestWinstonUtilities } from "nest-winston";
import { format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const REDACTED_KEYS = new Set([
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "secret",
  "smtpPass",
  "twilioToken",
  "anthropicApiKey"
]);

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      REDACTED_KEYS.has(key) ? "[REDACTED]" : sanitizeValue(entry)
    ])
  );
}

function sanitizeInfo(info: Record<string, unknown>) {
  return sanitizeValue(info) as Record<string, unknown>;
}

function ensureLogDirectory() {
  const logDirectory = join(process.cwd(), "logs");

  if (!existsSync(logDirectory)) {
    mkdirSync(logDirectory, { recursive: true });
  }

  return logDirectory;
}

export function createWinstonLoggerOptions(): WinstonModuleOptions {
  const isProduction = (process.env.NODE_ENV ?? "development") === "production";
  const logDirectory = ensureLogDirectory();
  const baseFormat = format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format((info) => sanitizeInfo(info) as any)()
  );

  return {
    transports: [
      new transports.Console({
        level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
        format: isProduction
          ? format.combine(baseFormat, format.json())
          : format.combine(
              format.colorize(),
              baseFormat,
              nestWinstonUtilities.format.nestLike("AHSO CRM", {
                prettyPrint: true
              })
            )
      }),
      new DailyRotateFile({
        dirname: logDirectory,
        filename: "application-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        maxFiles: "14d",
        level: process.env.LOG_LEVEL ?? "info",
        format: format.combine(baseFormat, format.json())
      }),
      new DailyRotateFile({
        dirname: logDirectory,
        filename: "error-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        maxFiles: "14d",
        level: "error",
        format: format.combine(baseFormat, format.json())
      })
    ]
  };
}
