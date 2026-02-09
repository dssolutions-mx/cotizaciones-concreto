# Order Recovery Setup - Complete ✅

## Summary

All recovery scripts and documentation have been created to help recover the deleted order from February 3rd, 2026. The setup is complete and ready for execution.

## Files Created

### Recovery Scripts
- ✅ `scripts/investigate-deleted-order.sql` - Investigation queries for current database
- ✅ `scripts/extract-deleted-order.sql` - Data extraction from restored snapshot
- ✅ `scripts/extract-order-data.ts` - TypeScript extraction with JSON/CSV export
- ✅ `scripts/recover-order-feb3.sh` - Automated recovery workflow
- ✅ `scripts/check-pitr-availability.sh` - PITR availability checker

### Docker Setup
- ✅ `docker/recovery-docker-compose.yml` - Local database restoration setup

### Documentation
- ✅ `docs/recovery-procedure.md` - Complete recovery procedure guide
- ✅ `scripts/RECOVERY_README.md` - Quick reference guide

### Directories Created
- ✅ `recovery-exports/` - For exported recovered data
- ✅ `recovery-backups/` - For backup files (if using Docker method)

## Next Steps (Manual Execution Required)

### Step 1: Investigate Current Database
```bash
# Check for related records that might still exist
psql <your_connection_string> -f scripts/investigate-deleted-order.sql
```

This will check:
- `order_notifications` table for any references
- `order_history` legacy table
- `quotes` that might have been converted to orders
- `remisiones` with missing order_id

### Step 2: Download Scheduled Backup

**⚠️ Note: PITR add-on is not available. Using scheduled backups instead.**

1. Go to: https://supabase.com/dashboard/project/pkjqznogflgbnwzkzmpg
2. Navigate to: **Database → Backups → Scheduled backups**
3. Find backup closest to **Feb 3rd, 2026** (before deletion)
   - Available backups show until: **Feb 4th at 21:56 PM (UTC-6)**
   - Look for backup from: **Feb 3rd or early Feb 4th** (before deletion occurred)
4. Download the backup file (.dump or .sql format)
5. Save it to: `recovery-backups/` directory

### Step 3: Restore Backup Locally

**Using Automated Script (Recommended):**
```bash
# Place downloaded backup in recovery-backups/ directory
# Then run:
./scripts/restore-from-backup.sh
```

**Manual Restoration:**
```bash
# Start recovery database
docker-compose -f docker/recovery-docker-compose.yml up -d

# Wait for database to be ready (about 5-10 seconds)
sleep 10

# Restore backup (.dump format)
docker exec -i order-recovery-db pg_restore -U postgres -d recovery_db --clean --if-exists < recovery-backups/backup.dump

# OR restore backup (.sql format)
docker exec -i order-recovery-db psql -U postgres -d recovery_db < recovery-backups/backup.sql
```

### Step 4: Update Extraction Filters

Before running extraction, update filters in `scripts/extract-deleted-order.sql` with known order details:

```sql
-- Update these filters based on known order information:
WHERE 
  o.delivery_date = '2026-02-03'::date
  -- AND o.construction_site ILIKE '%your_location%'
  -- AND o.total_amount BETWEEN min_price AND max_price
  -- Add product type filters if known
```

### Step 5: Extract Order Data

**Using SQL (Docker method):**
```bash
# Copy SQL file to container
docker cp scripts/extract-deleted-order.sql order-recovery-db:/tmp/

# Run extraction query
docker exec -i order-recovery-db psql -U postgres -d recovery_db -f /tmp/extract-deleted-order.sql > recovery-exports/recovered-order.json
```

**Using Direct Connection:**
If you have direct connection to restored database:
```bash
psql postgresql://postgres:recovery_password_change_me@localhost:5433/recovery_db -f scripts/extract-deleted-order.sql > recovery-exports/recovered-order.json
```

**Using TypeScript (requires connection string):**
1. Update connection details in `scripts/extract-order-data.ts`:
   ```typescript
   const RESTORED_DB_URL = 'postgresql://postgres:recovery_password_change_me@localhost:5433/recovery_db';
   const RESTORED_DB_KEY = 'not-needed-for-direct-connection';
   ```
2. Update `ORDER_FILTERS` with known order details
3. Run: `npx tsx scripts/extract-order-data.ts`

### Step 6: Verify and Export

1. **Verify Data**
   - Check that recovered order matches known details (price, location, products)
   - Verify all order_items are present
   - Check timestamps are correct

2. **Export Formats**
   - JSON: Complete data structure
   - CSV: Human-readable format
   - Summary report: Overview of recovered data

3. **Preserve Evidence**
   - Save all exports to `recovery-exports/` directory
   - Create backup copies
   - Document recovery process for legal purposes

## Important Reminders

- ⚠️ **Do NOT restore production database** - Only extract data from restored snapshot
- ✅ **Preserve evidence** - Export recovered data before any modifications
- 📋 **Document process** - Keep records of all steps taken
- 🔒 **Access control** - Limit access to authorized personnel only
- 🕐 **Time zone** - All dates use UTC-6 (Mexico time)

## Order Identification Details

Use these known details to identify the order:
- **Date**: February 3rd, 2026
- **Price**: [Update in extraction queries]
- **Location**: [Update in extraction queries]
- **Products**: [Update in extraction queries]
- **Issue**: Order was sold at different price than registered (fraud evidence)

## Troubleshooting

### Backup Not Available
- Check Supabase Dashboard → Database → Backups → Scheduled backups
- Verify backup retention period (backups available until Feb 4th at 21:56 PM UTC-6)
- If no backup available, check if backups are being created automatically
- Contact Supabase support if backups are missing

### Order Not Found
- Adjust filters in extraction queries
- Verify timezone handling (UTC-6)
- Check date range includes Feb 3rd
- Try broader search criteria

### Connection Issues
- Verify restored database connection string
- Check network/firewall settings
- Ensure Docker containers are running (if using local restoration)

## Support Resources

- **Recovery Procedure**: `docs/recovery-procedure.md`
- **Quick Reference**: `scripts/RECOVERY_README.md`
- **Supabase Docs**: https://supabase.com/docs/guides/database/backups

## Status

✅ **Setup Complete** - All scripts and documentation are ready
⏳ **Pending Manual Steps** - Requires access to Supabase Dashboard and execution of recovery steps

---

**Created**: $(date)
**Project**: cotizaciones-concreto
**Target Date**: February 3rd, 2026
