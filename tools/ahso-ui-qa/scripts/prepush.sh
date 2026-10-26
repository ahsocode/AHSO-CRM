#!/usr/bin/env bash
# AHSO CRM — pre-push QA, runs on the developer's Mac.
#
# Cheapest checks first, stop at the first failing stage:
#   1. static     tools/ahso-ui-qa/scripts/static_checks.py (seconds)
#   2. types+lint frontend & backend tsc, frontend next lint (~1 min)
#   3. unit       backend jest, frontend vitest (~1-2 min)
#   4. e2e        isolated docker stack `ahso-qa` on ports 3100/3101 + Playwright (~8-10 min)
#
# The e2e stack never touches the dev stack (3000/3001), its database, uploads or images.
#
# Usage:
#   npm run qa:prepush                 # everything
#   npm run qa:prepush -- --fast       # stages 1-3 only (no docker)
#   npm run qa:prepush -- --e2e-only   # stage 4 only
#   npm run qa:prepush -- --grep "Báo giá"   # only e2e tests whose title matches
#   npm run qa:prepush -- --keep       # leave the QA stack running (http://localhost:3100)
#   npm run qa:up / npm run qa:down    # start/stop the QA stack only (manual or Claude testing)
#   npm run qa:prepush -- --install-hook   # run this script automatically on `git push`
#   SKIP_QA=1 git push                 # bypass the hook once (emergency only)
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
HERE="tools/ahso-ui-qa/scripts"
PROJECT="ahso-qa"
COMPOSE=(docker compose -p "$PROJECT" -f docker-compose.yml -f "$HERE/compose.qa.yml")

FAST=0; E2E_ONLY=0; KEEP=0; GREP=""; UP_ONLY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fast) FAST=1 ;;
    --e2e-only) E2E_ONLY=1 ;;
    --keep) KEEP=1 ;;
    # Start the isolated QA stack and leave it running for manual/Claude testing (no tests)
    --up) UP_ONLY=1; E2E_ONLY=1; KEEP=1 ;;
    --down)
      docker compose -p "$PROJECT" -f docker-compose.yml -f "$HERE/compose.qa.yml" down -v --remove-orphans
      echo "[qa] QA stack stopped and its data removed."
      exit 0 ;;
    --grep) GREP="$2"; shift ;;
    --install-hook)
      cat > .git/hooks/pre-push <<'HOOK'
#!/usr/bin/env bash
# Installed by tools/ahso-ui-qa/scripts/prepush.sh --install-hook
[[ "${SKIP_QA:-0}" == "1" ]] && { echo "[qa] SKIP_QA=1 — skipping pre-push QA"; exit 0; }
exec bash tools/ahso-ui-qa/scripts/prepush.sh
HOOK
      chmod +x .git/hooks/pre-push
      echo "[qa] pre-push hook installed. Bypass once with: SKIP_QA=1 git push"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 2 ;;
  esac
  shift
done

stage() { printf '\n\033[1;34m[qa] %s\033[0m\n' "$*"; }
fail()  { printf '\n\033[1;31m[qa] FAILED: %s\033[0m\n' "$*"; exit 1; }
ok()    { printf '\033[1;32m[qa] ✔ %s\033[0m\n' "$*"; }

# macOS writes AppleDouble junk on exFAT drives; it breaks jest/vitest collection.
find . -name '._*' -not -path '*/node_modules/*' -not -path './.git/*' -delete 2>/dev/null || true

# Repo integrity: on the exFAT drive a git object was once written with raw,
# uncompressed bytes (tree of reports/builder), breaking 4 unpushed commits.
# Connectivity-only fsck reads every tree/commit headed for the push — fails fast.
if [[ $UP_ONLY -eq 0 ]]; then
stage "0/4 git integrity"
git fsck --connectivity-only --no-dangling >/dev/null 2>&1 \
  || { git fsck --connectivity-only --no-dangling 2>&1 | grep -v '^Checking' | head -5
       fail "git object corruption — ask Claude to repair before pushing (do NOT push)"; }
ok "git integrity"
fi

if [[ $E2E_ONLY -eq 0 ]]; then
  stage "1/4 static checks"
  git fetch -q origin main 2>/dev/null || true
  python3 "$HERE/static_checks.py" || fail "static checks (fix the ERROR lines above)"
  ok "static checks"

  stage "2/4 typecheck + lint"
  (cd frontend && npx tsc --noEmit) || fail "frontend typecheck"
  (cd frontend && npx next lint --quiet) || fail "frontend lint"
  (cd backend && npx tsc --noEmit) || fail "backend typecheck"
  ok "typecheck + lint"

  stage "3/4 unit tests"
  (cd backend && npx jest --runInBand --silent) || fail "backend unit tests"
  (cd frontend && npx vitest run) || fail "frontend unit tests"
  ok "unit tests"
