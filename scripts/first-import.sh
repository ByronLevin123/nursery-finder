#!/bin/bash
# Run this once after first deployment to import all Ofsted data
# Usage: ADMIN_USER=admin ADMIN_PASS=yourpass API_URL=https://your-api.railway.app bash scripts/first-import.sh

set -e

API_URL=${API_URL:-http://localhost:3001}
ADMIN_USER=${ADMIN_USER:-admin}
ADMIN_PASS=${ADMIN_PASS:-admin}

echo "=== NurseryFinder First Import ==="
echo "API: $API_URL"
echo ""

echo "Step 1: Checking API health..."
curl -s "$API_URL/api/v1/health" | python3 -m json.tool
echo ""

echo "Step 2: Importing Ofsted register (this takes 5-10 minutes)..."
curl -s -X POST "$API_URL/api/v1/ingest/ofsted" \
  -u "$ADMIN_USER:$ADMIN_PASS" \
  -H "Content-Type: application/json" | python3 -m json.tool
echo ""

echo "Step 3: Starting geocoding batch (first of many nightly runs)..."
curl -s -X POST "$API_URL/api/v1/ingest/geocode" \
  -u "$ADMIN_USER:$ADMIN_PASS" \
  -H "Content-Type: application/json" | python3 -m json.tool
echo ""

echo "=== Import complete! ==="
echo "Geocoding will continue automatically every night at 3am."
echo "Full dataset geocoded in approximately 25 days."
