#!/bin/bash
# Recovery script for Feb 3rd, 2026 deleted order
# This script helps recover order data from Supabase PITR or backup

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Order Recovery Script - February 3rd, 2026 ===${NC}\n"

# Configuration
TARGET_DATE="2026-02-03"
TARGET_TIMEZONE="-06"  # UTC-6 (Mexico time)
RECOVERY_DIR="./recovery-$(date +%Y%m%d-%H%M%S)"
SUPABASE_PROJECT_ID="pkjqznogflgbnwzkzmpg"

echo "Recovery directory: $RECOVERY_DIR"
mkdir -p "$RECOVERY_DIR"

# Step 1: Check Supabase CLI
echo -e "\n${YELLOW}Step 1: Checking Supabase CLI...${NC}"
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Supabase CLI not found. Installing...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install supabase/tap/supabase
    else
        echo "Please install Supabase CLI: https://supabase.com/docs/guides/cli"
        exit 1
    fi
else
    echo -e "${GREEN}Supabase CLI found: $(supabase --version)${NC}"
fi

# Step 2: Instructions for manual PITR recovery
echo -e "\n${YELLOW}Step 2: Point-in-Time Recovery Instructions${NC}"
cat << EOF
To recover the order using Supabase PITR:

1. Go to Supabase Dashboard:
   https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID

2. Navigate to: Database → Backups → Point-in-Time Recovery

3. Select a timestamp BEFORE the deletion (Feb 3rd, 2026, before deletion time)

4. Create a new database branch/restore point

5. Once restored, connect to the restored database and run:
   psql <restored_connection_string> -f scripts/extract-deleted-order.sql > $RECOVERY_DIR/recovered-order.json

6. Or use the Supabase Dashboard SQL Editor on the restored database

Alternative: Download backup from Dashboard → Database → Backups
Then restore locally using Docker (see docker/recovery-docker-compose.yml)

EOF

# Step 3: Check for related records in current database
echo -e "\n${YELLOW}Step 3: Checking for related records in current database...${NC}"
echo "Running investigation queries..."

# Check if .env.local exists for database connection
if [ -f ".env.local" ]; then
    echo "Found .env.local - you can run investigation queries manually"
    echo "Run: psql <your_connection_string> -f scripts/investigate-deleted-order.sql"
else
    echo -e "${YELLOW}No .env.local found. You'll need to run investigation queries manually.${NC}"
fi

# Step 4: Create recovery workspace
echo -e "\n${YELLOW}Step 4: Creating recovery workspace...${NC}"
mkdir -p "$RECOVERY_DIR/scripts"
mkdir -p "$RECOVERY_DIR/exports"
mkdir -p "$RECOVERY_DIR/backups"

# Copy scripts to recovery directory
cp scripts/investigate-deleted-order.sql "$RECOVERY_DIR/scripts/"
cp scripts/extract-deleted-order.sql "$RECOVERY_DIR/scripts/"

echo -e "${GREEN}Recovery workspace created at: $RECOVERY_DIR${NC}"

# Step 5: Instructions summary
echo -e "\n${GREEN}=== Next Steps ===${NC}"
cat << EOF
1. Access Supabase Dashboard and check PITR availability for Feb 3rd
2. Run investigation queries: scripts/investigate-deleted-order.sql
3. Restore database snapshot to Feb 3rd (before deletion)
4. Extract order data: scripts/extract-deleted-order.sql
5. Export recovered data to: $RECOVERY_DIR/exports/

All recovery files will be saved in: $RECOVERY_DIR
EOF

echo -e "\n${GREEN}Recovery script setup complete!${NC}"
