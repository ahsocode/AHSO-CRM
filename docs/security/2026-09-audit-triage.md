# npm audit triage — 2026-09-03

Phase 3 of the Phase D cleanup plan. `npm audit fix` **without `--force`** was
applied to all three packages (only transitive, in-range fixes — no direct
dependency version changed). This doc records what was fixed and why every
remaining advisory is deferred.

## Result

| Package | Before | After `audit fix` | After targeted bumps | Notes |
|---|--:|--:|--:|---|
| `mcp-server` | 9 | **0** | **0** | fully clean |
| `backend` | 56 | 30 | **27** (0 critical) | nodemailer + bcrypt bumped (below) |
| `frontend` | 56 | 42 | **12** (1 critical, devDep) | tiptap cluster bumped (below) |

Gate after every step: backend `tsc` + `lint` + 211 tests + `build` green; frontend
`tsc` + `lint` + 29 tests + `build` green; mcp `tsc` green.

## Targeted major bumps applied 2026-09-03 (after the plan)

| Bump | Commit | Cleared |
|---|---|---|
| `nodemailer` 8 → 9, `@nestjs-modules/mailer` 2.3.4 → 2.3.7 | `54621c8` | high CRLF-injection in `List-*` headers |
| `bcrypt` 5 → 6 (+ `@types/bcrypt` 6) | `d2b4079` | **critical** `tar` arbitrary file write + `@mapbox/node-pre-gyp` (old node-pre-gyp) |
| `@tiptap/*` cluster 3.23 → 3.31 (10 direct deps, lockstep) | `e543452` | ~28 advisories incl. the `@tiptap/core` prototype-pollution |

All three are same-or-compatible API (Node 20 satisfies the new floors; bcrypt hash
format is cross-compatible; tiptap stayed on major 3). **Recommend a manual mailbox
editor smoke test before the next deploy** (tiptap marks / link / image / paste).

## Fixed transitively (no code/config impact)

**backend:** liquidjs (critical), axios, brace-expansion, browserslist,
engine.io, form-data, ip-address, linkify-it, nanoid, postcss, socket.io-parser,
svgo, undici, ws, and the `@opentelemetry/*` + `@sentry/node` chain, `qs`,
`uuid`, `file-type`, `@babel/core`, `postcss-selector-parser`.

**frontend:** axios, brace-expansion, browserslist, form-data, js-yaml, nanoid,
socket.io-parser, tmp, ws, engine.io-client, dompurify, postcss-selector-parser.

**mcp-server:** axios, fast-uri, form-data, hono, ip-address, `@hono/node-server`,
qs, body-parser, esbuild — all cleared.

## Residual — deferred, with reason

### backend (30)

