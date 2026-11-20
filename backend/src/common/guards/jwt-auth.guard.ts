import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { REQUIRE_SCOPE_KEY } from "../../api-tokens/api-token.constants";
import { MachineAuthRegistry, assertMachineScope, extractMachineToken } from "../../api-tokens/machine-auth";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

interface MachineRequest {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  user?: unknown;
}

/**
 * Human requests: unchanged passport-jwt flow.
 * Machine requests (`Authorization: Bearer ahso_sa_...`): authenticated via API token and then
 * DEFAULT-DENIED unless the handler/controller carries @RequireScope(...) with scopes the token holds.
 * A machine token never falls through to JWT validation and a JWT never gets machine privileges.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<MachineRequest>();
    const machineToken = extractMachineToken(request.headers?.authorization);

    if (machineToken) {
      return this.authenticateMachine(context, request, machineToken);
    }

    return super.canActivate(context);
  }

  private async authenticateMachine(context: ExecutionContext, request: MachineRequest, rawToken: string) {
    const authenticator = MachineAuthRegistry.get();
    if (!authenticator) {
      throw new UnauthorizedException("Token API không hợp lệ, đã hết hạn hoặc đã bị thu hồi");
    }

    const principal = await authenticator.authenticate(rawToken, request.ip ?? null);
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRE_SCOPE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    assertMachineScope(principal, required);

    request.user = principal;
    return true;
  }
}
