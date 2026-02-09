# Using pg_dump for Recovery

## Important Limitation

**`pg_dump` only dumps the CURRENT database state.** It cannot recover deleted data from the past.

## What pg_dump CAN Do

### 1. Dump Current Database State
Useful for:
- Creating a backup of current state (for comparison)
- Documenting what exists now
- Creating a baseline

**Script:** `scripts/pg_dump-current-state.sh`

```bash
./scripts/pg_dump-current-state.sh
```

This creates: `recovery-backups/current-state-[timestamp].dump`

⚠️ **Note:** This dump will NOT contain the deleted order `ORD-20260128-7243`.

### 2. Dump from a Restored Backup
If you've restored a backup from Feb 3rd to a local Docker database, you can use pg_dump on that restored database.

**Script:** `scripts/pg_dump-from-backup.sh`

**Prerequisites:**
1. Download backup from Supabase Dashboard (Feb 3rd)
2. Restore it using: `./scripts/download-and-restore-backup.sh`
3. Then run: `./scripts/pg_dump-from-backup.sh`

This will:
- Check if order exists in restored database
- Create a dump of order-related tables
- Extract order data to SQL format

## Workflow

### Option A: Get Backup from Supabase (Recommended)

```
1. Download backup from Dashboard (Feb 3rd)
   ↓
2. Restore backup locally
   ./scripts/download-and-restore-backup.sh
   ↓
3. Extract order data
   ./scripts/pg_dump-from-backup.sh
```

### Option B: Dump Current State (For Comparison)

```
1. Create dump of current state
   ./scripts/pg_dump-current-state.sh
   ↓
2. Compare with restored backup
   (Manual comparison needed)
```

## Why pg_dump Can't Recover Deleted Data

`pg_dump` connects to a live database and exports what currently exists. It doesn't have access to:
- Historical data
- Deleted records
- Point-in-time snapshots

To recover deleted data, you need:
1. **A backup from before deletion** (from Supabase Dashboard)
2. **Restore that backup** (to local Docker)
3. **Then use pg_dump** on the restored backup

## Direct Connection Limitations

Even if we connect directly to Supabase production database:
- `pg_dump` will only see current state
- The deleted order is gone
- No way to recover without a backup

## Solution

The only way to recover the deleted order is:

1. **Get backup from Supabase Dashboard** (Feb 3rd, before deletion)
2. **Restore it locally** using Docker
3. **Extract the order** from the restored backup

Once you have the backup file, the scripts will handle everything else!
