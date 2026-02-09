#!/bin/bash
# Helper script to check PITR availability and provide instructions

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SUPABASE_PROJECT_ID="pkjqznogflgbnwzkzmpg"
TARGET_DATE="2026-02-03"

echo -e "${BLUE}=== Supabase Point-in-Time Recovery (PITR) Check ===${NC}\n"

echo -e "${YELLOW}Project ID:${NC} $SUPABASE_PROJECT_ID"
echo -e "${YELLOW}Target Date:${NC} $TARGET_DATE\n"

echo -e "${GREEN}Step 1: Access Supabase Dashboard${NC}"
echo "URL: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID"
echo ""

echo -e "${GREEN}Step 2: Navigate to PITR${NC}"
echo "Path: Database → Backups → Point-in-Time Recovery"
echo ""

echo -e "${GREEN}Step 3: Check Available Snapshots${NC}"
echo "Look for snapshots around:"
echo "  - $TARGET_DATE 23:59:59-06 (end of Feb 3rd)"
echo "  - 2026-02-04 00:00:00-06 (start of Feb 4th, before deletion)"
echo ""

echo -e "${GREEN}Step 4: Verify PITR Availability${NC}"
echo "Supabase Pro plan provides:"
echo "  - 7 days of Point-in-Time Recovery"
echo "  - Ability to restore to any second within retention period"
echo ""

echo -e "${YELLOW}If PITR is available:${NC}"
echo "1. Select a timestamp from Feb 3rd (before deletion)"
echo "2. Create a database branch/restore point"
echo "3. Note the connection details for restored database"
echo "4. Run extraction scripts on restored database"
echo ""

echo -e "${YELLOW}If PITR is NOT available:${NC}"
echo "1. Check Supabase plan (Pro plan required)"
echo "2. Use manual backup restoration instead"
echo "3. See: docker/recovery-docker-compose.yml for local restoration"
echo ""

echo -e "${GREEN}Step 5: Check Backup Availability${NC}"
echo "Go to: Database → Backups"
echo "Available backups show until: Feb 4th at 21:56 PM (UTC-6)"
echo ""

echo -e "${BLUE}Next Steps:${NC}"
echo "1. Open Supabase Dashboard in your browser"
echo "2. Check PITR availability for Feb 3rd"
echo "3. If available, create restore point"
echo "4. Run: scripts/extract-deleted-order.sql on restored database"
echo ""

# Check if Supabase CLI is available
if command -v supabase &> /dev/null; then
    echo -e "${GREEN}Supabase CLI detected:${NC} $(supabase --version)"
    echo ""
    echo "You can also check via CLI:"
    echo "  supabase projects list"
    echo "  supabase db backups list --project-ref $SUPABASE_PROJECT_ID"
else
    echo -e "${YELLOW}Supabase CLI not installed${NC}"
    echo "Install with: brew install supabase/tap/supabase (macOS)"
fi

echo ""
echo -e "${BLUE}For detailed instructions, see:${NC}"
echo "  - docs/recovery-procedure.md"
echo "  - scripts/RECOVERY_README.md"
