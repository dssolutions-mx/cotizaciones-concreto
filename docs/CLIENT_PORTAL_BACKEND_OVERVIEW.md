# Client Portal Backend Overview

This document summarizes the backend changes required to support the external client portal described in `CLIENT_PORTAL_DEVELOPER_GUIDE_iOS26.md`. Use it as the single reference for provisioning portal users, understanding data segregation, and coordinating with frontend and security workstreams.

---

## 1. New Data Model Elements

- **`user_profiles.role` constraint update**
  - Added `EXTERNAL_CLIENT` to the allowed roles list.
  - Ensures portal-only users can exist without impacting legacy authorization logic.
- **`clients.portal_user_id` column**
  - Type `uuid`, references `public.user_profiles(id)` with `ON DELETE SET NULL`.
  - Links each client record to the portal user that represents them.
  - Indexed via `idx_clients_portal_user` for fast lookup.
- **`clients.is_portal_enabled` flag**
  - Default `false`; use this to control rollouts per client.
  - RLS logic verifies both linkage and flag.

### Provisioning Checklist

1. Create a `user_profiles` record (and Supabase auth user) with `role = 'EXTERNAL_CLIENT'`.
2. Update the corresponding `clients` row:
   - Set `portal_user_id` to the new profile id.
   - Set `is_portal_enabled = true`.
3. Share portal credentials with the client. External user access is scoped entirely by RLS (see below).

---

## 2. Helper Functions (Supabase SQL)

Two SECURITY DEFINER helpers were introduced to power RLS conditions:

```sql
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT c.id
  FROM public.clients c
  WHERE c.portal_user_id = auth.uid()
    AND c.is_portal_enabled = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_external_client()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'EXTERNAL_CLIENT'
  );
$$;
```

**Key Notes**
- Both functions run on the `public` schema and never expose other clients’ data.
- `get_user_client_id()` returns `NULL` for internal users or disabled portal accounts.
- Frontend services can rely on existing Supabase JS client calls; these functions are only used server-side in policies.

---

## 3. Row-Level Security Matrix

| Table | Policy | Access Granted |
|-------|--------|----------------|
| `orders` | `external_client_orders_read` | Portal user reads own orders via `client_id` match. |
| `remisiones` | `external_client_remisiones_read` | Delivery tickets tied to their orders. |
| `client_balances` | `external_client_balances_read` | Balance summary for the linked client. |
| `muestreos` | `external_client_muestreos_read` | Sampling records only for remisiones belonging to the client. |
| `muestras` | `external_client_muestras_read` | Lab samples that originate from the client's muestreos. |
| `ensayos` | `external_client_ensayos_read` | Test results derived from the client’s samples. |
| `recipes` | `external_client_recipes_read` | Recipe metadata referenced by delivered remisiones. |
| `material_quantities` | `material_quantities_hierarchical_access` (updated) | External clients blocked; internal hierarchical access unchanged. |

### Adjustments to Existing Policies

- The generic `SELECT` policies on `muestreos`, `muestras`, and `ensayos` now exclude external clients; their access is fully controlled by the new portal-specific policies.
- Internal hierarchy logic (executive, plant manager, etc.) remains untouched.
- Material composition data (`material_quantities`) explicitly denies external clients even if other policies apply.

---

## 4. Frontend & Service Contract

### Auth Expectations
- Portal routes must verify `profile.role === 'EXTERNAL_CLIENT'` before rendering content (already scaffolded in `ClientPortalGuard`).
- Logging out should revoke the Supabase session normally; no extra backend steps required.

### Data Fetching Tips
- All Supabase queries for portal views can use simple `.from('<table>').select(...)` calls—RLS handles scoping.
- Prefer `count` or aggregate queries directly where possible (orders count, volume totals, etc.) to minimize client-side filtering.
- For rendimiento volumétrico calculations, rely on `remisiones` and `ensayos` data returned through RLS or request backend aggregates if performance becomes an issue.

---

## 5. Testing & Validation

### Scenarios to Cover
1. **Positive access**: External client sees only their own orders, remisiones, balances, quality data.
2. **Cross-client isolation**: A second external client cannot view data belonging to the first.
3. **Material compositions blocked**: Attempting to read `material_quantities` as external client should return empty set or error.
4. **Disabled portal**: If `is_portal_enabled = false`, the user receives zero rows everywhere.

### Tools
- Use Supabase key rotation or service-role tokens (not anon) to seed test users quickly.
- Automated tests can extend the existing security test suite (see `/tests/security/rls-policies.test.ts`).

---

## 6. Operational Guidance

- **Backfills**: Coordinate with Customer Success to identify clients for rollout. Run SQL updates to link portal users and flip the enable flag.
- **Incident Response**: If unexpected exposure occurs, set `is_portal_enabled = false` immediately; this cuts off all portal access while preserving data.
- **Future Enhancements**: Consider per-client branding, additional aggregates, or granular permissions (e.g., show/hide balance) by extending the helper functions and policies.

---

## 7. Reference SQL Snippets

### Enable Portal for an Existing Client

```sql
-- Replace placeholders with actual values
WITH new_user AS (
  SELECT id FROM public.user_profiles WHERE email = 'client.user@example.com'
)
UPDATE public.clients
SET portal_user_id = new_user.id,
    is_portal_enabled = true
FROM new_user
WHERE clients.id = '00000000-0000-0000-0000-000000000000';
```

### Disable Portal Access Temporarily

```sql
UPDATE public.clients
SET is_portal_enabled = false
WHERE id = '00000000-0000-0000-0000-000000000000';
```

---

## 8. Cross-Team Coordination

- **Frontend (Team B)**: Implement dashboard/order/quality pages using the new endpoints; format numbers with commas for thousands as per team preference.
- **Security (Team A2 / D1)**: Extend automated tests and run manual penetration checks focusing on RLS bypass attempts.
- **Support & Ops**: Prepare client onboarding scripts and documentation referencing this file.

For questions or edge cases, ping Team A (Backend & Security) in the shared channel.







