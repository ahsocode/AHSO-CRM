import * as Sentry from "@sentry/node";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { WinstonModule } from "nest-winston";
import { join } from "path";
import { AppModule } from "./app.module";
import { createWinstonLoggerOptions } from "./common/logger/winston.config";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

async function bootstrap() {
  initializeSentry();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(createWinstonLoggerOptions())
  });
  const configService = app.get(ConfigService);

  // Global API prefix — all routes served under /api/*
  app.setGlobalPrefix("api");

  // Security headers. Frontend runs on a different origin/port in dev and CI,
  // so uploaded logos/files must be embeddable across origins.
  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: "cross-origin"
      }
    })
  );

  // CORS origin(s) from env, comma-separated. Keep both localhost and 127.0.0.1
  // in development/CI because Playwright and browsers may hit either host.
  const configuredCorsOrigins = (
    configService.get<string>("CORS_ORIGIN") ?? "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const frontendUrl = configService.get<string>("FRONTEND_URL")?.trim();
  const corsOrigins = Array.from(new Set([...configuredCorsOrigins, ...(frontendUrl ? [frontendUrl] : [])]));

  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true
  });
  app.useStaticAssets(join(__dirname, "..", "uploads"), {
    prefix: "/uploads/"
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger — chỉ bật ngoài production hoặc khi SWAGGER_ENABLED=true
  const nodeEnv = configService.get<string>("NODE_ENV") ?? "development";
  const swaggerEnabled = configService.get<string>("SWAGGER_ENABLED") === "true" || nodeEnv !== "production";

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("AHSO CRM API")
      .setDescription("REST API cho hệ thống AHSO CRM (B2B industrial sales)")
      .setVersion("0.1.0")
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT", in: "header" },
        "bearer"
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: { persistAuthorization: true }
    });
  }

  const port = configService.get<number>("PORT") ?? 3001;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`🚀 AHSO CRM API ready on http://localhost:${port}/api`);
  if (swaggerEnabled) {
    // eslint-disable-next-line no-console
    console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();

function initializeSentry() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }

      if (event.extra) {
        for (const key of Object.keys(event.extra)) {
          if (/password|token|secret|authorization|cookie/i.test(key)) {
            event.extra[key] = "[REDACTED]";
          }
        }
      }

      return event;
    }
  });
}
