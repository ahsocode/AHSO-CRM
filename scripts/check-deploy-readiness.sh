#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_ENV="$ROOT_DIR/.env.production.local"
BACKEND_ENV="$ROOT_DIR/backend/.env.production.local"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.production.local"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"

fail() {
  echo "[deploy-check] LỖI: $1" >&2
  exit 1
}

info() {
  echo "[deploy-check] $1"
}

warn() {
  echo "[deploy-check] CẢNH BÁO: $1" >&2
}

require_file() {
  local path="$1"
  local example="$2"

  if [[ ! -f "$path" ]]; then
    fail "Thiếu $path. Hãy copy từ $example và điền giá trị thật."
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Thiếu lệnh bắt buộc: $1"
}

read_env_value() {
  local file="$1"
  local key="$2"
  local line

  line="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 || true)"
  printf '%s' "${line#*=}" | sed -E 's/^["'\'']?//; s/["'\'']?$//'
}

assert_not_placeholder() {
  local file="$1"
  local key="$2"
  local value

  value="$(read_env_value "$file" "$key")"
  [[ -n "$value" ]] || fail "$key trong $file đang trống"
  [[ "$value" != *"replace-with"* && "$value" != *"change-me"* && "$value" != *"example.com"* ]] || {
    fail "$key trong $file vẫn là placeholder"
  }
}

require_cmd docker
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin chưa khả dụng"

require_file "$ROOT_ENV" "$ROOT_DIR/.env.production.example"
require_file "$BACKEND_ENV" "$ROOT_DIR/backend/.env.production.example"
require_file "$FRONTEND_ENV" "$ROOT_DIR/frontend/.env.production.example"
require_file "$COMPOSE_FILE" "$COMPOSE_FILE"

info "Kiểm tra secret/env production không còn placeholder"
assert_not_placeholder "$ROOT_ENV" "POSTGRES_PASSWORD"
assert_not_placeholder "$BACKEND_ENV" "NODE_ENV"
assert_not_placeholder "$BACKEND_ENV" "JWT_SECRET"
assert_not_placeholder "$BACKEND_ENV" "JWT_RESET_SECRET"
assert_not_placeholder "$BACKEND_ENV" "FRONTEND_URL"
assert_not_placeholder "$BACKEND_ENV" "CORS_ORIGIN"
assert_not_placeholder "$BACKEND_ENV" "ENCRYPTION_KEY"
assert_not_placeholder "$FRONTEND_ENV" "NEXT_PUBLIC_API_URL"

[[ "$(read_env_value "$BACKEND_ENV" "NODE_ENV")" == "production" ]] || fail "NODE_ENV trong $BACKEND_ENV phải là production"
[[ "$(read_env_value "$BACKEND_ENV" "SWAGGER_ENABLED")" == "false" ]] || fail "SWAGGER_ENABLED trong $BACKEND_ENV phải là false cho production"

if [[ -z "$(read_env_value "$BACKEND_ENV" "SMTP_HOST")" ]]; then
  warn "SMTP chưa cấu hình; các flow gửi email sẽ không hoạt động đầy đủ."
fi

if [[ -z "$(read_env_value "$BACKEND_ENV" "VAPID_PUBLIC_KEY")" || -z "$(read_env_value "$BACKEND_ENV" "VAPID_PRIVATE_KEY")" ]]; then
  warn "VAPID chưa cấu hình; push notification sẽ bị tắt hoặc không khả dụng."
fi

info "Validate docker compose production config"
docker compose --env-file "$ROOT_ENV" -f "$COMPOSE_FILE" config >/dev/null

info "Production deploy readiness PASS"
