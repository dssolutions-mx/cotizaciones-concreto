# Connection Issue Fix

## Problem

The connection failed with: **"Network is unreachable"** - This is an IPv6 connectivity issue, not a password problem.

## Solution: Use Connection Pooler

The direct connection (port 5432) tries to use IPv6 which isn't reachable. Use the **Connection Pooler** (port 6543) instead.

### Step 1: Get Pooler Connection String

1. Go to: https://supabase.com/dashboard/project/pkjqznogflgbnwzkzmpg
2. Navigate to: **Project Settings → Database → Connection string**
3. Click on: **"Connection Pooling"** tab (NOT the "URI" tab)
4. Copy the connection string
5. Replace `[YOUR-PASSWORD]` with your actual password: `Jj2584410`

**Format should be:**
```
postgresql://postgres.pkjqznogflgbnwzkzmpg:Jj2584410@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Step 2: Run Recovery with Pooler

```bash
./scripts/recover-fixed-connection.sh
```

When prompted, paste the **pooler** connection string.

## Alternative: Use Supabase SQL Editor

If Docker connection still fails, you can run queries directly in Supabase:

1. Go to: Supabase Dashboard → SQL Editor
2. Copy and paste the contents of: `scripts/find-order-ORD-20260128-7243.sql`
3. Click "Run"
4. Review results for order_id or related records

## Why Pooler Works Better

- **Connection Pooler (port 6543)**: More reliable, handles IPv4/IPv6 better
- **Direct Connection (port 5432)**: Can have IPv6 issues, less stable

## Quick Test

Test the connection first:

```bash
./scripts/test-connection.sh
```

This will verify your connection string works before running the full recovery.
