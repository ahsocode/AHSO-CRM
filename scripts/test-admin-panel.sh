#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
API_URL="${API_URL:-http://localhost:3001/api}"
APP_ORIGIN="${APP_ORIGIN:-http://localhost:3001}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[admin-test] Thiếu lệnh bắt buộc: $1" >&2
    exit 1
  }
}

info() {
  echo
  echo "[admin-test] $1"
}

fail() {
  echo
  echo "[admin-test] LỖI: $1" >&2
  exit 1
}

assert_status() {
  local expected="$1"
  local actual="$2"
  local context="$3"

  if [[ "$expected" != "$actual" ]]; then
    fail "$context (mong đợi HTTP $expected, nhận $actual)"
  fi
}

for cmd in curl jq docker mktemp base64; do
  require_cmd "$cmd"
done

BACKEND_CONTAINER_ID="$(docker compose -f "$COMPOSE_FILE" ps -q backend)"
[[ -n "$BACKEND_CONTAINER_ID" ]] || fail "Không tìm thấy container backend đang chạy"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

info "Reset dữ liệu dev bằng prisma seed"
docker exec "$BACKEND_CONTAINER_ID" npm run prisma:seed >/tmp/ahso-admin-seed.log
tail -n 5 /tmp/ahso-admin-seed.log

info "Đăng nhập ADMIN"
ADMIN_LOGIN="$(curl -sS -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ahso.vn","password":"AHSO123!"}')"
ADMIN_TOKEN="$(echo "$ADMIN_LOGIN" | jq -er '.data.accessToken')"

info "1. GET /api/settings"
SETTINGS_JSON="$(curl -sS "$API_URL/settings" -H "Authorization: Bearer $ADMIN_TOKEN")"
echo "$SETTINGS_JSON" | jq -e '.data.company and .data.policies' >/dev/null || fail "GET /api/settings không trả đủ company + policies"

info "2. PATCH /api/settings/company"
COMPANY_UPDATE_RAW="$(curl -sS -w '\n%{http_code}' -X PATCH "$API_URL/settings/company" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"AHSO Test","taxId":"0399"}')"
COMPANY_UPDATE_BODY="${COMPANY_UPDATE_RAW%$'\n'*}"
COMPANY_UPDATE_CODE="${COMPANY_UPDATE_RAW##*$'\n'}"
assert_status "200" "$COMPANY_UPDATE_CODE" "PATCH /api/settings/company thất bại"
echo "$COMPANY_UPDATE_BODY" | jq -e '.data.name == "AHSO Test" and .data.taxId == "0399"' >/dev/null || fail "PATCH /api/settings/company không phản ánh dữ liệu mới"

info "3. GET /api/settings/company"
COMPANY_JSON="$(curl -sS "$API_URL/settings/company")"
echo "$COMPANY_JSON" | jq -e '.data.name == "AHSO Test" and .data.taxId == "0399"' >/dev/null || fail "GET /api/settings/company không phản ánh dữ liệu vừa cập nhật"

