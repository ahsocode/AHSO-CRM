# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Backend (`cd backend`)

```bash
npm run start:dev        # Hot-reload dev server (port 3001)
npm run build            # Compile TypeScript + copy assets (dist/)
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit (no emit, just type errors)
npm test                 # Jest unit tests (--runInBand, sequential)
npm run test:cov         # Jest with coverage report → coverage/
npm run test:watch       # Jest in watch mode
# Run a single test file:
npx jest --runInBand src/auth/auth.service.spec.ts

npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:migrate   # Create + apply a new dev migration
npm run prisma:deploy    # Apply pending migrations (production)
npm run prisma:seed      # Run migrations then seed test accounts
```

### Frontend (`cd frontend`)

```bash
npm run dev              # Next.js dev server (port 3000)
npm run build            # Next.js production build
npm run lint             # next lint (ESLint)
npm run typecheck        # tsc --noEmit using tsconfig.typecheck.json
npm run test:unit        # Vitest run (no watch)
```

### Root (Playwright E2E)

```bash
npm run test:e2e         # Playwright smoke tests (requires stack running)
```

### Docker (local stack)

```bash
docker compose up -d --build            # Start postgres, redis, backend, frontend
docker compose exec -T backend npm run prisma:seed
curl http://localhost:3001/api/health   # Verify backend is up
```

Seeded test accounts: `admin@ahso.vn`, `manager@ahso.vn`, `staff@ahso.vn` — all password `AHSO123!`.

---

## Architecture

### Monorepo layout

```
AHSO-CRM/
├── backend/    NestJS 10 + Prisma 5 + PostgreSQL 16 + Redis 7
├── frontend/   Next.js 14 App Router
├── e2e/        Playwright tests
└── scripts/    Deploy and utility scripts
```

### Backend

**Module structure** — Each feature is a self-contained NestJS module in `src/<feature>/`:
```
<feature>.module.ts      Wires together controller, service, imports
<feature>.controller.ts  HTTP routes, uses guards/decorators
<feature>.service.ts     Business logic, calls PrismaService
dto/                     Zod schemas + inferred TypeScript types
```

**Request lifecycle:**
1. `ThrottlerGuard` (global, 100 req/min default)
2. `JwtAuthGuard` (`passport-jwt`, extracts `Authorization: Bearer <token>`) — bypassed with `@Public()`
3. `PermissionsGuard` — checks `@RequirePermissions("resource.action")` or `@RequireAnyPermissions(...)` against the JWT payload. ADMIN role always passes. Caches DB-resolved permissions for 60 s per user.
4. `ZodValidationPipe` — per-endpoint, instantiated as `new ZodValidationPipe(mySchema)`
5. Handler executes
6. `TransformInterceptor` wraps every response: `{ data: T, meta: null }` (paginated: `{ data: items[], meta: {...} }`)
7. `HttpExceptionFilter` converts all errors to `{ statusCode, message, errors[] }`

**Auth flow:**
- `POST /api/auth/login` → issues `accessToken` (JWT, 15 m) + sets `ahso_refresh_token` HttpOnly cookie (7 d)
- `POST /api/auth/refresh` → rotates both tokens (old refresh token is invalidated)
- `POST /api/auth/logout` → clears refresh token from DB and clears cookie
- Access token is validated per-request by `JwtStrategy` (`passport-jwt`, Bearer header)
- Password reset token is signed with `${JWT_RESET_SECRET}:${user.passwordHash}` (one-time, invalidated on password change)

**Key shared utilities:**
- `PrismaService` — global singleton, injected everywhere
- `DomainEventsService.emit(eventName, payload)` — fan-out: webhooks + Socket.IO + in-app notifications + push
- `AuditService` — records login events
- `src/common/config/env.validation.ts` — Zod schema; app fails fast at startup if env is invalid
- `src/common/config/cors.config.ts` — CORS origins from `CORS_ORIGIN` + `FRONTEND_URL` env vars

**WebSocket** — Socket.IO at `/events` namespace. On connect, verifies Bearer token from handshake, joins rooms `user:{id}` and `admin` (for ADMIN role). `DomainEventsService` publishes to these rooms.

**Documents / PDF** — Handlebars templates compiled at `onModuleInit`, rendered to HTML, then to PDF via Puppeteer (`chromium`). Template registry at `src/documents/template-registry.ts`.

