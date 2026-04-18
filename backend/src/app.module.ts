import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { CommonModule } from "./common/common.module";
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: "default",
          ttl: Number(config.get("THROTTLE_TTL") ?? 60) * 1000,
          limit: Number(config.get("THROTTLE_LIMIT") ?? 120)
        },
        {
          name: "auth",
          ttl: Number(config.get("AUTH_THROTTLE_TTL") ?? 60) * 1000,
          limit: Number(config.get("AUTH_THROTTLE_LIMIT") ?? 10)
        }
      ]
    }),
    CommonModule,
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
    UploadModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
