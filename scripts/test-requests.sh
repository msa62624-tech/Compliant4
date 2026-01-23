#!/usr/bin/env bash
set -euo pipefail
BASE=${BASE_URL:-http://localhost:3001}
ADMIN_PW=${ADMIN_PW:-admin123}

echo "[test-requests] Using backend base: $BASE"

echo "\n[test-requests] Debug route:"
curl -sS "$BASE/_debug/routes" | jq . || true

echo "\n[test-requests] Public users (no auth):"
curl -sS "$BASE/public/users" | jq . || true

echo "\n[test-requests] Attempt login as admin (username: admin)"
LOGIN_RESP=$(curl -sS -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"$ADMIN_PW\"}") || true
echo "$LOGIN_RESP" | jq . || true

TOKEN=$(echo "$LOGIN_RESP" | jq -r .accessToken // empty)
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  echo "\n[test-requests] Got token, calling protected /entities/User"
  curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/entities/User" | jq . || true
else
  echo "\n[test-requests] Login failed or token not returned. Protected endpoints require auth."
fi
