import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Server, Socket } from "socket.io";
import { DomainEventEnvelope } from "../domain-events/domain-events.types";
import { JwtUser, getRoleName } from "../auth/auth.types";

interface SocketWithUser extends Socket {
  data: Socket["data"] & {
    user?: JwtUser;
  };
}

function resolveAllowedOrigins() {
  const configuredOrigins = process.env.CORS_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000";
  const frontendUrl = process.env.FRONTEND_URL ?? "";

  return Array.from(new Set([...configuredOrigins.split(","), frontendUrl].map((value) => value.trim()).filter(Boolean)));
}

@WebSocketGateway({
  cors: {
    origin: resolveAllowedOrigins(),
    credentials: true
  },
  namespace: "/events"
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async handleConnection(client: SocketWithUser) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        throw new UnauthorizedException("Thiếu access token");
      }

      const user = await this.jwtService.verifyAsync<JwtUser>(token, {
        secret: this.configService.get<string>("JWT_SECRET")
      });

      client.data.user = user;
      client.join(`user:${user.sub}`);

      if (getRoleName(user) === "ADMIN") {
        client.join("admin");
      }
    } catch (error) {
      this.logger.warn(`Từ chối kết nối websocket: ${error instanceof Error ? error.message : "unauthorized"}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: SocketWithUser) {
    const userId = client.data.user?.sub;

    if (userId) {
      this.logger.debug(`WebSocket disconnected: ${userId}`);
    }
  }

  publish<TPayload = Record<string, unknown>>(envelope: DomainEventEnvelope<TPayload>) {
    this.server.emit("domain-event", envelope);
  }

  publishToUser<TPayload = Record<string, unknown>>(userId: string, envelope: DomainEventEnvelope<TPayload>) {
    this.server.to(`user:${userId}`).emit("domain-event", envelope);
  }

  publishToAdmin<TPayload = Record<string, unknown>>(envelope: DomainEventEnvelope<TPayload>) {
    this.server.to("admin").emit("domain-event", envelope);
  }

  @SubscribeMessage("ping")
  ping(@ConnectedSocket() client: SocketWithUser, @MessageBody() payload?: unknown) {
    return {
      ok: true,
      userId: client.data.user?.sub ?? null,
      payload
    };
  }

  private extractToken(client: SocketWithUser) {
    const authToken = typeof client.handshake.auth?.token === "string" ? client.handshake.auth.token : null;
    const headerValue = client.handshake.headers.authorization;

    if (authToken) {
      return authToken.replace(/^Bearer\s+/i, "");
    }

    if (typeof headerValue === "string") {
      return headerValue.replace(/^Bearer\s+/i, "");
    }

    return null;
  }
}
