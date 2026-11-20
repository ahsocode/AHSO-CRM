import { SetMetadata } from "@nestjs/common";
import { REQUIRE_SCOPE_KEY } from "./api-token.constants";

/**
 * Explicitly allows machine tokens that hold ALL listed scopes to call the handler/controller.
 * Without this decorator machine principals are denied by JwtAuthGuard (default deny).
 * Human users are unaffected; keep their @RequirePermissions/@Roles checks in place.
 */
export const RequireScope = (...scopes: string[]) => SetMetadata(REQUIRE_SCOPE_KEY, scopes);