info "4. POST /api/upload/logo"
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y7vRlQAAAAASUVORK5CYII=' | base64 -d > "$TMP_DIR/logo.png"
UPLOAD_RAW="$(curl -sS -w '\n%{http_code}' -X POST "$API_URL/upload/logo" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@$TMP_DIR/logo.png;type=image/png")"
UPLOAD_BODY="${UPLOAD_RAW%$'\n'*}"
UPLOAD_CODE="${UPLOAD_RAW##*$'\n'}"
assert_status "201" "$UPLOAD_CODE" "POST /api/upload/logo thất bại"
LOGO_URL="$(echo "$UPLOAD_BODY" | jq -er '.data.url')"
[[ "$LOGO_URL" == /uploads/logos/* ]] || fail "URL logo không đúng định dạng /uploads/logos/*"

info "5. GET /api/settings/logo"
LOGO_JSON="$(curl -sS "$API_URL/settings/logo")"
CURRENT_LOGO_URL="$(echo "$LOGO_JSON" | jq -er '.data')"
[[ "$CURRENT_LOGO_URL" == "$LOGO_URL" ]] || fail "GET /api/settings/logo không trả URL logo mới nhất"

info "6. GET /uploads/logos/*"
LOGO_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "$APP_ORIGIN$LOGO_URL")"
assert_status "200" "$LOGO_STATUS" "File logo không được serve qua /uploads"

info "7. GET /api/roles"
ROLES_JSON="$(curl -sS "$API_URL/roles" -H "Authorization: Bearer $ADMIN_TOKEN")"
echo "$ROLES_JSON" | jq -e '.data | map(.name) | index("ADMIN") and index("MANAGER") and index("STAFF")' >/dev/null || fail "GET /api/roles không trả đủ 3 system role"
SYSTEM_ADMIN_ID="$(echo "$ROLES_JSON" | jq -er '.data[] | select(.name == "ADMIN") | .id')"

info "8. POST /api/roles"
PERMISSIONS_JSON="$(curl -sS "$API_URL/permissions" -H "Authorization: Bearer $ADMIN_TOKEN")"
PERMISSION_ID_ONE="$(echo "$PERMISSIONS_JSON" | jq -er '.data[0].permissions[0].id')"
PERMISSION_ID_TWO="$(echo "$PERMISSIONS_JSON" | jq -er '.data[0].permissions[1].id')"
VIEWER_NAME="VIEWER_$(date +%s)"
CREATE_ROLE_PAYLOAD="$(jq -nc \
  --arg name "$VIEWER_NAME" \
  --arg description "Chỉ xem" \
  --arg permissionIdOne "$PERMISSION_ID_ONE" \
  --arg permissionIdTwo "$PERMISSION_ID_TWO" \
  '{name: $name, description: $description, permissionIds: [$permissionIdOne, $permissionIdTwo]}')"
CREATE_ROLE_RAW="$(curl -sS -w '\n%{http_code}' -X POST "$API_URL/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CREATE_ROLE_PAYLOAD")"
CREATE_ROLE_BODY="${CREATE_ROLE_RAW%$'\n'*}"
CREATE_ROLE_CODE="${CREATE_ROLE_RAW##*$'\n'}"
assert_status "201" "$CREATE_ROLE_CODE" "POST /api/roles thất bại"
VIEWER_ID="$(echo "$CREATE_ROLE_BODY" | jq -er '.data.id')"

info "9. PATCH system role phải bị chặn"
PATCH_SYSTEM_RAW="$(curl -sS -w '\n%{http_code}' -X PATCH "$API_URL/roles/$SYSTEM_ADMIN_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"ADMIN_EDIT","description":"Không hợp lệ"}')"
PATCH_SYSTEM_BODY="${PATCH_SYSTEM_RAW%$'\n'*}"
PATCH_SYSTEM_CODE="${PATCH_SYSTEM_RAW##*$'\n'}"
if [[ "$PATCH_SYSTEM_CODE" != "400" && "$PATCH_SYSTEM_CODE" != "403" ]]; then
  fail "PATCH system role phải trả 400 hoặc 403, nhận $PATCH_SYSTEM_CODE"
fi
echo "$PATCH_SYSTEM_BODY" | jq -e '.message | tostring | test("Không thể sửa role hệ thống")' >/dev/null || fail "PATCH system role không trả message mong đợi"

info "10. DELETE /api/roles/<viewer>"
DELETE_ROLE_RAW="$(curl -sS -w '\n%{http_code}' -X DELETE "$API_URL/roles/$VIEWER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")"
DELETE_ROLE_CODE="${DELETE_ROLE_RAW##*$'\n'}"
assert_status "200" "$DELETE_ROLE_CODE" "DELETE /api/roles/<viewer> thất bại"

info "11. STAFF bị chặn PATCH settings"
STAFF_LOGIN="$(curl -sS -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@ahso.vn","password":"AHSO123!"}')"
STAFF_TOKEN="$(echo "$STAFF_LOGIN" | jq -er '.data.accessToken')"
STAFF_PATCH_RAW="$(curl -sS -w '\n%{http_code}' -X PATCH "$API_URL/settings/company" \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hack"}')"
STAFF_PATCH_CODE="${STAFF_PATCH_RAW##*$'\n'}"
assert_status "403" "$STAFF_PATCH_CODE" "STAFF không bị chặn khi PATCH /api/settings/company"

info "Tất cả API smoke tests cho admin panel đã PASS"
