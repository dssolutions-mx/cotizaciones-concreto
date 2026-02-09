#!/bin/bash
# Test database connection before running recovery

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Database Connection Test ===${NC}\n"

# Get connection string
echo "Enter your Supabase database connection string:"
echo "Format: postgresql://postgres:[password]@db.pkjqznogflgbnwzkzmpg.supabase.co:5432/postgres"
echo ""
read -p "Connection string: " DB_URL

if [ -z "$DB_URL" ]; then
    echo -e "${RED}No connection string provided${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Testing connection...${NC}"

# Test connection with a simple query
if docker run --rm -i postgres:15 psql "$DB_URL" -c "SELECT version();" 2>&1; then
    echo ""
    echo -e "${GREEN}✅ Connection successful!${NC}"
    echo ""
    echo "You can now run the recovery script:"
    echo "  ./scripts/run-recovery-now.sh"
else
    echo ""
    echo -e "${RED}❌ Connection failed${NC}"
    echo ""
    echo "Common issues:"
    echo "  1. Password might be wrong - check Supabase Dashboard"
    echo "  2. Connection string format might be incorrect"
    echo "  3. IP whitelisting might be required"
    echo ""
    echo "To get the correct connection string:"
    echo "  1. Go to Supabase Dashboard → Project Settings → Database"
    echo "  2. Scroll to 'Connection string'"
    echo "  3. Click 'URI' tab"
    echo "  4. Copy the string and replace [YOUR-PASSWORD] with your actual password"
    echo ""
    echo "If password has special characters, try URL-encoding them:"
    echo "  @ becomes %40"
    echo "  # becomes %23"
    echo "  & becomes %26"
fi
