import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { AiModule } from "./ai/ai.module";
import { AuditModule } from "./audit/audit.module";
import { CommonModule } from "./common/common.module";
import { EmailModule } from "./email/email.module";
import { SmsModule } from "./sms/sms.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { CustomersModule } from "./customers/customers.module";
import { ContactsModule } from "./contacts/contacts.module";
import { ProjectsModule } from "./projects/projects.module";
import { QuotesModule } from "./quotes/quotes.module";
import { ContractsModule } from "./contracts/contracts.module";
import { ActivitiesModule } from "./activities/activities.module";
import { CalendarModule } from "./calendar/calendar.module";
import { ReportsModule } from "./reports/reports.module";
import { UploadModule } from "./upload/upload.module";
import { SettingsModule } from "./settings/settings.module";
import { RolesModule } from "./roles/roles.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { WebsocketModule } from "./websocket/websocket.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PushModule } from "./push/push.module";
import { DomainEventsModule } from "./domain-events/domain-events.module";
import { CustomFieldsModule } from "./custom-fields/custom-fields.module";
import { SearchModule } from "./search/search.module";
import { DocumentsModule } from "./documents/documents.module";
import { SurveysModule } from "./surveys/surveys.module";
import { BusinessDocumentsModule } from "./business-documents/business-documents.module";
import { HealthModule } from "./health/health.module";
import { MailboxModule } from "./mailbox/mailbox.module";
import { validateEnv } from "./common/config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: "default",
          ttl: Number(config.get("THROTTLE_TTL") ?? 60) * 1000,
          limit: Number(config.get("THROTTLE_LIMIT") ?? 100)
        }
      ]
    }),
    CommonModule,
    AiModule,
    AuditModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    CustomersModule,
    ContactsModule,
    ProjectsModule,
    QuotesModule,
    ContractsModule,
    ActivitiesModule,
    CalendarModule,
    ReportsModule,
    UploadModule,
    SettingsModule,
    RolesModule,
    PermissionsModule,
    EmailModule,
    SmsModule,
    WebhooksModule,
    WebsocketModule,
    NotificationsModule,
    PushModule,
    DomainEventsModule,
    CustomFieldsModule,
    SearchModule,
    HealthModule,
    MailboxModule,
    DocumentsModule,
    SurveysModule,
    BusinessDocumentsModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
