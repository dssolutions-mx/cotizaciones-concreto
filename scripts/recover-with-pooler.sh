#!/bin/bash
# Recovery script using connection pooler (more reliable)
# This uses the pooler port which is more stable

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

ORDER_NUMBER="ORD-20260128-7243"
OUTPUT_DIR="./recovery-exports"
BACKUP_DIR="./recovery-backups"

echo -e "${BLUE}=== Docker Recovery for Order: $ORDER_NUMBER ===${NC}\n"

# Create directories
mkdir -p "$OUTPUT_DIR" "$BACKUP_DIR"

# Step 1: Get connection details
echo -e "${GREEN}Step 1: Database Connection Setup${NC}"
echo ""
echo "We'll use the connection pooler which is more reliable."
echo ""
echo "Get connection string from: Supabase Dashboard → Project Settings → Database → Connection string"
echo ""
echo "Options:"
echo "  A) Use Connection Pooler (port 6543) - RECOMMENDED"
echo "  B) Use Direct Connection (port 5432)"
echo ""
read -p "Choose option (A/B) [A]: " CONN_TYPE
CONN_TYPE=${CONN_TYPE:-A}

if [[ "$CONN_TYPE" == "A" || "$CONN_TYPE" == "a" ]]; then
    echo ""
    echo "Using Connection Pooler (port 6543)"
    echo "Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
    echo ""
    read -p "Enter pooler connection string: " DB_URL
else
    echo ""
    echo "Using Direct Connection (port 5432)"
    echo "Format: postgresql://postgres:Jj2584410@db.pkjqznogflgbnwzkzmpg.supabase.co:5432/postgres"
    echo ""
    read -p "Enter direct connection string: " DB_URL
fi

if [ -z "$DB_URL" ]; then
    echo -e "${RED}No connection string provided. Exiting.${NC}"
    exit 1
fi

# Step 2: Test connection first
echo ""
echo -e "${GREEN}Step 2: Testing Connection...${NC}"
echo "Testing connection to production database..."

if docker run --rm -i postgres:15 psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connection successful!${NC}\n"
else
    echo -e "${RED}❌ Connection failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check password is correct"
    echo "  2. Try Connection Pooler instead (port 6543)"
    echo "  3. Check IP whitelisting in Supabase Dashboard"
    echo ""
    echo "To get pooler connection string:"
    echo "  Supabase Dashboard → Database → Connection string → Connection Pooling → URI"
    exit 1
fi

# Step 3: Start Docker recovery database
echo -e "${GREEN}Step 3: Starting Recovery Database...${NC}"
if ! docker ps | grep -q order-recovery-db; then
    echo "Starting Docker containers..."
    docker-compose -f docker/recovery-docker-compose.yml up -d
    
    echo "Waiting for database to be ready..."
    sleep 10
    
    for i in {1..30}; do
        if docker exec order-recovery-db pg_isready -U postgres > /dev/null 2>&1; then
            echo -e "${GREEN}Recovery database is ready!${NC}\n"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}Database failed to start${NC}"
            exit 1
        fi
        sleep 1
    done
else
    echo -e "${GREEN}Recovery database already running${NC}\n"
fi

# Step 4: Search for order traces
echo -e "${GREEN}Step 4: Searching for Order Traces...${NC}"
echo "Order: $ORDER_NUMBER"
echo ""

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TRACES_FILE="$OUTPUT_DIR/order-traces-$TIMESTAMP.txt"

echo "Running investigation queries..."
if docker run --rm -i postgres:15 psql "$DB_URL" -f - < scripts/find-order-ORD-20260128-7243.sql > "$TRACES_FILE" 2>&1; then
    echo -e "${GREEN}Search complete!${NC}"
    echo "Results saved to: $TRACES_FILE"
    echo ""
    
    # Show summary
    echo "=== Summary of Findings ==="
    if grep -qi "order_number.*$ORDER_NUMBER\|order_id" "$TRACES_FILE" 2>/dev/null; then
        echo -e "${GREEN}Found references to the order!${NC}"
        grep -i "order_number\|order_id\|source_table" "$TRACES_FILE" | head -20
    else
        echo -e "${YELLOW}Checking for related records...${NC}"
        echo "Review the full file: $TRACES_FILE"
    fi
    echo ""
else
    echo -e "${RED}Error searching database${NC}"
    echo "Check the error in: $TRACES_FILE"
    exit 1
fi

# Step 5: Try to extract order
echo -e "${GREEN}Step 5: Attempting Order Extraction...${NC}"
EXTRACT_FILE="$OUTPUT_DIR/extracted-order-$TIMESTAMP.json"

echo "Trying to extract order directly..."
if docker run --rm -i postgres:15 psql "$DB_URL" -f - < scripts/extract-order-ORD-20260128-7243.sql > "$EXTRACT_FILE" 2>&1; then
    if grep -qi "recovered_order_data\|order_number.*$ORDER_NUMBER" "$EXTRACT_FILE" 2>/dev/null; then
        echo -e "${GREEN}✅ ORDER FOUND AND EXTRACTED!${NC}"
        echo "Extracted data: $EXTRACT_FILE"
    else
        echo -e "${YELLOW}Order not found in current database (expected - it was deleted)${NC}"
        echo "But we may have found traces. Check: $TRACES_FILE"
    fi
else
    echo -e "${YELLOW}Direct extraction failed (expected if order was deleted)${NC}"
fi

echo ""
echo -e "${BLUE}=== Recovery Summary ===${NC}"
echo ""
echo "Files created:"
echo "  📄 Traces: $TRACES_FILE"
if [ -f "$EXTRACT_FILE" ]; then
    echo "  📄 Extraction: $EXTRACT_FILE"
fi
echo ""
echo "Next steps:"
echo "  1. Review: cat $TRACES_FILE"
echo "  2. Look for order_id (UUID) in the results"
echo "  3. If order_id found, we can reconstruct the order"
echo ""
echo -e "${GREEN}Recovery process complete!${NC}"
