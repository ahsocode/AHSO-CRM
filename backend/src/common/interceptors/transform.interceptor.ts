import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        if (value && typeof value === "object" && "data" in (value as Record<string, unknown>) && "meta" in (value as Record<string, unknown>)) {
          return value;
        }

        if (value && typeof value === "object" && "items" in (value as Record<string, unknown>) && "meta" in (value as Record<string, unknown>)) {
          const { items, meta } = value as { items: unknown; meta: unknown };
          return {
            data: items,
            meta
          };
        }

        return {
          data: value,
          meta: null
        };
      })
    );
  }
}

