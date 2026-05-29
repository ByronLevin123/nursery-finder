#!/bin/bash
set -euo pipefail

# Verify deployment is healthy
# Usage: API_URL=https://your-api.railway.app bash scripts/check-deploy.sh

API_URL=${API_URL:-http://localhost:3001}

echo "Checking NurseryMatch deployment at $API_URL..."
echo ""

# 1. Health check
echo "1. API Health..."
HEALTH=$(curl -sf "$API_URL/api/v1/health" || true)
if [ -z "$HEALTH" ]; then
  echo "FAIL: Health endpoint unreachable"
  exit 1
fi

if command -v jq &> /dev/null; then
  echo "$HEALTH" | jq .
  DB_STATUS=$(echo "$HEALTH" | jq -r '.database // "unknown"')
else
  echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
  DB_STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('database','unknown'))" 2>/dev/null || echo "unknown")
fi

if [ "$DB_STATUS" = "error" ]; then
  echo "FAIL: Database connection error"
  exit 1
fi
echo "PASS"
echo ""

# 2. Search test
echo "2. Nursery search (SW11)..."
SEARCH=$(curl -sf -X POST "$API_URL/api/v1/nurseries/smart-search" \
  -H "Content-Type: application/json" \
  -d '{"query":"SW11"}' || true)

if [ -z "$SEARCH" ]; then
  echo "FAIL: Search endpoint unreachable"
  exit 1
fi

if command -v jq &> /dev/null; then
  TOTAL=$(echo "$SEARCH" | jq -r '.meta.total // 0')
else
  TOTAL=$(echo "$SEARCH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('meta',{}).get('total',0))" 2>/dev/null || echo "0")
fi

echo "Found: $TOTAL nurseries"
if [ "$TOTAL" = "0" ]; then
  echo "WARN: Search returned 0 results (data may not be loaded yet)"
fi
echo "PASS"
echo ""

echo "Deployment check complete"
