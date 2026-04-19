import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, from } from "rxjs";
import { mergeMap, tap } from "rxjs/operators";
import { JwtUser } from "../auth/auth.types";
import { AuditService } from "./audit.service";

const TRACKED_METHODS = new Set(["POST", "PATCH", "DELETE"]);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      path?: string;
      params?: Record<string, string | undefined>;
      body?: unknown;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      user?: JwtUser;
    }>();
    const method = request.method?.toUpperCase() ?? "GET";

    if (!TRACKED_METHODS.has(method)) {
      return next.handle();
    }

    const resource = this.resolveResource(request.originalUrl ?? request.path ?? "");
    const resourceId = this.resolveResourceId(request.params);
    const userId = request.user?.sub;

    if (!resource || !userId) {
      return next.handle();
    }

    return from(this.auditService.captureResourceSnapshot(resource, resourceId)).pipe(
      mergeMap((before) =>
        next.handle().pipe(
          tap((responseValue) => {
            const after = this.extractResponseData(responseValue);
            const action = this.resolveAction(method, request.originalUrl ?? request.path ?? "");

            void this.auditService.record({
              userId,
              action,
              resource,
              resourceId,
              changes: {
                before,
                after: this.auditService.sanitize(after),
                input: this.auditService.sanitize(request.body)
              },
              ip: request.ip ?? null,
              userAgent: this.resolveUserAgent(request.headers?.["user-agent"])
            });
          })
        )
      )
    );
  }

  private resolveResource(pathname: string) {
    const cleanPath = pathname.split("?")[0] ?? pathname;
    const segments = cleanPath.split("/").filter(Boolean);

    if (segments[0] === "api") {
      return segments[1] ?? null;
    }

    return segments[0] ?? null;
  }

  private resolveResourceId(params?: Record<string, string | undefined>) {
    if (!params) {
      return null;
    }

    return (
      params.id ??
      params.customerId ??
      params.projectId ??
      params.contractId ??
      params.quoteId ??
      params.webhookId ??
      null
    );
  }

  private resolveAction(method: string, pathname: string) {
    const cleanPath = pathname.split("?")[0] ?? pathname;

    if (cleanPath.endsWith("/send")) {
      return "send";
    }

    if (cleanPath.endsWith("/status")) {
      return "status-change";
    }

    if (cleanPath.endsWith("/duplicate")) {
      return "duplicate";
    }

    switch (method) {
      case "POST":
        return "create";
      case "PATCH":
        return "update";
      case "DELETE":
        return "delete";
      default:
        return method.toLowerCase();
    }
  }

  private extractResponseData(value: unknown) {
    if (!value || typeof value !== "object") {
      return value;
    }

    const responseValue = value as Record<string, unknown>;

    if ("data" in responseValue) {
      return responseValue.data;
    }

    if ("items" in responseValue) {
      return responseValue.items;
    }

    return value;
  }

  private resolveUserAgent(header?: string | string[]) {
    if (!header) {
      return null;
    }

    return Array.isArray(header) ? header[0] ?? null : header;
  }
}