| Advisory(s) | Sev | Runtime reachable? | Only fix | Decision |
|---|---|---|---|---|
| `nodemailer` — CRLF injection in `List-*` header comments | high | **yes** — mailbox sends mail | `nodemailer@9` (major, from `^8.0.5`) | **Own ticket, do first.** Small isolated bump; retest mailbox send + templates. Interim: we do not build `List-*` headers from user input. |
| `tar`, `@mapbox/node-pre-gyp` — arbitrary file write | critical/high | **no** — native-module install only, build time | `bcrypt@6` (major, from `^5.1.1`) | Own ticket. `bcrypt` itself is runtime (password hashing) so the bump needs a hashing round-trip test; the vulnerable `tar` path is not executed at runtime. |
| `multer` — DoS via incomplete cleanup | high | **yes** — file uploads | `@nestjs/platform-express@12` | Rolled into the NestJS 10→12 upgrade. Interim: uploads are permission-gated and size-limited. |
| `js-yaml`, `lodash` (`_.template` code injection) via `@nestjs/swagger` | high | **no** — Swagger is `SWAGGER_ENABLED=false` in prod | `@nestjs/swagger@12` | NestJS 12 upgrade. |
| `glob`, `picomatch`, `tmp`, `webpack` (build SSRF), `inquirer`, `external-editor`, `ajv`, `@angular-devkit/*`, `@nestjs/schematics` | low–moderate | **no** — `@nestjs/cli` is a **devDependency** | `@nestjs/cli@12` | Dev/build only, not shipped. NestJS 12 upgrade. |
| `@nestjs/core`, `@nestjs/common`, `@nestjs/config`, `@nestjs/websockets`, `@nestjs/platform-socket.io` | moderate | yes | NestJS 10→12 majors | **One coordinated NestJS 10→12 upgrade project.** The single largest residual. |
| `@anthropic-ai/sdk` — insecure default file permissions on written files | moderate | yes (AI features) | `@anthropic-ai/sdk@0.123` (major, from `^0.90.0`) | Own ticket. Check the SDK changelog for breaking API changes first; verify against the `claude-api` reference. |
| `qs`, `file-type`, `@angular-devkit/schematics*` (npm marks fix "in-range" but won't auto-apply) | moderate | mixed | blocked by `@nestjs/cli` peer ranges | Resolves with the NestJS 12 upgrade. |

### frontend (42)

| Advisory(s) | Sev | Runtime reachable? | Only fix | Decision |
|---|---|---|---|---|
| `next` — Image Optimization DoS (self-hosted) + `postcss` XSS in CSS stringify | high | **yes** | `next@16` (14.x is EOL for security backports) | **Already on the latest 14.2.x (`14.2.35`).** Defer to a Next 14→15→16 upgrade project. **Interim mitigation: rate-limit `/_next/image` at the reverse proxy** (and cap `images` sizes). |
| `vitest`, `vite`, `esbuild`, `@vitest/mocker`, `vite-node` — dev-server SSRF / path traversal | critical–moderate | **no** — `vitest` is a **devDependency**; dev server never runs in prod or CI-publish | `vitest@3` (major) | Defer to vitest 2→3 (also updates `@vitejs/*`). Zero shipped exposure. |
| `eslint-config-next`, `@next/eslint-plugin-next`, `glob` — command injection in lint glob | high | **no** — **devDependency**, lint only | `eslint-config-next@16` | Bumps with the Next upgrade. |
| ~25 × `@tiptap/*` — `mergeAttributes()` turns `__proto__` into executable DOM attributes | moderate | **yes** — rich-text editor (email compose, notes) | `@tiptap/core ≥ 3.30.4` (in our `^3.23.4` range, but the whole cluster + `starter-kit` must move in lockstep — `npm audit fix` and piecemeal `npm update` leave an invalid tree) | **Own ticket: bump every `@tiptap/*` dep to the latest 3.x together, reinstall, retest the editor** (paste handling, formatting marks, image/link nodes). Mitigating layer: `dompurify` sanitises rendered HTML. |
| `exceljs` → `uuid` bounds check (v3/v5/v6 with pre-allocated buffer) | moderate | marginal | npm suggests `exceljs@3.4.0` — a **downgrade** from our current `4.4.0` (latest); nonsensical | **Accept, no action.** exceljs 4.4.0 is current; it does not call `uuid` with a caller-supplied buffer. |

## Recommended follow-up tickets (priority order)

1. ~~`nodemailer` 8→9~~ — **done** (`54621c8`).
2. ~~`@tiptap/*` cluster → latest 3.x~~ — **done** (`e543452`); manual editor QA still pending.
3. ~~`bcrypt` 5→6~~ — **done** (`d2b4079`); last critical cleared.
4. **`@anthropic-ai/sdk` 0.90→latest** — check changelog against the `claude-api` skill; AI feature smoke test.
5. **NestJS 10→12** — large coordinated upgrade; clears ~18 backend advisories including `multer` (DoS, prod-reachable) and `@nestjs/swagger`'s `lodash`/`js-yaml`.
6. **Next 14→16 + vitest 2→3 + eslint-config-next** — front-end framework upgrade wave; until then, proxy rate-limit on `/_next/image`. `vitest` is the remaining frontend "critical" but it is a devDependency (dev-server SSRF, never shipped).
