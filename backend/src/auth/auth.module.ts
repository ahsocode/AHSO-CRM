import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { MailboxModule } from "../mailbox/mailbox.module";
import { WebsocketModule } from "../websocket/websocket.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    AuditModule,
    EmailModule,
    MailboxModule,
    WebsocketModule,
    PassportModule.register({
      defaultStrategy: "jwt"
    }),
    JwtModule.register({})
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService]
})
export class AuthModule {}
