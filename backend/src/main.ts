import * as Sentry from "@sentry/node";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import helmet from "helmet";
import { WinstonModule } from "nest-winston";
import { join } from "path";
import { AppModule } from "./app.module";
import { buildCorsOptions } from "./common/config/cors.config";
import { isSwaggerEnabled } from "./common/config/swagger.config";
import { createWinstonLoggerOptions } from "./common/logger/winston.config";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

async function bootstrap() {
  initializeSentry();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(createWinstonLoggerOptions())
  });
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);

  // Global API prefix — all routes served under /api/*
  app.setGlobalPrefix("api");

  const isProduction = configService.get("NODE_ENV") === "production";
  const frontendUrl = configService.get<string>("FRONTEND_URL") ?? "http://localhost:3000";

  // Security headers.
  // crossOriginResourcePolicy is "cross-origin" so the Next.js frontend (different origin)
  // can embed uploaded logos/files. CSP is minimal on the API server itself — the real CSP
  // should be set on the Next.js frontend. HSTS is only enabled in production (behind TLS).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", frontendUrl],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"]
        }
      },
      // HSTS: only in production — dev and CI run over plain HTTP
      hsts: isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    })
  );

  // Keep HTTP and Socket.IO CORS in sync. Defaults include localhost and
  // 127.0.0.1 because Playwright and browsers may hit either host in dev/CI.
  app.enableCors(buildCorsOptions(configService));
  app.use(
    ["/uploads/documents", "/uploads/business-documents", "/uploads/surveys", "/uploads/email-attachments"],
    (_request: Request, response: Response) => {
      response.status(404).send("Không tìm thấy tài liệu.");
    }
  );
  app.useStaticAssets(join(__dirname, "..", "uploads"), {
    prefix: "/uploads/"
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger — chỉ bật khi SWAGGER_ENABLED=true
  const swaggerEnabled = isSwaggerEnabled(configService);

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

  const logger = new Logger("Bootstrap");
  logger.log(`AHSO CRM API ready on port ${port}`);
  if (swaggerEnabled) {
    logger.log(`Swagger docs available at /api/docs`);
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
