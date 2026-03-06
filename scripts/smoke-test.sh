#!/usr/bin/env bash
# Smoke test: verifies Docker services and backend API are reachable and healthy.
# Usage: bash scripts/smoke-test.sh
# Expects: docker compose up -d && pnpm dev already running.

set -uo pipefail

PASS=0
FAIL=0
ERRORS=""
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

check() {
  local name="$1"
  local url="$2"
  local expect_code="${3:-200}"
  shift 3

  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    "$@" "$url" 2>/dev/null) || code="000"

  if [ "$code" = "$expect_code" ]; then
    echo "  PASS  $name (HTTP $code)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name — expected $expect_code, got $code"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $name: expected $expect_code, got $code"
  fi
}

echo ""
echo "=== Docker container health ==="

for svc in pdns-auth pdns-recursor keycloak; do
  status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null) || status="not found"
  if [ "$status" = "healthy" ]; then
    echo "  PASS  $svc ($status)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $svc ($status)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - container $svc: $status"
  fi
done

echo ""
echo "=== PowerDNS Auth Server (port 8081) ==="
check "Auth API /servers" \
  "http://localhost:8081/api/v1/servers/localhost" 200 \
  -H "X-API-Key: changeme"
check "Auth API /statistics" \
  "http://localhost:8081/api/v1/servers/localhost/statistics" 200 \
  -H "X-API-Key: changeme"
check "Auth API /zones" \
  "http://localhost:8081/api/v1/servers/localhost/zones" 200 \
  -H "X-API-Key: changeme"

echo ""
echo "=== PowerDNS Recursor (port 8082) ==="
check "Recursor API /servers" \
  "http://localhost:8082/api/v1/servers/localhost" 200 \
  -H "X-API-Key: changeme"
check "Recursor API /statistics" \
  "http://localhost:8082/api/v1/servers/localhost/statistics" 200 \
  -H "X-API-Key: changeme"

echo ""
echo "=== Keycloak (port 8080) ==="
check "Keycloak realm discovery" \
  "http://localhost:8080/realms/dns-admin/.well-known/openid-configuration" 200

echo ""
echo "=== Backend API (port 3000) ==="

# Login to get JWT cookie
echo "  ...  Logging in as admin"
login_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  "http://localhost:3000/trpc/auth.login" 2>/dev/null) || login_code="000"

if [ "$login_code" = "200" ]; then
  echo "  PASS  Backend login (HTTP $login_code)"
  PASS=$((PASS + 1))
else
  echo "  FAIL  Backend login — expected 200, got $login_code"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  - Backend login: expected 200, got $login_code"
fi

check "Backend auth.me" \
  "http://localhost:3000/trpc/auth.me" 200
check "Backend pdns.server.stats" \
  "http://localhost:3000/trpc/pdns.server.stats" 200
check "Backend recursor.stats" \
  "http://localhost:3000/trpc/recursor.stats" 200
check "Backend pdns.zones.list" \
  "http://localhost:3000/trpc/pdns.zones.list" 200

echo ""
echo "=== Frontend (port 5173) ==="
check "Vite dev server" \
  "http://localhost:5173/" 200

echo ""
echo "================================"
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo -e "\nFailures:$ERRORS"
  exit 1
fi
echo "All smoke tests passed."
