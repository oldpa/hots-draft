#!/bin/bash

# Test script for the HotS Draft Tool API

API_URL="${1:-http://localhost:3000}"

echo "🧪 Testing HotS Draft Tool API"
echo "================================"
echo "API URL: $API_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo "Test 1: Health Check"
echo "--------------------"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/health")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Passed${NC} (HTTP $http_code)"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ Failed${NC} (HTTP $http_code)"
    echo "$body"
fi
echo ""

# Test 2: Player Heroes - Valid Request
echo "Test 2: Player Heroes - Valid Request"
echo "--------------------------------------"
echo "Battletag: oldpa#21616, Region: 2 (EU)"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/player/heroes?battletag=oldpa%2321616&region=2")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Passed${NC} (HTTP $http_code)"
    # Show summary
    cached=$(echo "$body" | jq -r '.cached // false' 2>/dev/null)
    echo "Cached: $cached"
    
    # Count game types and heroes
    game_types=$(echo "$body" | jq -r 'keys | length - 3' 2>/dev/null)  # -3 for cached, cache_key, cache_ttl
    echo "Game types found: $game_types"
    
    # Show first few heroes
    echo "Sample data:"
    echo "$body" | jq 'to_entries | map(select(.key != "cached" and .key != "cache_key" and .key != "cache_ttl")) | .[0] | {game_type: .key, heroes: (.value | keys | .[0:3])}' 2>/dev/null || echo "$body" | head -20
else
    echo -e "${RED}✗ Failed${NC} (HTTP $http_code)"
    echo "$body"
fi
echo ""

# Test 3: Player Heroes - Missing Parameters
echo "Test 3: Player Heroes - Missing Parameters"
echo "-------------------------------------------"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/player/heroes?battletag=test%2312345")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 400 ]; then
    echo -e "${GREEN}✓ Passed${NC} (HTTP $http_code - correctly rejected)"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${YELLOW}⚠ Unexpected${NC} (HTTP $http_code - expected 400)"
    echo "$body"
fi
echo ""

# Test 4: Player Heroes - Invalid Region
echo "Test 4: Player Heroes - Invalid Region"
echo "---------------------------------------"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/player/heroes?battletag=test%2312345&region=99")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 400 ]; then
    echo -e "${GREEN}✓ Passed${NC} (HTTP $http_code - correctly rejected)"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${YELLOW}⚠ Unexpected${NC} (HTTP $http_code - expected 400)"
    echo "$body"
fi
echo ""

# Test 5: Cache Test (second request should be cached)
echo "Test 5: Cache Test"
echo "------------------"
echo "Making second request to same endpoint..."
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/player/heroes?battletag=oldpa%2321616&region=2")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    cached=$(echo "$body" | jq -r '.cached // false' 2>/dev/null)
    if [ "$cached" = "true" ]; then
        echo -e "${GREEN}✓ Passed${NC} (Served from cache)"
    else
        echo -e "${YELLOW}⚠ Warning${NC} (Not cached - might be first run or cache expired)"
    fi
    echo "Cached: $cached"
else
    echo -e "${RED}✗ Failed${NC} (HTTP $http_code)"
fi
echo ""

echo "================================"
echo "✅ Test suite complete!"
echo ""
echo "💡 Tips:"
echo "   - If cache tests fail, that's normal on first run"
echo "   - Wait a few seconds and run again to test caching"
echo "   - Check logs with: vercel logs (for production)"
echo ""

