#!/usr/bin/env bash
# Stats integration test: verifies that DNS queries update Auth Server and Recursor statistics.
# Uses UDP queries sent from inside the Docker network (UDP port-forward doesn't work on Windows).
# Also tests TCP queries via host port-forward and API-driven operations.
#
# Usage: bash scripts/stats-test.sh
# Expects: docker compose up -d already running.

set -uo pipefail

AUTH_API="http://localhost:8081/api/v1/servers/localhost"
REC_API="http://localhost:8082/api/v1/servers/localhost"
API_KEY="changeme"
PASS=0
FAIL=0
ERRORS=""
ZONE="stats-test.example."

# ── helpers ──────────────────────────────────────────────────────────────────

auth_stat() {
  curl -s -H "X-API-Key: $API_KEY" "$AUTH_API/statistics" \
    | python3 -c "import sys,json; stats={s['name']:s['value'] for s in json.load(sys.stdin)}; print(stats.get('$1','0'))"
}

rec_stat() {
  curl -s -H "X-API-Key: $API_KEY" "$REC_API/statistics" \
    | python3 -c "import sys,json; stats={s['name']:s['value'] for s in json.load(sys.stdin)}; print(stats.get('$1','0'))"
}

assert_increased() {
  local label="$1" before="$2" after="$3"
  if [ "$after" -gt "$before" ]; then
    echo "  PASS  $label: $before -> $after (+$(( after - before )))"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $label: expected increase, got $before -> $after"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $label: $before -> $after (no increase)"
  fi
}

send_udp_queries() {
  local target="$1" port="$2" name="$3" count="$4"
  docker compose exec -T pdns-recursor python3 -c "
import socket, struct
def make_query(name, qtype=1):
    q = struct.pack('>HHHHHH', 0x1234, 0x0100, 1, 0, 0, 0)
    for label in name.split('.'):
        if label:
            q += bytes([len(label)]) + label.encode()
    q += b'\x00' + struct.pack('>HH', qtype, 1)
    return q
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.settimeout(2)
for _ in range($count):
    sock.sendto(make_query('$name'), ('$target', $port))
    sock.recv(512)
sock.close()
print('sent $count UDP queries')
" 2>/dev/null
}

cleanup() {
  curl -s -X DELETE -H "X-API-Key: $API_KEY" "$AUTH_API/zones/$ZONE" -o /dev/null 2>/dev/null
}

# ── setup ────────────────────────────────────────────────────────────────────

echo ""
echo "=== Setup ==="

# Clean up any leftover zone from a previous run
cleanup

# Create test zone
http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"$ZONE\",\"kind\":\"Native\",\"nameservers\":[\"ns1.$ZONE\"],\"rrsets\":[{\"name\":\"$ZONE\",\"type\":\"A\",\"ttl\":300,\"changetype\":\"REPLACE\",\"records\":[{\"content\":\"1.2.3.4\",\"disabled\":false}]},{\"name\":\"www.$ZONE\",\"type\":\"A\",\"ttl\":300,\"changetype\":\"REPLACE\",\"records\":[{\"content\":\"5.6.7.8\",\"disabled\":false}]},{\"name\":\"$ZONE\",\"type\":\"MX\",\"ttl\":300,\"changetype\":\"REPLACE\",\"records\":[{\"content\":\"10 mail.$ZONE\",\"disabled\":false}]}]}" \
  "$AUTH_API/zones")

if [ "$http_code" = "201" ]; then
  echo "  Created test zone: $ZONE (A, MX, www)"
else
  echo "  FATAL: could not create test zone (HTTP $http_code)"
  exit 1
fi

# Flush caches so we start fresh
curl -s -H "X-API-Key: $API_KEY" -X PUT "$AUTH_API/cache/flush?domain=." -o /dev/null
curl -s -H "X-API-Key: $API_KEY" -X PUT "$REC_API/cache/flush?domain=." -o /dev/null
echo "  Flushed caches on both servers"

# ── Auth Server: UDP queries ─────────────────────────────────────────────────

echo ""
echo "=== Auth Server: UDP queries ==="

before=$(auth_stat udp-queries)
send_udp_queries pdns-auth 53 "stats-test.example" 10
after=$(auth_stat udp-queries)
assert_increased "udp-queries (10 sent)" "$before" "$after"

