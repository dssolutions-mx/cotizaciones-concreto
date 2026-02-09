# Database Recovery Procedure: Deleted Order from February 3rd, 2026

## Overview

This document outlines the procedure to recover a deleted order and its order_items from February 3rd, 2026. The order was deleted between Feb 3rd and Feb 4th morning, and we need to extract it as evidence of fraudulent activity.

## Prerequisites

- Supabase Pro plan (provides Point-in-Time Recovery with 7 days history)
- Access to Supabase Dashboard
- Supabase CLI installed (optional, for local recovery)
- Docker installed (optional, for local database restoration)

## Recovery Methods

### Method 1: Scheduled Backup Restoration (Primary Method)

**⚠️ Note: PITR add-on is not available. Using scheduled backups instead.**

Supabase creates scheduled backups that can be downloaded and restored locally.

#### Steps:

1. **Access Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/pkjqznogflgbnwzkzmpg
   - Navigate to: **Database → Backups → Scheduled backups**

2. **Download Backup**
   - Find the backup closest to **February 3rd, 2026** (before deletion)
   - Available backups show until: **Feb 4th at 21:56 PM (UTC-6)**
   - Look for backup from: **Feb 3rd or early Feb 4th** (before deletion occurred)
   - Download the backup file (.dump or .sql format)
   - Save to `recovery-backups/` directory

3. **Restore Backup Locally**
   ```bash
   # Use automated script
   ./scripts/restore-from-backup.sh
   
   # OR manually:
   docker-compose -f docker/recovery-docker-compose.yml up -d
   docker exec -i order-recovery-db pg_restore -U postgres -d recovery_db --clean --if-exists < recovery-backups/backup.dump
   ```

4. **Extract Order Data**
   - Connect to restored database (localhost:5433)
   - Run extraction query: `scripts/extract-deleted-order.sql`
   - Adjust filters based on known order details

5. **Export Data**
   - Export results to JSON/CSV
   - Save to `recovery-exports/` directory
   - Verify data matches known order details

### Method 2: Manual Backup Restoration (Alternative)

If PITR is not available, use a manual backup from Supabase Dashboard.

#### Steps:

1. **Download Backup**
   - Go to: **Database → Backups**
   - Download the backup closest to Feb 3rd (before deletion)
   - Available backups show until Feb 4th at 21:56 PM (UTC-6)

2. **Restore Locally Using Docker**
   ```bash
   # Start recovery database
   docker-compose -f docker/recovery-docker-compose.yml up -d
   
   # Copy backup to recovery-backups directory
   cp downloaded-backup.dump ./recovery-backups/
   
   # Restore backup
   docker exec -i order-recovery-db pg_restore -U postgres -d recovery_db < ./recovery-backups/backup.dump
   ```

3. **Extract Order Data**
   ```bash
   # Run extraction query
   docker exec -i order-recovery-db psql -U postgres -d recovery_db -f /backups/extract-deleted-order.sql
   ```

## Investigation Queries

Before full recovery, check if any related records still exist in the current database:

```bash
# Run investigation queries
psql <connection_string> -f scripts/investigate-deleted-order.sql
```

This checks:
- `order_notifications` - May have order_id references
- `order_history` - Legacy table with historical data
- `quotes` - If order was created from a quote
- `remisiones` - Should have blocked deletion if they existed

## Order Identification

Use the following known details to identify the order:

- **Date**: February 3rd, 2026
- **Price**: [Known price - update in queries]
- **Location**: [Known location - update in queries]
- **Products**: [Known product types - update in queries]
- **Issue**: Order was sold at different price than registered (fraud evidence)

## Extraction Scripts

### 1. Investigation Script
**File**: `scripts/investigate-deleted-order.sql`
- Checks related tables for traces of deleted order
- Run on current production database

### 2. Extraction Script
**File**: `scripts/extract-deleted-order.sql`
- Extracts complete order data with all related information
- Run on restored database snapshot
- Adjust filters based on known order details

### 3. TypeScript Extraction
**File**: `scripts/extract-order-data.ts`
- Programmatic extraction with export to JSON/CSV
- Requires restored database connection details
- Run: `npx tsx scripts/extract-order-data.ts`

### 4. Recovery Shell Script
**File**: `scripts/recover-order-feb3.sh`
- Automated recovery workflow
- Sets up recovery environment
- Provides step-by-step instructions

## Data Export Format

Recovered data includes:

- **Order**: Complete order record with all fields
- **Client**: Client information
- **Order Items**: All order_items associated with the order
- **Order Notifications**: Any notifications sent
- **Site Validation**: Site access validation data (if exists)
- **Quote**: Original quote (if order was created from quote)
- **Created By User**: User who created the order

## Verification Steps

1. **Match Known Details**
   - Verify price matches known price
   - Verify location matches known location
   - Verify products match known products

2. **Check Completeness**
   - All order_items are present
   - All related data is included
   - Timestamps are correct

3. **Export for Evidence**
   - Export to JSON (complete data)
   - Export to CSV (human-readable)
   - Create summary report

## Re-insertion (Optional)

**⚠️ WARNING**: Only re-insert if you want to restore the order to production. Otherwise, just export as evidence.

If re-inserting:

1. Generate new UUIDs for order and order_items
2. Preserve original timestamps
3. Set `created_by` to original user
4. Add audit note explaining restoration
5. Insert into production database

## Security Considerations

- **Do NOT restore production database** - Only extract data from restored snapshot
- **Preserve evidence** - Export recovered data before any modifications
- **Document process** - Keep records of recovery steps for legal purposes
- **Access control** - Limit access to recovery process to authorized personnel only

## Troubleshooting

### Backup Not Available
- Check Supabase Dashboard → Database → Backups → Scheduled backups
- Verify backup retention period (backups available until Feb 4th at 21:56 PM UTC-6)
- If no backup available, check if backups are being created automatically
- Contact Supabase support if backups are missing

### PITR Add-on Not Available
- **This is expected** - PITR requires a paid add-on
- Use scheduled backups instead (Method 1 above)
- Scheduled backups are sufficient for recovery if taken before deletion

### Order Not Found
- Adjust filters in extraction queries
- Check timezone handling (UTC-6)
- Verify date range includes Feb 3rd

### Connection Issues
- Verify restored database connection string
- Check network/firewall settings
- Ensure Docker containers are running (if using local restoration)

## Files Created

- `scripts/investigate-deleted-order.sql` - Investigation queries
- `scripts/extract-deleted-order.sql` - Data extraction queries
- `scripts/extract-order-data.ts` - TypeScript extraction script
- `scripts/recover-order-feb3.sh` - Recovery automation script
- `docker/recovery-docker-compose.yml` - Docker setup for local restoration
- `docs/recovery-procedure.md` - This document

## Next Steps

1. ✅ Run investigation queries to check for related records
2. ✅ Access Supabase Dashboard and check PITR availability
3. ✅ Restore database snapshot to Feb 3rd, 2026
4. ✅ Extract order data using provided scripts
5. ✅ Verify and export recovered data
6. ✅ Preserve evidence for investigation

## Support

For issues or questions:
- Check Supabase documentation: https://supabase.com/docs/guides/database/backups
- Review recovery scripts for detailed comments
- Contact database administrator if needed
