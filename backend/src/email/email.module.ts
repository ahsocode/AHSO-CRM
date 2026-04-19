import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MailerModule } from "@nestjs-modules/mailer";
import { SettingsModule } from "../settings/settings.module";
import { EmailSchedulerService } from "./email.scheduler";
import { EmailService } from "./email.service";

@Module({
  imports: [
    ConfigModule,
    SettingsModule,
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>("SMTP_HOST");
        const port = Number(configService.get<string>("SMTP_PORT") ?? 587);

        return {
          transport: host
            ? {
                host,
                port,
                secure: port === 465,
                auth:
                  configService.get<string>("SMTP_USER") && configService.get<string>("SMTP_PASS")
                    ? {
                        user: configService.get<string>("SMTP_USER"),
                        pass: configService.get<string>("SMTP_PASS")
                      }
                    : undefined
              }
            : {
                jsonTransport: true
              }
        };
      }
    })
  ],
  providers: [EmailService, EmailSchedulerService],
  exports: [EmailService]
})
export class EmailModule {}
