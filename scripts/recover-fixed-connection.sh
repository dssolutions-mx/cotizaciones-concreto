#!/bin/bash
# Fixed recovery script - uses connection pooler to avoid IPv6 issues

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

ORDER_NUMBER="ORD-20260128-7243"
OUTPUT_DIR="./recovery-exports"

echo -e "${BLUE}=== Fixed Recovery for Order: $ORDER_NUMBER ===${NC}\n"

# Create directories
mkdir -p "$OUTPUT_DIR"

# Step 1: Get connection string (use pooler)
echo -e "${GREEN}Step 1: Get Connection Pooler String${NC}"
echo ""
echo "The direct connection failed due to IPv6 network issues."
echo "We need to use the Connection Pooler instead."
echo ""
echo "To get the pooler connection string:"
echo "  1. Go to: https://supabase.com/dashboard/project/pkjqznogflgbnwzkzmpg"
echo "  2. Navigate to: Project Settings → Database → Connection string"
echo "  3. Click on: 'Connection Pooling' tab (not URI)"
echo "  4. Copy the connection string"
echo "  5. Replace [YOUR-PASSWORD] with: Jj2584410"
echo ""
echo "It should look like:"
echo "  postgresql://postgres.pkjqznogflgbnwzkzmpg:Jj2584410@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
echo ""
read -p "Enter pooler connection string: " DB_URL

if [ -z "$DB_URL" ]; then
    echo -e "${RED}No connection string provided${NC}"
    exit 1
fi

# Step 2: Test connection
echo ""
echo -e "${GREEN}Step 2: Testing Connection...${NC}"
if docker run --rm -i postgres:15 psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connection successful!${NC}\n"
else
    echo -e "${RED}❌ Connection still failing${NC}"
    echo ""
    echo "Let's try a different approach - using Supabase CLI or direct SQL queries"
    echo "Check Supabase Dashboard → SQL Editor to run queries directly"
    exit 1
fi

# Step 3: Search for order
echo -e "${GREEN}Step 3: Searching for Order Traces...${NC}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TRACES_FILE="$OUTPUT_DIR/order-traces-$TIMESTAMP.txt"

echo "Running investigation queries..."
docker run --rm -i postgres:15 psql "$DB_URL" -f - < scripts/find-order-ORD-20260128-7243.sql > "$TRACES_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Search complete!${NC}"
    echo "Results: $TRACES_FILE"
    echo ""
    
    # Show what we found
    echo "=== Findings ==="
    cat "$TRACES_FILE" | head -50
    echo ""
    echo "Full results in: $TRACES_FILE"
else
    echo -e "${RED}Error during search${NC}"
    cat "$TRACES_FILE"
    exit 1
fi

# Step 4: Try extraction
echo ""
echo -e "${GREEN}Step 4: Attempting Extraction...${NC}"
EXTRACT_FILE="$OUTPUT_DIR/extracted-order-$TIMESTAMP.json"

docker run --rm -i postgres:15 psql "$DB_URL" -f - < scripts/extract-order-ORD-20260128-7243.sql > "$EXTRACT_FILE" 2>&1

if grep -qi "recovered_order_data\|order_number.*$ORDER_NUMBER" "$EXTRACT_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ ORDER FOUND!${NC}"
    echo "Extracted: $EXTRACT_FILE"
else
    echo -e "${YELLOW}Order not found (expected - it was deleted)${NC}"
    echo "Check traces file for related records"
fi

echo ""
echo -e "${GREEN}Recovery complete! Check: $TRACES_FILE${NC}"