fi

[[ $FAST -eq 1 ]] && { ok "fast mode — e2e skipped"; exit 0; }

stage "4/4 e2e on isolated stack '$PROJECT' (localhost:3100 / :3101)"
command -v docker >/dev/null || fail "docker not found — install/start Docker Desktop"
docker info >/dev/null 2>&1 || fail "Docker is not running — start Docker Desktop"

export POSTGRES_PORT=55432 REDIS_PORT=56379 BACKEND_PORT=3101 FRONTEND_PORT=3100
export POSTGRES_PASSWORD="qa_$(openssl rand -hex 8)"
export NEXT_PUBLIC_API_URL="http://localhost:3101"
export FRONTEND_URL="http://localhost:3100"
export CORS_ORIGIN="http://localhost:3100,http://127.0.0.1:3100"
export E2E_BASE_URL="http://localhost:3100"
export E2E_API_URL="http://localhost:3101/api"
export E2E_API_BASE_URL="http://localhost:3101/api"
export E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@ahso.vn}"
export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-AHSO123!}"

cleanup() {
  if [[ $KEEP -eq 1 ]]; then
    echo "[qa] --keep: stack left running at http://localhost:3100 — stop with: ${COMPOSE[*]} down -v"
  else
    "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Fresh database every run (seed must start from empty).
"${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
source "$HERE/docker-cache.sh"
prune_old_docker_build_cache || fail "Docker build cache prune"
"${COMPOSE[@]}" build backend frontend || fail "docker build"
"${COMPOSE[@]}" up -d postgres redis backend frontend || fail "docker compose up"

wait_for() {  # url label
  for _ in $(seq 1 60); do curl -sf "$1" >/dev/null && return 0; sleep 5; done
  "${COMPOSE[@]}" logs --tail=40 backend frontend || true
  fail "$2 did not become ready ($1)"
}
wait_for "http://127.0.0.1:3101/api/health" "backend"
"${COMPOSE[@]}" exec -T backend npm run prisma:seed || fail "database seed"
wait_for "http://127.0.0.1:3100/login" "frontend"

if [[ $UP_ONLY -eq 1 ]]; then
  printf '\n\033[1;32m[qa] QA stack is up: http://localhost:3100\033[0m\n'
  printf '[qa] Seed accounts (password AHSO123!): admin@ahso.vn · manager@ahso.vn · staff@ahso.vn\n'
  printf '[qa] Isolated data — safe to create/edit/delete. Stop with: npm run qa:down\n'
  exit 0
fi

# Root devDependencies (@playwright/test) are separate from frontend/ and backend/.
# Without them `npx playwright` downloads a throwaway copy that cannot load
# playwright.config.ts ("Cannot find module '@playwright/test'").
if [[ ! -d node_modules/@playwright/test ]]; then
  echo "[qa] installing root dev dependencies (@playwright/test)…"
  npm ci --no-audit --no-fund || fail "root npm ci"
fi
[[ -d "$HOME/Library/Caches/ms-playwright" ]] && ls "$HOME/Library/Caches/ms-playwright" | grep -q chromium \
  || npx --no-install playwright install chromium

# Playwright recursively clears its output directory. AppleDouble files on exFAT
# can appear during that removal and cause ENOTEMPTY before any test runs.
PW_OUTPUT="$(mktemp -d "${TMPDIR:-/tmp}/ahso-qa-results.XXXXXX")"
echo "[qa] Playwright results: $PW_OUTPUT"
PW_ARGS=(--reporter=line --output "$PW_OUTPUT")
[[ -n "$GREP" ]] && PW_ARGS+=(--grep "$GREP")
if ! npx --no-install playwright test "${PW_ARGS[@]}"; then
  printf '\n[qa] Playwright failed. Report: npx playwright show-report\n'
  printf '[qa] To get help cheaply, paste ONLY the failing test blocks above (title + Error + Locator lines) to Claude.\n'
  fail "e2e"
fi
ok "e2e"
printf '\n\033[1;32m[qa] ALL STAGES PASSED — safe to push.\033[0m\n'
