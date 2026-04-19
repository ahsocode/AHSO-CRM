import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { join } from "path";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Global API prefix — all routes served under /api/*
  app.setGlobalPrefix("api");

  // Security headers
  app.use(helmet());

  // CORS origin(s) from env, comma-separated
  const corsOrigins = (configService.get<string>("CORS_ORIGIN") ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

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
