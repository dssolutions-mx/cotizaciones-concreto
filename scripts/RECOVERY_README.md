# Order Recovery Scripts - Quick Reference

## Overview

These scripts help recover a deleted order from February 3rd, 2026. The order was deleted between Feb 3rd and Feb 4th morning and needs to be recovered as evidence.

## Quick Start

### 1. Run Investigation (Current Database)
```bash
# Check for related records that might still exist
psql <your_connection_string> -f scripts/investigate-deleted-order.sql
```

### 2. Set Up Recovery Environment
```bash
# Run the recovery setup script
./scripts/recover-order-feb3.sh
```

### 3. Download Scheduled Backup
1. Go to: https://supabase.com/dashboard/project/pkjqznogflgbnwzkzmpg
2. Navigate to: **Database → Backups → Scheduled backups**
3. Find backup closest to **Feb 3rd, 2026** (before deletion)
4. Download backup file (.dump or .sql)
5. Save to: `recovery-backups/` directory

### 4. Restore Backup
```bash
# Automated restoration
./scripts/restore-from-backup.sh

# OR manual restoration
docker-compose -f docker/recovery-docker-compose.yml up -d
docker exec -i order-recovery-db pg_restore -U postgres -d recovery_db --clean --if-exists < recovery-backups/backup.dump
```

### 5. Extract Order Data
```bash
# Option A: Using SQL (recommended)
docker cp scripts/extract-deleted-order.sql order-recovery-db:/tmp/
docker exec -i order-recovery-db psql -U postgres -d recovery_db -f /tmp/extract-deleted-order.sql > recovery-exports/recovered-order.json

# Option B: Using TypeScript
# Update connection details in scripts/extract-order-data.ts
npx tsx scripts/extract-order-data.ts
```

## Files

| File | Purpose |
|------|---------|
| `investigate-deleted-order.sql` | Check current database for related records |
| `extract-deleted-order.sql` | Extract order data from restored snapshot |
| `extract-order-data.ts` | Programmatic extraction with JSON/CSV export |
| `recover-order-feb3.sh` | Automated recovery workflow setup |

## Docker Local Restoration

**This is the primary method since PITR add-on is not available.**

```bash
# Step 1: Download backup from Supabase Dashboard → Scheduled backups
# Step 2: Place backup in recovery-backups/ directory
# Step 3: Run automated restoration
./scripts/restore-from-backup.sh

# OR manual steps:
# Start recovery database
docker-compose -f docker/recovery-docker-compose.yml up -d

# Restore backup
docker exec -i order-recovery-db pg_restore -U postgres -d recovery_db --clean --if-exists < recovery-backups/backup.dump

# Run extraction
docker cp scripts/extract-deleted-order.sql order-recovery-db:/tmp/
docker exec -i order-recovery-db psql -U postgres -d recovery_db -f /tmp/extract-deleted-order.sql > recovery-exports/recovered-order.json
```

## Order Identification

Before running extraction queries, update filters in `extract-deleted-order.sql` with known order details:

- **Price**: Update price range filters
- **Location**: Update `construction_site` filter
- **Products**: Update product type filters
- **Date**: Already set to Feb 3rd, 2026

## Output

All recovered data will be exported to:
- `recovery-exports/` directory
- JSON format (complete data)
- CSV format (human-readable)
- Summary report

## Important Notes

- ⚠️ **Do NOT restore production database** - Only extract data from restored snapshot
- ✅ **Preserve evidence** - Export recovered data before any modifications
- 📋 **Document process** - Keep records for legal purposes
- 🔒 **Access control** - Limit access to authorized personnel only

## Full Documentation

See `docs/recovery-procedure.md` for complete detailed instructions.
