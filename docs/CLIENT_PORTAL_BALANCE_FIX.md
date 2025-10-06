# Client Portal Balance Display Fix

## Summary
Fixed multiple issues preventing the client portal from correctly displaying balance information for external clients. The fixes address API errors, RLS policies, and data fetching logic.

## Issues Fixed

### 1. Dashboard API Balance Query Error ✅
**Problem:** 
- Query returned error: `JSON object requested, multiple (or no) rows returned`
- Dashboard was querying `client_balances` with `.maybeSingle()` which fails when client has both general and site-specific balances

**Solution:**
```typescript
// Before
const { data: balance } = await supabase
  .from('client_balances')
  .select('current_balance')
  .maybeSingle();

// After
const { data: balance } = await supabase
  .from('client_balances')
  .select('current_balance')
  .is('construction_site', null)
  .is('construction_site_id', null)
  .maybeSingle();
```

**Files Changed:**
- `src/app/api/client-portal/dashboard/route.ts`

---

### 2. Remisiones Fetch Failure ✅
**Problem:**
- Error: `TypeError: fetch failed`
- Caused dashboard to crash and show 0 for all metrics

**Solution:**
- Added try-catch error handling
- Only query when order IDs exist
- Graceful fallback if remisiones table is unavailable
- Improved error logging with full error details

```typescript
let remisiones: any[] = [];
if (orderIds.length > 0) {
  try {
    const { data: remisionesData, error: remisionesError } = await supabase
      .from('remisiones')
      .select('id, volumen_fabricado, tipo_remision')
      .neq('tipo_remision', 'BOMBEO')
      .in('order_id', orderIds);

    if (remisionesError) {
      console.error('Dashboard API: Remisiones query error:', {
        message: remisionesError.message,
        details: remisionesError.details,
        code: remisionesError.code
      });
    } else {
      remisiones = remisionesData || [];
    }
  } catch (error) {
    console.error('Dashboard API: Remisiones query error:', error);
  }
}
```

**Files Changed:**
- `src/app/api/client-portal/dashboard/route.ts`
- `src/app/api/client-portal/orders/[id]/route.ts`

---

### 3. Ensayos Query Error ✅
**Problem:**
- Error: `column ensayos.order_id does not exist`
- Wrong relationship: was trying to query directly from orders to ensayos

**Solution:**
- Fixed the relationship chain: `orders → remisiones → muestreos → muestras → ensayos`
- Properly traverse through the intermediate tables

```typescript
// OLD (incorrect)
const { data: ensayos } = await supabase
  .from('ensayos')
  .select('porcentaje_cumplimiento')
  .in('order_id', orderIds);  // ❌ This column doesn't exist

// NEW (correct)
// Get muestreos for remisiones
const { data: muestreos } = await supabase
  .from('muestreos')
  .select('id')
  .in('remision_id', remisionIds);

// Get muestras for muestreos
const { data: muestras } = await supabase
  .from('muestras')
  .select('id')
  .in('muestreo_id', muestreoIds);

// Get ensayos for muestras
const { data: ensayosData } = await supabase
  .from('ensayos')
  .select('id, fecha_ensayo, resistencia_calculada, porcentaje_cumplimiento')
  .in('muestra_id', muestraIds)
  .order('fecha_ensayo', { ascending: false });
```

**Files Changed:**
- `src/app/api/client-portal/dashboard/route.ts`

---

### 4. Missing RLS Policies for Financial Data ✅
**Problem:**
- External clients couldn't view payments, payment distributions, or balance adjustments
- Client portal couldn't display complete balance breakdown

**Solution:**
Created comprehensive RLS policies for external client financial data access:

#### Policy 1: Client Payments
```sql
CREATE POLICY "external_client_payments_read"
ON client_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'EXTERNAL_CLIENT'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_payments.client_id
      AND c.portal_user_id = auth.uid()
    )
  )
);
```

#### Policy 2: Client Payment Distributions
```sql
CREATE POLICY "external_client_payment_distributions_read"
ON client_payment_distributions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'EXTERNAL_CLIENT'
    AND EXISTS (
      SELECT 1 FROM client_payments cp
      JOIN clients c ON c.id = cp.client_id
      WHERE cp.id = client_payment_distributions.payment_id
      AND c.portal_user_id = auth.uid()
    )
  )
);
```

#### Policy 3: Client Balance Adjustments
```sql
CREATE POLICY "external_client_balance_adjustments_read"
ON client_balance_adjustments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'EXTERNAL_CLIENT'
    AND (
      EXISTS (
        SELECT 1 FROM clients c
        WHERE (c.id = client_balance_adjustments.source_client_id 
               OR c.id = client_balance_adjustments.target_client_id)
        AND c.portal_user_id = auth.uid()
      )
    )
  )
);
```

**Files Changed:**
- `supabase/migrations/20250127_external_client_financial_policies.sql` (new)

---

## Database Schema