# ── Auth Server: TCP queries ─────────────────────────────────────────────────

echo ""
echo "=== Auth Server: TCP queries ==="

before=$(auth_stat tcp-queries)
for i in $(seq 1 10); do
  dig @127.0.0.1 -p 5300 "$ZONE" A +tcp +short +tries=1 +time=2 > /dev/null 2>&1
done
after=$(auth_stat tcp-queries)
assert_increased "tcp-queries (10 sent)" "$before" "$after"

# ── Auth Server: packet cache ────────────────────────────────────────────────

echo ""
echo "=== Auth Server: packet cache ==="

# Flush cache, then send one unique query (miss), then repeat it (hits)
curl -s -H "X-API-Key: $API_KEY" -X PUT "$AUTH_API/cache/flush?domain=." -o /dev/null

before_miss=$(auth_stat packetcache-miss)
before_hit=$(auth_stat packetcache-hit)

# First query = cache miss
send_udp_queries pdns-auth 53 "www.stats-test.example" 1
after_miss=$(auth_stat packetcache-miss)
assert_increased "packetcache-miss (1 new query)" "$before_miss" "$after_miss"

# Repeat same query 10 times = cache hits
before_hit=$(auth_stat packetcache-hit)
send_udp_queries pdns-auth 53 "www.stats-test.example" 10
after_hit=$(auth_stat packetcache-hit)
assert_increased "packetcache-hit (10 repeat queries)" "$before_hit" "$after_hit"

# ── Auth Server: query cache ─────────────────────────────────────────────────

echo ""
echo "=== Auth Server: query cache ==="

# Flush packet cache so queries reach the query cache layer
curl -s -H "X-API-Key: $API_KEY" -X PUT "$AUTH_API/cache/flush?domain=." -o /dev/null

before_miss=$(auth_stat query-cache-miss)
before_hit=$(auth_stat query-cache-hit)

# First query for a record = query-cache miss
send_udp_queries pdns-auth 53 "stats-test.example" 1
after_miss=$(auth_stat query-cache-miss)
assert_increased "query-cache-miss (1 cold query)" "$before_miss" "$after_miss"

# Flush only packet cache, keep query cache — next query hits query cache but misses packet cache
curl -s -H "X-API-Key: $API_KEY" -X PUT "$AUTH_API/cache/flush?domain=." -o /dev/null
before_hit=$(auth_stat query-cache-hit)
send_udp_queries pdns-auth 53 "stats-test.example" 1
after_hit=$(auth_stat query-cache-hit)
assert_increased "query-cache-hit (warm query-cache)" "$before_hit" "$after_hit"

# ── Auth Server: zone operations via API ─────────────────────────────────────

echo ""
echo "=== Auth Server: zone list / search via API ==="

