#!/bin/bash
# Use pg_dump to create a dump of CURRENT database state
# Note: This won't recover deleted data, but can be useful for comparison

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_REF="pkjqznogflgbnwzkzmpg"
OUTPUT_DIR="./recovery-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo -e "${BLUE}=== Creating pg_dump of Current Database State ===${NC}\n"

mkdir -p "$OUTPUT_DIR"

# Connection string (using pooler)
DB_URL="postgresql://postgres.${PROJECT_REF}:Jj25844105826@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

echo -e "${YELLOW}⚠️  Important: pg_dump only dumps CURRENT database state${NC}"
echo "This will NOT recover the deleted order from Feb 3rd."
echo "It will create a snapshot of the database as it exists NOW."
echo ""
read -p "Continue? (y/n): " CONTINUE

if [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo -e "${GREEN}Step 1: Testing connection...${NC}"
if docker run --rm -i postgres:15 psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connection successful${NC}\n"
else
    echo -e "${RED}❌ Connection failed${NC}"
    exit 1
fi

echo -e "${GREEN}Step 2: Creating database dump...${NC}"
echo "This may take several minutes depending on database size..."

# Create full database dump
DUMP_FILE="$OUTPUT_DIR/current-state-$TIMESTAMP.dump"

docker run --rm -i postgres:15 pg_dump "$DB_URL" \
    --format=custom \
    --no-owner \
    --no-acl \
    --verbose \
    > "$DUMP_FILE" 2>&1

if [ $? -eq 0 ]; then
    DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Dump created successfully!${NC}"
    echo "  File: $DUMP_FILE"
    echo "  Size: $DUMP_SIZE"
    echo ""
    echo -e "${YELLOW}Note: This dump contains the CURRENT state (without the deleted order)${NC}"
    echo ""
    echo "To restore this dump:"
    echo "  docker exec -i order-recovery-db pg_restore -U postgres -d recovery_db --clean --if-exists < $DUMP_FILE"
else
    echo -e "${RED}❌ Dump failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}=== Alternative: Dump Specific Tables ===${NC}"
echo ""
echo "If you want to dump only specific tables related to orders:"
echo ""
echo "  docker run --rm -i postgres:15 pg_dump \"$DB_URL\" \\"
echo "    --table=orders \\"
echo "    --table=order_items \\"
echo "    --table=order_notifications \\"
echo "    --format=custom \\"
echo "    > $OUTPUT_DIR/orders-tables-$TIMESTAMP.dump"
echo ""
