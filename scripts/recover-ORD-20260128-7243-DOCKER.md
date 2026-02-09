# Docker Recovery Guide for ORD-20260128-7243

## Situation
- **Order Number**: ORD-20260128-7243
- **Issue**: Order was deleted, backups don't appear in dashboard
- **Solution**: Use Docker to connect directly to production database and recover

## Method 1: Direct Database Connection (Recommended)

Since backups aren't available in dashboard, we'll connect directly to production database to find traces.

### Step 1: Get Database Connection String

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/pkjqznogflgbnwzkzmpg
2. Navigate to: **Project Settings → Database → Connection string**
3. Copy the **URI** connection string
4. Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

### Step 2: Search for Order Traces

```bash
# Option A: Using direct psql connection
psql "<connection_string>" -f scripts/find-order-ORD-20260128-7243.sql > recovery-exports/traces.txt

# Option B: Using Docker with psql
docker run -it --rm postgres:15 psql "<connection_string>" -f - < scripts/find-order-ORD-20260128-7243.sql > recovery-exports/traces.txt
```

### Step 3: Review Traces

Check `recovery-exports/traces.txt` for:
- `order_id` (UUID) if found in `order_notifications`
- Related records in `order_history`, `quotes`, `remisiones`
- Any references that can help identify the order

### Step 4: Reconstruct Order (if order_id found)

If we find the `order_id` from traces:

```bash
# Create reconstruction query
cat > scripts/reconstruct-order.sql << 'EOF'
-- Reconstruct order ORD-20260128-7243 from traces
-- Replace <ORDER_ID> with the UUID found in traces

-- Get order details from notifications
SELECT 
  'From order_notifications' as source,
  onot.*,
  'Order was referenced in notifications' as note
FROM order_notifications onot
WHERE onot.order_id = '<ORDER_ID>';

-- Get quote details if order was created from quote
SELECT 
  'From quote' as source,
  q.*,
  o.order_number
FROM quotes q
JOIN orders o ON o.quote_id = q.id
WHERE o.id = '<ORDER_ID>';
EOF

# Run reconstruction
psql "<connection_string>" -f scripts/reconstruct-order.sql > recovery-exports/reconstructed-order.txt
```

## Method 2: Create Current Database Dump and Search

If direct connection doesn't work, create a dump of current database:

### Step 1: Create Database Dump

```bash
# Using Supabase CLI (if available)
supabase db dump --project-ref pkjqznogflgbnwzkzmpg -f recovery-backups/current-dump.sql

# OR using pg_dump directly
pg_dump "<connection_string>" -f recovery-backups/current-dump.sql
```

### Step 2: Restore Locally and Search

```bash
# Start recovery database
docker-compose -f docker/recovery-docker-compose.yml up -d

# Wait for database to be ready
sleep 10

# Restore dump
docker exec -i order-recovery-db psql -U postgres -d recovery_db < recovery-backups/current-dump.sql

# Search for order traces
docker cp scripts/find-order-ORD-20260128-7243.sql order-recovery-db:/tmp/
docker exec -i order-recovery-db psql -U postgres -d recovery_db -f /tmp/find-order-ORD-20260128-7243.sql > recovery-exports/traces.txt
```

### Step 3: Extract Order (if found in dump)

```bash
# Extract order data
docker cp scripts/extract-order-ORD-20260128-7243.sql order-recovery-db:/tmp/
docker exec -i order-recovery-db psql -U postgres -d recovery_db -f /tmp/extract-order-ORD-20260128-7243.sql > recovery-exports/recovered-order.json
```

## Method 3: Contact Supabase Support

If backups are truly not accessible:

1. Contact Supabase support: https://supabase.com/support
2. Request access to backups from Jan 28 - Feb 3, 2026
3. Explain the situation (deleted order, evidence needed)
4. They may be able to provide backup access or restore from their archives

## Quick Start (Automated)

```bash
# Run the direct recovery script
./scripts/recover-order-direct.sh

# Follow prompts to:
# 1. Enter database connection string
# 2. Search for order traces
# 3. Review results
# 4. Reconstruct order if possible
```

## Expected Results

After running investigation queries, you should find:

1. **order_notifications** - May contain order_id and details
2. **order_history** - Legacy table may have order record
3. **quotes** - If order was created from quote, quote details exist
4. **remisiones** - If order had remisiones, they may still reference order_id

## If Order Found

Once order_id is identified:

1. Extract complete order data using `extract-order-ORD-20260128-7243.sql`
2. Export to JSON/CSV for evidence
3. Document recovery process
4. Preserve as evidence

## Troubleshooting

### Connection Issues
- Verify connection string format
- Check if IP whitelisting is required in Supabase
- Try connection pooler port (6543) vs direct port (5432)

### No Traces Found
- Order may have been deleted before any notifications were sent
- Check Supabase logs for deletion timestamp
- Contact Supabase support for backup access

### Permission Issues
- Ensure connection string uses service_role key (not anon key)
- Check database user permissions
- Verify RLS policies allow access