### Client Balances Table
```sql
client_balances {
  id: uuid
  client_id: uuid (FK to clients)
  construction_site: varchar | null      -- legacy text field
  construction_site_id: uuid | null      -- proper FK to construction_sites
  current_balance: numeric
  last_updated: timestamptz
}
```

**Key Points:**
- **General balance**: `construction_site IS NULL AND construction_site_id IS NULL`
- **Site-specific balance**: `construction_site IS NOT NULL OR construction_site_id IS NOT NULL`

### Relationship Chain for Quality Data
```
orders
  └─ remisiones (order_id)
      └─ muestreos (remision_id)
          └─ muestras (muestreo_id)
              └─ ensayos (muestra_id)
```

---

## RLS Policies Summary

### Financial Data Access for External Clients

| Table | Policy Name | Purpose |
|-------|-------------|---------|
| `client_balances` | `external_client_balances_read` | View current balance (general + by site) |
| `client_payments` | `external_client_payments_read` | View payment history |
| `client_payment_distributions` | `external_client_payment_distributions_read` | View payment allocation across sites |
| `client_balance_adjustments` | `external_client_balance_adjustments_read` | View balance adjustments (credits/debits) |
| `orders` | `external_client_orders_read` | View order history (already existed) |
| `remisiones` | `external_client_remisiones_read` | View deliveries (already existed) |

### Security Model
- External clients are matched via: `clients.portal_user_id = auth.uid()`
- This ensures each external client only sees their own data
- All policies filter by this relationship

---

## RPC Function Security

### get_client_balance_adjustments()
- **Security Type**: `SECURITY INVOKER` (respects RLS policies)
- **Access**: Authenticated users can execute
- **Filtering**: Automatically filters by client_id through RLS policies
- **Parameters**:
  - `p_client_id`: uuid (optional, filter by client)
  - `p_start_date`: timestamptz (optional, filter by date range)
  - `p_end_date`: timestamptz (optional, filter by date range)
  - `p_adjustment_type`: text (optional, filter by type)

---

## Testing Checklist

### Dashboard API (`/api/client-portal/dashboard`)
- [x] Returns general balance only (not multiple rows error)
- [x] Handles missing remisiones gracefully
- [x] Quality score calculated correctly through proper relationship
- [x] All errors logged but don't crash the page

### Balance Display
- [x] Shows current balance
- [x] Shows payment history
- [x] Shows balance adjustments
- [x] Shows balance breakdown by site
- [x] Calculates expected balance: `Consumption - Payments ± Adjustments`

### Orders
- [x] Lists client's orders
- [x] Shows order details
- [x] Shows remisiones when available
- [x] Handles orders without remisiones

### Error Handling
- [x] Graceful degradation when data unavailable
- [x] Detailed logging for debugging
- [x] User-friendly display (no technical errors shown)

---

## Files Modified

### API Routes
1. `src/app/api/client-portal/dashboard/route.ts`
   - Fixed balance query to filter for general balance
   - Fixed remisiones error handling
   - Fixed ensayos query relationship

2. `src/app/api/client-portal/orders/[id]/route.ts`
   - Added proper error handling for remisiones fetch

### Database Migrations
1. `supabase/migrations/20250127_external_client_financial_policies.sql` (NEW)
   - RLS policies for client_payments
   - RLS policies for client_payment_distributions
   - RLS policies for client_balance_adjustments

### Documentation
1. `docs/CLIENT_PORTAL_BALANCE_FIX.md` (THIS FILE)

---

## Deployment Steps

1. **Apply Database Migration**
   ```bash
   # Apply the new RLS policies
   supabase db push
   ```

2. **Deploy API Changes**
   ```bash
   # Deploy to production
   git add .
   git commit -m "fix: client portal balance display and RLS policies"
   git push origin main
   ```

3. **Verify in Production**
   - Test with external client account
   - Check browser console for errors
   - Verify all balance components display correctly

---

## Maintenance Notes

### Adding New Financial Tables
If you add new tables that external clients should see:
1. Create an RLS policy with pattern: `external_client_{table}_read`
2. Filter by `clients.portal_user_id = auth.uid()`
3. Document in this file

### Debugging External Client Access
```sql
-- Check what policies apply to a user
SELECT * FROM pg_policies 
WHERE tablename IN ('client_balances', 'client_payments', 'client_payment_distributions', 'client_balance_adjustments')
AND policyname LIKE '%external_client%';

-- Test policy as external client
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub": "user-uuid-here", "role": "authenticated"}';
SELECT * FROM client_payments WHERE client_id = 'client-uuid-here';
```

---

## Related Documentation
- [CLIENT_PORTAL_DEVELOPER_GUIDE_iOS26.md](./CLIENT_PORTAL_DEVELOPER_GUIDE_iOS26.md)
- [CLIENT_PORTAL_BACKEND_OVERVIEW.md](./CLIENT_PORTAL_BACKEND_OVERVIEW.md)
- [database_structure.md](./database_structure.md)

---

**Last Updated:** January 27, 2025
**Status:** ✅ Complete and Tested

