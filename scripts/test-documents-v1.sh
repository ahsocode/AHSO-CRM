#!/usr/bin/env bash

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001/api}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@ahso.vn}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-AHSO123!}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[documents-v1] Thiếu lệnh bắt buộc: $1" >&2
    exit 1
  }
}

info() {
  echo
  echo "[documents-v1] $1"
}

fail() {
  echo
  echo "[documents-v1] LỖI: $1" >&2
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

for cmd in curl jq mktemp head; do
  require_cmd "$cmd"
done

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

info "Đăng nhập ADMIN"
LOGIN_JSON="$(curl -sS -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
TOKEN="$(echo "$LOGIN_JSON" | jq -er '.data.accessToken')"

info "Kiểm tra template registry production/beta"
REGISTRY_JSON="$(curl -sS "$API_URL/documents/template-registry" -H "Authorization: Bearer $TOKEN")"
echo "$REGISTRY_JSON" | jq -e '
  (.data[] | select(.type == "QUOTATION") | .runtimeStatus == "production" and .endUserEnabled == true and .editorEnabled == true)
  and
  (.data[] | select(.type == "CONTRACT") | .runtimeStatus == "production" and .endUserEnabled == true and .editorEnabled == true)
  and
  ([.data[] | select((.type != "QUOTATION") and (.type != "CONTRACT") and (.endUserEnabled == true))] | length == 0)
' >/dev/null || fail "Registry chưa khóa đúng QUOTATION/CONTRACT production và các template beta"

QUOTE_ID="$(curl -sS "$API_URL/quotes?limit=1" -H "Authorization: Bearer $TOKEN" | jq -er '.data[0].id')"
CONTRACT_ID="$(curl -sS "$API_URL/contracts?limit=1" -H "Authorization: Bearer $TOKEN" | jq -er '.data[0].id')"

info "Preview báo giá qua auth route backend"
QUOTE_PREVIEW_RAW="$(curl -sS -w '\n%{http_code}' "$API_URL/documents/QUOTATION/$QUOTE_ID/preview?lang=vi" \
  -H "Authorization: Bearer $TOKEN")"
QUOTE_PREVIEW_BODY="${QUOTE_PREVIEW_RAW%$'\n'*}"
QUOTE_PREVIEW_CODE="${QUOTE_PREVIEW_RAW##*$'\n'}"
assert_status "200" "$QUOTE_PREVIEW_CODE" "Preview QUOTATION thất bại"
printf '%s' "$QUOTE_PREVIEW_BODY" > "$TMP_DIR/quote-preview.html"
grep -Eiq '<!doctype html|schema-document|document' "$TMP_DIR/quote-preview.html" || fail "Preview QUOTATION không trả HTML hợp lệ"

info "Render và download báo giá theo documentId"
QUOTE_RENDER_RAW="$(curl -sS -w '\n%{http_code}' -X POST "$API_URL/documents/QUOTATION/$QUOTE_ID/render" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"vi"}')"
QUOTE_RENDER_BODY="${QUOTE_RENDER_RAW%$'\n'*}"
QUOTE_RENDER_CODE="${QUOTE_RENDER_RAW##*$'\n'}"
assert_status "201" "$QUOTE_RENDER_CODE" "Render QUOTATION thất bại"
QUOTE_DOCUMENT_ID="$(echo "$QUOTE_RENDER_BODY" | jq -er '.data.documentId')"
QUOTE_DOWNLOAD_URL="$(echo "$QUOTE_RENDER_BODY" | jq -er '.data.downloadUrl')"
[[ "$QUOTE_DOWNLOAD_URL" == "/api/documents/$QUOTE_DOCUMENT_ID/download" ]] || fail "downloadUrl không trỏ về documentId vừa render"

QUOTE_PDF="$TMP_DIR/quote.pdf"
QUOTE_DOWNLOAD_CODE="$(curl -sS -o "$QUOTE_PDF" -w '%{http_code}' "$API_URL/documents/$QUOTE_DOCUMENT_ID/download" \
  -H "Authorization: Bearer $TOKEN")"
assert_status "200" "$QUOTE_DOWNLOAD_CODE" "Download QUOTATION theo documentId thất bại"
[[ "$(head -c 5 "$QUOTE_PDF")" == "%PDF-" ]] || fail "File QUOTATION download không phải PDF"

info "Legacy download chỉ tải artifact mới nhất, không render ngầm"
LEGACY_QUOTE_CODE="$(curl -sS -o "$TMP_DIR/quote-latest.pdf" -w '%{http_code}' "$API_URL/documents/QUOTATION/$QUOTE_ID/download?lang=vi" \
  -H "Authorization: Bearer $TOKEN")"
assert_status "200" "$LEGACY_QUOTE_CODE" "Legacy download QUOTATION không tải được artifact đã render"
[[ "$(head -c 5 "$TMP_DIR/quote-latest.pdf")" == "%PDF-" ]] || fail "Legacy QUOTATION download không phải PDF"

info "Preview, render và download hợp đồng"
CONTRACT_PREVIEW_CODE="$(curl -sS -o "$TMP_DIR/contract-preview.html" -w '%{http_code}' "$API_URL/documents/CONTRACT/$CONTRACT_ID/preview?lang=vi" \
  -H "Authorization: Bearer $TOKEN")"
assert_status "200" "$CONTRACT_PREVIEW_CODE" "Preview CONTRACT thất bại"
grep -Eiq '<!doctype html|schema-document|hợp đồng' "$TMP_DIR/contract-preview.html" || fail "Preview CONTRACT không trả HTML hợp lệ"

CONTRACT_RENDER_RAW="$(curl -sS -w '\n%{http_code}' -X POST "$API_URL/documents/CONTRACT/$CONTRACT_ID/render" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"vi"}')"
CONTRACT_RENDER_BODY="${CONTRACT_RENDER_RAW%$'\n'*}"
CONTRACT_RENDER_CODE="${CONTRACT_RENDER_RAW##*$'\n'}"
assert_status "201" "$CONTRACT_RENDER_CODE" "Render CONTRACT thất bại"
CONTRACT_DOCUMENT_ID="$(echo "$CONTRACT_RENDER_BODY" | jq -er '.data.documentId')"
CONTRACT_PDF="$TMP_DIR/contract.pdf"
CONTRACT_DOWNLOAD_CODE="$(curl -sS -o "$CONTRACT_PDF" -w '%{http_code}' "$API_URL/documents/$CONTRACT_DOCUMENT_ID/download" \
  -H "Authorization: Bearer $TOKEN")"
assert_status "200" "$CONTRACT_DOWNLOAD_CODE" "Download CONTRACT theo documentId thất bại"
[[ "$(head -c 5 "$CONTRACT_PDF")" == "%PDF-" ]] || fail "File CONTRACT download không phải PDF"

info "Documents v1 smoke test PASS"
