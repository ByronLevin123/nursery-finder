#!/bin/bash
# Verify deployment is healthy
# Usage: API_URL=https://your-api.railway.app bash scripts/check-deploy.sh

API_URL=${API_URL:-http://localhost:3001}

echo "🔍 Checking CompareTheNursery deployment..."
echo ""

# Health check
echo "1. API Health..."
HEALTH=$(curl -s "$API_URL/api/v1/health")
echo $HEALTH | python3 -m json.tool 2>/dev/null || echo $HEALTH
echo ""

# Search test
echo "2. Nursery search (SW11)..."
SEARCH=$(curl -s -X POST "$API_URL/api/v1/nurseries/search" \
  -H "Content-Type: application/json" \
  -d '{"postcode":"SW11","radius_km":2}')
TOTAL=$(echo $SEARCH | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"Found: {d['meta']['total']} nurseries\")" 2>/dev/null)
echo $TOTAL
echo ""

echo "✅ Deployment check complete"