# List zones
code=$(curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $API_KEY" "$AUTH_API/zones")
if [ "$code" = "200" ]; then
  echo "  PASS  GET /zones (HTTP $code)"
  PASS=$((PASS + 1))
else
  echo "  FAIL  GET /zones — expected 200, got $code"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  - GET /zones: $code"
fi

# Search records
result=$(curl -s -H "X-API-Key: $API_KEY" "$AUTH_API/search-data?q=*stats-test*&max=10")
count=$(echo "$result" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
if [ "$count" -gt 0 ] 2>/dev/null; then
  echo "  PASS  GET /search-data found $count results"
  PASS=$((PASS + 1))
else
  echo "  FAIL  GET /search-data returned no results"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  - search-data: no results"
fi

# ── Auth Server: cache flush stat ────────────────────────────────────────────

echo ""
echo "=== Auth Server: cache flush ==="

# Warm up cache, then flush and verify
send_udp_queries pdns-auth 53 "stats-test.example" 5 > /dev/null
before_size=$(curl -s -H "X-API-Key: $API_KEY" -X PUT "$AUTH_API/cache/flush?domain=." | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))")
if [ "$before_size" -ge 0 ] 2>/dev/null; then
  echo "  PASS  cache flush returned count: $before_size"
  PASS=$((PASS + 1))
else
  echo "  FAIL  cache flush did not return count"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  - cache flush: bad response"
fi

# ── Recursor: UDP questions ──────────────────────────────────────────────────

echo ""
echo "=== Recursor: UDP questions ==="

before=$(rec_stat questions)
send_udp_queries pdns-recursor 53 "google.com" 10
after=$(rec_stat questions)
assert_increased "questions (10 UDP queries)" "$before" "$after"

# ── Recursor: outgoing queries ───────────────────────────────────────────────

echo ""
echo "=== Recursor: outgoing queries ==="

# Flush cache so recursor must go upstream
curl -s -H "X-API-Key: $API_KEY" -X PUT "$REC_API/cache/flush?domain=." -o /dev/null

before=$(rec_stat all-outqueries)
# Query a domain that requires upstream resolution
send_udp_queries pdns-recursor 53 "example.org" 1
after=$(rec_stat all-outqueries)
assert_increased "all-outqueries (1 cold query)" "$before" "$after"

# ── Recursor: packet cache ───────────────────────────────────────────────────

echo ""
echo "=== Recursor: packet cache ==="

# Flush, send 1 (miss), then repeat (hits)
curl -s -H "X-API-Key: $API_KEY" -X PUT "$REC_API/cache/flush?domain=." -o /dev/null

before_miss=$(rec_stat packetcache-misses)
send_udp_queries pdns-recursor 53 "example.net" 1
after_miss=$(rec_stat packetcache-misses)
assert_increased "packetcache-misses (1 new query)" "$before_miss" "$after_miss"

before_hit=$(rec_stat packetcache-hits)
send_udp_queries pdns-recursor 53 "example.net" 10
after_hit=$(rec_stat packetcache-hits)
assert_increased "packetcache-hits (10 repeat queries)" "$before_hit" "$after_hit"

# ── Recursor: cache miss / upstream resolution ───────────────────────────────

echo ""
echo "=== Recursor: cache misses ==="

curl -s -H "X-API-Key: $API_KEY" -X PUT "$REC_API/cache/flush?domain=." -o /dev/null

before=$(rec_stat cache-misses)
# Use a unique subdomain to guarantee a cache miss
send_udp_queries pdns-recursor 53 "test-$(date +%s).example.com" 1
after=$(rec_stat cache-misses)
assert_increased "cache-misses (1 cold query)" "$before" "$after"

# ── Recursor: TCP questions ──────────────────────────────────────────────────

echo ""
echo "=== Recursor: TCP questions ==="

before=$(rec_stat questions)
for i in $(seq 1 5); do
  dig @127.0.0.1 -p 5301 google.com A +tcp +short +tries=1 +time=2 > /dev/null 2>&1
done
after=$(rec_stat questions)
assert_increased "questions via TCP (5 sent)" "$before" "$after"

# ── Recursor: cache flush via API ────────────────────────────────────────────

echo ""
echo "=== Recursor: cache flush ==="

send_udp_queries pdns-recursor 53 "google.com" 5 > /dev/null
flush_result=$(curl -s -H "X-API-Key: $API_KEY" -X PUT "$REC_API/cache/flush?domain=." | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('count', d.get('result','?')))")
if [ -n "$flush_result" ]; then
  echo "  PASS  cache flush returned: $flush_result"
  PASS=$((PASS + 1))
else
  echo "  FAIL  cache flush bad response"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  - recursor cache flush: bad response"
fi

# ── Recursor: forwarder list via API ─────────────────────────────────────────

echo ""
echo "=== Recursor: API endpoints ==="

code=$(curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $API_KEY" "$REC_API/zones")
if [ "$code" = "200" ]; then
  echo "  PASS  GET /zones (HTTP $code)"
  PASS=$((PASS + 1))
else
  echo "  FAIL  GET /zones — expected 200, got $code"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  - recursor GET /zones: $code"
fi

code=$(curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $API_KEY" "$REC_API/config")
if [ "$code" = "200" ]; then
  echo "  PASS  GET /config (HTTP $code)"
  PASS=$((PASS + 1))
else
  echo "  FAIL  GET /config — expected 200, got $code"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  - recursor GET /config: $code"
fi

# ── cleanup ──────────────────────────────────────────────────────────────────

echo ""
echo "=== Cleanup ==="
cleanup
echo "  Deleted test zone: $ZONE"

echo ""
echo "================================"
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo -e "\nFailures:$ERRORS"
  exit 1
fi
echo "All stats tests passed."
