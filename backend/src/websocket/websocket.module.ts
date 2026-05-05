import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { WebsocketGateway } from "./websocket.gateway";

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  providers: [WebsocketGateway],
  exports: [WebsocketGateway]
})
export class WebsocketModule {}
