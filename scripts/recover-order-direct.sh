#!/bin/bash
# Direct recovery script for ORD-20260128-7243
# Connects directly to production database to find and recover order traces

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

ORDER_NUMBER="ORD-20260128-7243"
OUTPUT_DIR="./recovery-exports"

echo -e "${BLUE}=== Direct Order Recovery: $ORDER_NUMBER ===${NC}\n"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${RED}Error: .env.local not found${NC}"
    echo ""
    echo "Please create .env.local with:"
    echo "  SUPABASE_DB_URL=postgresql://postgres:[password]@[host]:5432/postgres"
    echo ""
    echo "Or provide connection string directly:"
    read -p "Enter Supabase database connection string: " DB_URL
else
    # Try to extract connection string from .env.local
    echo -e "${GREEN}Found .env.local${NC}"
    echo "Please provide database connection string:"
    echo "Format: postgresql://postgres:[password]@[host]:5432/postgres"
    read -p "Connection string: " DB_URL
fi

if [ -z "$DB_URL" ]; then
    echo -e "${RED}No connection string provided. Exiting.${NC}"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo ""
echo -e "${GREEN}Step 1: Searching for order traces in production database...${NC}"

# Run investigation query
psql "$DB_URL" -f scripts/find-order-ORD-20260128-7243.sql > "$OUTPUT_DIR/order-traces-$(date +%Y%m%d-%H%M%S).txt" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Investigation complete. Results saved to: $OUTPUT_DIR${NC}"
    echo ""
    echo "Review the results to find:"
    echo "  - order_id (UUID) if found in notifications or other tables"
    echo "  - Any related records that can help reconstruct the order"
    echo ""
else
    echo -e "${RED}Error running investigation query${NC}"
    echo "Check connection string and try again"
    exit 1
fi

# Step 2: If we have order_id, try to reconstruct
echo -e "${GREEN}Step 2: Attempting to reconstruct order...${NC}"
echo ""
echo "If order_id was found in the traces, we can:"
echo "  1. Extract all related records"
echo "  2. Reconstruct order from notifications/quotes"
echo "  3. Export as evidence"
echo ""
echo "Review the trace results first, then we can proceed with reconstruction."

echo ""
echo -e "${BLUE}=== Recovery Steps Complete ===${NC}"
echo "Next: Review trace results and proceed with reconstruction if order_id found"
