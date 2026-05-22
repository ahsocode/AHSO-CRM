import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { UploadModule } from "../upload/upload.module";
import { WebsocketModule } from "../websocket/websocket.module";
import { ImapService } from "./imap.service";
import { AdminEmailAccountsController, MailboxController } from "./mailbox.controller";
import { MailboxService } from "./mailbox.service";
import { MailboxSyncQueue } from "./mailbox-sync.queue";
import { MailboxSyncService } from "./mailbox-sync.service";

@Module({
  imports: [ConfigModule, UploadModule, WebsocketModule],
  controllers: [MailboxController, AdminEmailAccountsController],
  providers: [MailboxService, ImapService, MailboxSyncService, MailboxSyncQueue],
  exports: [MailboxService, ImapService, MailboxSyncService, MailboxSyncQueue]
})
export class MailboxModule {}