**Decorators quick reference:**
```typescript
@Public()                                 // Skip JWT auth entirely
@CurrentUser() user: JwtUser             // Inject user from JWT payload
@RequirePermissions("customers.view")    // ALL of these permissions required
@RequireAnyPermissions("quotes.create", "quotes.edit")  // ANY one is enough
```

**Role system:** Three system roles: `ADMIN` (full access), `MANAGER`, `STAFF`. Permissions are `"resource.action"` strings (e.g. `"customers.edit"`). ADMIN bypasses permission checks. `isAdmin(user)` helper in `auth.types.ts`.

**Validation pattern:** Every DTO file exports both a Zod schema and an inferred type. Use `new ZodValidationPipe(schema)` in the controller `@Body()` decorator:
```typescript
@Body(new ZodValidationPipe(createCustomerSchema)) dto: CreateCustomerDto
```

### Frontend

**Routing** — Next.js 14 App Router:
- `app/(auth)/` — public pages (login, forgot-password, reset-password)
- `app/(dashboard)/` — authenticated pages (all CRM features)
- `app/api/` — Next.js route handlers (used for server-side session proxy calls)

**Auth state** — Zustand store in `hooks/use-auth.ts` (`useAuthStore`):
- Access token → `sessionStorage` (cleared on browser close, lives for the browser session)
- User profile → `localStorage` (survives browser close, rehydrated on next visit)
- Refresh token → HttpOnly cookie (managed by browser, sent with `withCredentials: true`)
- On next visit after browser close: `useAuthStore.hydrate()` restores user from localStorage, then the first 401 triggers `apiClient` to auto-refresh via the cookie

**API client** — `lib/api-client.ts` (`apiClient`):
- Axios instance with `withCredentials: true` and base URL from `NEXT_PUBLIC_API_URL`
- Request interceptor: attaches `Authorization: Bearer <token>` from `sessionStorage`
- Response interceptor: on 401, calls `/auth/refresh` once (deduplicates concurrent calls via `refreshRequest` promise), retries original request. On refresh failure, redirects to `/login`.

**Data fetching** — TanStack Query hooks in `hooks/use-*.ts`. Each hook wraps `apiClient` calls and manages loading/error state. Query keys follow `["resource", filters]` convention.

**Forms** — React Hook Form + Zod via `@hookform/resolvers/zod`. Schema defined alongside the form component.

**Permissions on frontend** — `useAuth().hasPermission("resource.action")` reads from the Zustand store's user object. Permission strings match backend exactly.

### Database (Prisma)

Schema at `backend/prisma/schema.prisma`. All IDs are CUID strings. Soft delete via `deletedAt DateTime?` where implemented. Key models: `User`, `UserRole`, `Permission`, `Customer`, `Project`, `Quote`, `Contract`, `Activity`, `Document`, `Notification`.

After modifying the schema, always run `npm run prisma:generate` before building or running tests.

### Environment variables

Backend validates all vars at startup via `src/common/config/env.validation.ts`. Required: `DATABASE_URL`, `JWT_SECRET` (≥16 chars), `REDIS_URL`. Optional groups must be configured all-or-nothing: `SMTP_*`, `TWILIO_*`, `VAPID_*`.

Notable flags:
- `SWAGGER_ENABLED=true` — enables Swagger UI at `/api/docs` (off by default)
- `DEBUG_RESET=true` + `NODE_ENV=development` — password reset response includes the token (for local dev only)
- `LOG_LEVEL` — defaults to `debug` in dev, use `info` in production

Frontend only needs `NEXT_PUBLIC_API_URL` (backend URL) and optionally `NEXT_PUBLIC_APP_NAME`.

### Testing conventions

**Backend (Jest):**
- Test files: `*.spec.ts` colocated with source
- Run sequentially (`--runInBand`) to avoid port/DB conflicts
- Mocks: create plain mock objects manually, mock external libs with `jest.mock("bcrypt", ...)`. Do not mock `PrismaService` — instead mock its method calls on a plain object.
- `configValues` pattern: expose a `Record<string, string>` and pass it to a `get` mock so individual tests can override env vars.

**Frontend (Vitest):**
- Test files: `*.test.ts` / `*.test.tsx`
- Run with `npm run test:unit`

**E2E (Playwright):**
- Specs in `e2e/`
- Requires full Docker stack running with seeded DB
- Auth state reused via `e2e/.auth/` (generated by `global.setup.ts`)
