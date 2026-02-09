#!/bin/bash
# Complete Docker-based recovery for ORD-20260128-7243
# Since backups don't appear in dashboard, we'll connect directly to production

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
echo "We need your Supabase database connection string."
echo ""
echo "Get it from: Supabase Dashboard → Project Settings → Database → Connection string"
echo "Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
echo ""
read -p "Enter database connection string: " DB_URL

if [ -z "$DB_URL" ]; then
    echo -e "${RED}No connection string provided. Exiting.${NC}"
    exit 1
fi

# Step 2: Start Docker recovery database (for local operations)
echo -e "\n${GREEN}Step 2: Starting Docker Recovery Database${NC}"
if ! docker ps | grep -q order-recovery-db; then
    echo "Starting recovery database container..."
    docker-compose -f docker/recovery-docker-compose.yml up -d
    
    echo "Waiting for database to be ready..."
    sleep 10
    
    # Wait for database to be ready
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

# Step 3: Search for order traces in production database
echo -e "${GREEN}Step 3: Searching for Order Traces in Production Database${NC}"
echo "Order: $ORDER_NUMBER"
echo ""

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TRACES_FILE="$OUTPUT_DIR/order-traces-$TIMESTAMP.txt"

echo "Running investigation queries..."
if docker run --rm -i postgres:15 psql "$DB_URL" -f - < scripts/find-order-ORD-20260128-7243.sql > "$TRACES_FILE" 2>&1; then
    echo -e "${GREEN}Investigation complete!${NC}"
    echo "Results saved to: $TRACES_FILE"
    echo ""
    
    # Check if we found anything
    if grep -q "order_number.*$ORDER_NUMBER\|order_id" "$TRACES_FILE" 2>/dev/null; then
        echo -e "${GREEN}Found traces of the order!${NC}"
        echo ""
        echo "Review the results to find:"
        echo "  - order_id (UUID)"
        echo "  - Related records"
        echo ""
    else
        echo -e "${YELLOW}No direct matches found. Checking for related records...${NC}"
    fi
    
    # Show summary
    echo "Summary of findings:"
    grep -E "source_table|order_number|order_id" "$TRACES_FILE" | head -20 || echo "Review full file for details"
    echo ""
else
    echo -e "${RED}Error running investigation queries${NC}"
    echo "Check connection string and try again"
    exit 1
fi

# Step 4: Try to extract order if found
echo -e "${GREEN}Step 4: Attempting Order Extraction${NC}"
echo ""

# Check if we can extract directly
EXTRACT_FILE="$OUTPUT_DIR/extracted-order-$TIMESTAMP.json"

echo "Trying to extract order directly from production database..."
if docker run --rm -i postgres:15 psql "$DB_URL" -f - < scripts/extract-order-ORD-20260128-7243.sql > "$EXTRACT_FILE" 2>&1; then
    if grep -q "recovered_order_data\|order_number.*$ORDER_NUMBER" "$EXTRACT_FILE" 2>/dev/null; then
        echo -e "${GREEN}Order found and extracted!${NC}"
        echo "Extracted data saved to: $EXTRACT_FILE"
        echo ""
        echo "Order recovery successful!"
    else
        echo -e "${YELLOW}Order not found in current database (expected - it was deleted)${NC}"
        echo "We'll need to reconstruct from traces or use backup method"
        echo ""
    fi
else
    echo -e "${YELLOW}Direct extraction failed (expected if order was deleted)${NC}"
    echo ""
fi

# Step 5: Create database dump for deeper search
echo -e "${GREEN}Step 5: Creating Database Dump for Deep Search${NC}"
echo ""
read -p "Create full database dump for deeper analysis? (y/n): " CREATE_DUMP

if [[ "$CREATE_DUMP" == "y" || "$CREATE_DUMP" == "Y" ]]; then
    DUMP_FILE="$BACKUP_DIR/production-dump-$TIMESTAMP.sql"
    echo "Creating database dump (this may take a while)..."
    
    if docker run --rm -i postgres:15 pg_dump "$DB_URL" > "$DUMP_FILE" 2>&1; then
        echo -e "${GREEN}Dump created: $DUMP_FILE${NC}"
        echo ""
        echo "Now restoring to local database for search..."
        
        # Restore to local database
        docker exec -i order-recovery-db psql -U postgres -d recovery_db < "$DUMP_FILE" 2>&1 | tail -5
        
        echo ""
        echo "Searching restored database for order..."
        docker cp scripts/find-order-ORD-20260128-7243.sql order-recovery-db:/tmp/
        docker exec -i order-recovery-db psql -U postgres -d recovery_db -f /tmp/find-order-ORD-20260128-7243.sql > "$OUTPUT_DIR/restored-db-traces-$TIMESTAMP.txt" 2>&1
        
        echo -e "${GREEN}Search complete. Results: $OUTPUT_DIR/restored-db-traces-$TIMESTAMP.txt${NC}"
        
        # Try extraction from restored database
        docker cp scripts/extract-order-ORD-20260128-7243.sql order-recovery-db:/tmp/
        docker exec -i order-recovery-db psql -U postgres -d recovery_db -f /tmp/extract-order-ORD-20260128-7243.sql > "$OUTPUT_DIR/extracted-from-dump-$TIMESTAMP.json" 2>&1
        
        if grep -q "recovered_order_data\|order_number.*$ORDER_NUMBER" "$OUTPUT_DIR/extracted-from-dump-$TIMESTAMP.json" 2>/dev/null; then
            echo -e "${GREEN}Order found in dump!${NC}"
            echo "Extracted: $OUTPUT_DIR/extracted-from-dump-$TIMESTAMP.json"
        fi
    else
        echo -e "${RED}Failed to create dump${NC}"
        echo "You may need to use Supabase CLI or contact support"
    fi
else
    echo "Skipping dump creation"
fi

# Step 6: Summary and next steps
echo ""
echo -e "${BLUE}=== Recovery Summary ===${NC}"
echo ""
echo "Files created:"
echo "  - Traces: $TRACES_FILE"
if [ -f "$EXTRACT_FILE" ]; then
    echo "  - Extraction attempt: $EXTRACT_FILE"
fi
if [ -f "$OUTPUT_DIR/extracted-from-dump-$TIMESTAMP.json" ]; then
    echo "  - Extracted from dump: $OUTPUT_DIR/extracted-from-dump-$TIMESTAMP.json"
fi
echo ""
echo "Next steps:"
echo "  1. Review trace files for order_id or related records"
echo "  2. If order_id found, reconstruct order from traces"
echo "  3. If not found, contact Supabase support for backup access"
echo "  4. Export recovered data as evidence"
echo ""
echo -e "${GREEN}Recovery process complete!${NC}"
