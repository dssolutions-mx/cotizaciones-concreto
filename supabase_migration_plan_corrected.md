# Supabase Backend Configuration - CORRECTED Implementation Plan

## ⚠️ CRITICAL CORRECTIONS APPLIED

This document contains the **corrected and production-ready** migration plan for implementing multi-user client portal with internal approval workflows. **Critical issues from the original plan have been fixed.**

### Summary of Critical Corrections:
1. ✅ **RLS Policy Conflicts Resolved** - Old policies properly dropped before creating new ones
2. ✅ **SECURITY DEFINER Functions** - Proper role setup to prevent infinite recursion
3. ✅ **Trigger Execution Order** - Renamed triggers to ensure proper execution sequence
4. ✅ **Fail-Fast Validation** - Pre-migration checks now abort on errors
5. ✅ **Error Handling** - Added NULL safety in trigger logic
6. ✅ **Function Optimization** - Preserved PARALLEL SAFE where possible
7. ✅ **Backups Removed** - Supabase handles automatic backups, manual scripts removed
8. ✅ **Credit Validation Integration** - Webhooks updated to respect client approval workflow

---

## Overview

This document provides **production-ready SQL scripts** for implementing the multi-user client portal with internal approval workflows. All scripts are designed to be executed in order, with validation steps and rollback procedures.

---

## Order Approval Workflow with Credit Validation

The new system implements a two-stage approval process:

### Workflow Stages:

1. **Client Internal Approval** (if required)
   - Non-executive portal users create orders with `client_approval_status = 'pending_client'`
   - Client executives review and approve/reject orders
   - Credit validators are NOT notified yet

2. **Credit Validation** (existing process)
   - After client approval (or if client approval not required), orders enter credit validation
   - Credit validators receive webhook notifications
   - Existing credit validation logic continues to work

### Decision Flow:

```
Order Created by Portal User
    │
    ├─→ Executive User?
    │   └─→ YES: client_approval_status = 'not_required' → Credit Validation ✅
    │
    └─→ Non-Executive User?
        │
        ├─→ Client requires_internal_approval = false?
        │   └─→ YES: client_approval_status = 'not_required' → Credit Validation ✅
        │
        └─→ Client requires_internal_approval = true?
            └─→ YES: client_approval_status = 'pending_client' → Waits for Executive ⏸️
                     │
                     └─→ Executive Approves → Credit Validation ✅
```

### Credit Validation Webhook Integration:

- **Triggers Credit Validation ONLY when:**
  - `client_approval_status = 'not_required'` (order doesn't need client approval)
  - `client_approval_status = 'approved_by_client'` (client executive approved)

- **Does NOT trigger when:**
  - `client_approval_status = 'pending_client'` (waiting for client executive)
  - `client_approval_status = 'rejected_by_client'` (client executive rejected)

This ensures credit validators only see orders that have passed client-side approval (if required).

---

## Migration Execution Strategy

**Execution Order:**
1. **Phase 0:** Pre-migration validation (Supabase handles backups automatically)
2. **Phase 1:** Schema changes (tables, columns)
3. **Phase 2:** Helper functions (with proper role setup)
4. **Phase 3:** Triggers (with corrected naming + credit validation integration)
5. **Phase 4:** RLS policies (old policies dropped first)
6. **Phase 5:** Indexes & performance optimization
7. **Phase 6:** Data migration
8. **Phase 7:** Post-migration validation

**Estimated Total Execution Time:** 5-10 minutes  
**Recommended Execution Window:** Off-peak hours

> **Note on Backups:** Supabase performs automatic backups. Manual backup scripts removed to simplify execution. You can restore from Supabase dashboard if needed.

---

## PHASE 0: Pre-Migration Validation

### Step 0.1: Validate Current State

```sql
-- Validate current state
SELECT 
  COUNT(*) as total_clients,
  COUNT(portal_user_id) as clients_with_portal,
  COUNT(CASE WHEN is_portal_enabled = true THEN 1 END) as portal_enabled
FROM clients;

-- ✅ CORRECTED: Now aborts migration if orphaned references found
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Check for orphaned portal_user_id references
  SELECT COUNT(*) INTO orphan_count
  FROM clients c
  LEFT JOIN user_profiles up ON up.id = c.portal_user_id
  WHERE c.portal_user_id IS NOT NULL
    AND up.id IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: Found % clients with invalid portal_user_id references. Clean up required before proceeding.', orphan_count;
  END IF;
  
  RAISE NOTICE 'Pre-migration validation passed: No orphaned references found.';
END $$;
```

### Step 0.2: Verify Credit Validation Webhooks

```sql
-- Check that credit validation webhook functions exist
-- These will be updated to work with the new client approval flow
SELECT 
    p.proname as function_name,
    'EXISTS ✅' as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'handle_credit_validation_webhook_insert',
    'handle_credit_validation_webhook_update'
)
ORDER BY p.proname;

-- Should return 2 rows - if not, credit validation notifications may not work after migration
```

---

## PHASE 1: Schema Changes

### Step 1.1: Create `client_portal_users` Junction Table

```sql
-- Create the main junction table for multi-user support
CREATE TABLE IF NOT EXISTS client_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Role within this specific client organization
  role_within_client TEXT NOT NULL CHECK (role_within_client IN ('executive', 'user')),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Permissions (JSONB for flexibility)
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Audit fields
  invited_by UUID REFERENCES user_profiles(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure a user can only be linked once per client
  CONSTRAINT unique_client_user UNIQUE (client_id, user_id)
);

-- Add table comment
COMMENT ON TABLE client_portal_users IS 
  'Junction table linking clients to multiple portal users with role-based access control. Supports multi-user client portal functionality.';

-- Add column comments
COMMENT ON COLUMN client_portal_users.role_within_client IS 
  'Role of user within this client organization: executive (full access) or user (configurable permissions)';
COMMENT ON COLUMN client_portal_users.permissions IS 
  'JSONB object storing granular permissions. Executives automatically get all permissions. Example: {"create_orders": true, "view_quotes": false}';
COMMENT ON COLUMN client_portal_users.is_active IS 
  'Soft delete flag. Deactivated users retain history but lose access.';
```

### Step 1.2: Modify `clients` Table

```sql
-- Add new columns to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS requires_internal_approval BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS default_permissions JSONB NOT NULL DEFAULT '{
  "create_orders": true,
  "view_orders": true,
  "create_quotes": false,
  "view_quotes": true,
  "view_materials": true,
  "view_quality_data": false
}'::jsonb;

-- Update existing column comment
COMMENT ON COLUMN clients.portal_user_id IS 
  'DEPRECATED: Legacy single-user portal access. Use client_portal_users table instead. Maintained for backward compatibility during migration period.';

COMMENT ON COLUMN clients.requires_internal_approval IS 
  'When true, orders created by non-executive portal users require executive approval before reaching internal credit validation.';

COMMENT ON COLUMN clients.default_permissions IS 
  'Default permission set applied to new non-executive users. Can be overridden per user in client_portal_users.permissions.';
```

### Step 1.3: Modify `orders` Table

```sql
-- Add client approval workflow columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS client_approval_status TEXT 
  CHECK (client_approval_status IN ('not_required', 'pending_client', 'approved_by_client', 'rejected_by_client'))
  DEFAULT 'not_required',
ADD COLUMN IF NOT EXISTS client_approved_by UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS client_approval_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS client_rejection_reason TEXT;

-- Add column comments
COMMENT ON COLUMN orders.client_approval_status IS 
  'Internal client approval status. Orders from non-executive users may require executive approval before credit validation.';
COMMENT ON COLUMN orders.client_approved_by IS 
  'User ID of the client executive who approved this order (if applicable).';
COMMENT ON COLUMN orders.client_approval_date IS 
  'Timestamp when the order was approved by client executive.';
COMMENT ON COLUMN orders.client_rejection_reason IS 
  'Reason provided by client executive for rejecting the order.';

-- Add index for filtering by client approval status
CREATE INDEX IF NOT EXISTS idx_orders_client_approval_status 
  ON orders(client_approval_status) 
  WHERE client_approval_status != 'not_required';
```

### Step 1.4: Modify `user_profiles` Table

```sql
-- Add flag to distinguish portal users
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_portal_user BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_profiles.is_portal_user IS 
  'True if user accesses system via client portal (EXTERNAL_CLIENT role). Helps differentiate from internal staff.';

-- Update existing portal users
UPDATE user_profiles
SET is_portal_user = true
WHERE role = 'EXTERNAL_CLIENT';
```

### Step 1.5: Create `order_approval_history` Table (Optional - For Audit Trail)

```sql
-- Optional: Detailed audit trail for order approvals
CREATE TABLE IF NOT EXISTS order_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Who took the action
  actioned_by UUID NOT NULL REFERENCES user_profiles(id),
  
  -- What action was taken
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'cancelled')),
  
  -- Approval stage
  approval_stage TEXT NOT NULL CHECK (approval_stage IN ('client_internal', 'credit_validation', 'management')),
  
  -- Additional context
  notes TEXT,
  rejection_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_approval_history_order 
  ON order_approval_history(order_id);

CREATE INDEX idx_order_approval_history_stage 
  ON order_approval_history(approval_stage, created_at DESC);

COMMENT ON TABLE order_approval_history IS 
  'Audit trail for all approval actions on orders. Tracks client internal approvals and credit validation flow.';
```

---

## PHASE 2: Helper Functions (✅ CORRECTED - Proper Role Setup)

### ⚠️ CRITICAL: Set Role Before Creating Functions

```sql
-- ✅ CORRECTED: Set role to ensure BYPASSRLS privilege for SECURITY DEFINER functions
-- This prevents infinite recursion when functions are called from RLS policies
SET ROLE postgres; -- or SET ROLE service_role;
```

### Step 2.1: Check if User is Executive for Client

```sql
-- CRITICAL: This function MUST be SECURITY DEFINER and created by postgres/service_role
-- to avoid infinite recursion when called from RLS policies on client_portal_users
CREATE OR REPLACE FUNCTION is_client_executive(
  p_user_id UUID,
  p_client_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- ⚠️ REQUIRED: Bypasses RLS to prevent infinite recursion
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM client_portal_users 
    WHERE user_id = p_user_id 
      AND client_id = p_client_id 
      AND role_within_client = 'executive'
      AND is_active = true
  );
END;
$$;

COMMENT ON FUNCTION is_client_executive IS 
  'Returns true if the specified user has executive role for the specified client organization. SECURITY DEFINER to bypass RLS.';
```

### Step 2.2: Get User's Permissions for Client

```sql
-- CRITICAL: This function MUST be SECURITY DEFINER and created by postgres/service_role
CREATE OR REPLACE FUNCTION get_client_user_permissions(
  p_user_id UUID,
  p_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- ⚠️ REQUIRED: Bypasses RLS to prevent infinite recursion
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_permissions JSONB;
  v_is_active BOOLEAN;
BEGIN
  -- Fetch user's role and permissions
  SELECT 
    role_within_client,
    permissions,
    is_active
  INTO v_role, v_permissions, v_is_active
  FROM client_portal_users
  WHERE user_id = p_user_id 
    AND client_id = p_client_id;
  
  -- Return null if user not found or inactive
  IF NOT FOUND OR v_is_active = false THEN
    RETURN NULL;
  END IF;
  
  -- Executives automatically get all permissions
  IF v_role = 'executive' THEN
    RETURN jsonb_build_object(
      'create_orders', true,
      'view_orders', true,
      'create_quotes', true,
      'view_quotes', true,
      'view_materials', true,
      'view_quality_data', true,
      'manage_users', true,
      'approve_orders', true
    );
  END IF;
  
  -- Return configured permissions for regular users
  RETURN v_permissions;
END;
$$;

COMMENT ON FUNCTION get_client_user_permissions IS 
  'Returns effective permissions JSONB for a user within a client. Executives get full permissions automatically. SECURITY DEFINER to bypass RLS.';
```

### Step 2.3: Check Specific Permission

```sql
-- CRITICAL: This function MUST be SECURITY DEFINER and created by postgres/service_role
CREATE OR REPLACE FUNCTION user_has_client_permission(
  p_user_id UUID,
  p_client_id UUID,
  p_permission_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- ⚠️ REQUIRED: Bypasses RLS to prevent infinite recursion
STABLE
AS $$
DECLARE
  v_permissions JSONB;
BEGIN
  v_permissions := get_client_user_permissions(p_user_id, p_client_id);
  
  -- If no permissions found, deny
  IF v_permissions IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if permission exists and is true
  RETURN COALESCE((v_permissions->>p_permission_key)::boolean, false);
END;
$$;

COMMENT ON FUNCTION user_has_client_permission IS 
  'Returns true if user has a specific permission (e.g., "create_orders") for the client. SECURITY DEFINER to bypass RLS.';
```

### Step 2.4: Get User's Clients

```sql
-- CRITICAL: This function MUST be SECURITY DEFINER and created by postgres/service_role
CREATE OR REPLACE FUNCTION get_user_clients(p_user_id UUID)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  role_within_client TEXT,
  is_active BOOLEAN,
  permissions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER -- ⚠️ REQUIRED: Bypasses RLS to prevent infinite recursion
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cpu.client_id,
    c.business_name,
    cpu.role_within_client,
    cpu.is_active,
    get_client_user_permissions(p_user_id, cpu.client_id) as permissions
  FROM client_portal_users cpu
  JOIN clients c ON c.id = cpu.client_id
  WHERE cpu.user_id = p_user_id
    AND cpu.is_active = true
  ORDER BY c.business_name;
END;
$$;

COMMENT ON FUNCTION get_user_clients IS 
  'Returns all clients the user has access to with their role and effective permissions. SECURITY DEFINER to bypass RLS.';
```

### Step 2.5: Current User Helper (for RLS) - ✅ CORRECTED

```sql
-- ✅ CORRECTED: Preserved PARALLEL SAFE optimization from existing function
-- This function is called frequently in RLS policies, so performance matters
CREATE OR REPLACE FUNCTION current_user_is_external_client()
RETURNS BOOLEAN
LANGUAGE sql -- ✅ Kept as SQL for better performance
SECURITY DEFINER -- ⚠️ REQUIRED: Bypasses RLS to prevent infinite recursion
STABLE
PARALLEL SAFE -- ✅ PRESERVED: Allows parallel query execution
AS $$
  SELECT role = 'EXTERNAL_CLIENT' 
  FROM user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION current_user_is_external_client IS 
  'Returns true if the currently authenticated user has EXTERNAL_CLIENT role. Used in RLS policies. SECURITY DEFINER to bypass RLS.';
```

### ⚠️ CRITICAL: Reset Role After Function Creation

```sql
-- ✅ CORRECTED: Reset role to prevent unintended privilege escalation
RESET ROLE;
```

---

## PHASE 3: Triggers (✅ CORRECTED - Proper Naming and Error Handling)

### Step 3.1: Auto-Update Timestamp Trigger

```sql
-- Generic trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to client_portal_users
CREATE TRIGGER trg_client_portal_users_updated_at
  BEFORE UPDATE ON client_portal_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Step 3.2: Order Client Approval Status Auto-Set (✅ CORRECTED)

```sql
-- ✅ CORRECTED: Added NULL safety and improved error handling
-- ✅ CORRECTED: Renamed trigger to ensure proper execution order
CREATE OR REPLACE FUNCTION set_order_client_approval_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client_requires_approval BOOLEAN;
  v_creator_is_executive BOOLEAN;
  v_creator_is_portal_user BOOLEAN;
BEGIN
  -- Check if creator is a portal user with NULL safety
  SELECT is_portal_user INTO v_creator_is_portal_user
  FROM user_profiles
  WHERE id = NEW.created_by;
  
  -- ✅ CORRECTED: Added COALESCE for NULL safety
  -- If not a portal user (internal staff), no client approval needed
  IF NOT COALESCE(v_creator_is_portal_user, false) THEN
    NEW.client_approval_status := 'not_required';
    RETURN NEW;
  END IF;
  
  -- Check if client requires internal approval
  SELECT requires_internal_approval INTO v_client_requires_approval
  FROM clients 
  WHERE id = NEW.client_id;
  
  -- Check if creator is an executive for this client
  v_creator_is_executive := is_client_executive(NEW.created_by, NEW.client_id);
  
  -- Determine approval status with NULL safety
  IF NOT COALESCE(v_client_requires_approval, false) OR COALESCE(v_creator_is_executive, false) THEN
    -- No approval needed: client doesn't require it OR creator is executive
    NEW.client_approval_status := 'not_required';
  ELSE
    -- Approval needed: non-executive user creating order for approval-required client
    NEW.client_approval_status := 'pending_client';
  END IF;
  
  RETURN NEW;
END;
$$;

-- ✅ CORRECTED: Renamed trigger to "aaa_" prefix to ensure it runs FIRST
-- Existing triggers: auto_set_order_plant_id_trigger, debug_order_creation_trigger, order_preliminar_balance_trigger
-- This trigger runs alphabetically before them: aaa < auto < debug < order
CREATE TRIGGER aaa_trg_order_client_approval_status
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_client_approval_status();

COMMENT ON FUNCTION set_order_client_approval_status IS 
  'Automatically sets client_approval_status based on client settings and user role when order is created. Includes NULL safety for robustness.';
```

### Step 3.3: Update Credit Validation Webhooks (✅ NEW - Critical Integration)

```sql
-- ✅ CRITICAL: Update existing credit validation webhook to respect client approval flow
-- Orders should only notify credit validators AFTER client approval (or if approval not required)

CREATE OR REPLACE FUNCTION handle_credit_validation_webhook_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ✅ NEW LOGIC: Only notify credit validators if client approval not required or already approved
  -- This prevents premature notifications for orders pending client approval
  IF (NEW.credit_status = 'pending' 
      AND NEW.client_approval_status IN ('not_required', 'approved_by_client')) THEN
    PERFORM net.http_post(
      'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/credit-validation-notification',
      jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'requires_invoice', NEW.requires_invoice,
          'created_by', NEW.created_by,
          'order_number', NEW.order_number,
          'client_approval_status', NEW.client_approval_status
        ),
        'type', 'new_order'
      ),
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo'
      ),
      1000
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_credit_validation_webhook_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ✅ NEW LOGIC: When client approves an order, trigger credit validation notification
  IF (OLD.client_approval_status = 'pending_client' 
      AND NEW.client_approval_status = 'approved_by_client'
      AND NEW.credit_status = 'pending') THEN
    -- Client just approved the order, now notify credit validators
    PERFORM net.http_post(
      'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/credit-validation-notification',
      jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'requires_invoice', NEW.requires_invoice,
          'created_by', NEW.created_by,
          'order_number', NEW.order_number,
          'client_approval_status', NEW.client_approval_status,
          'client_approved_by', NEW.client_approved_by
        ),
        'type', 'client_approved_order'
      ),
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo'
      ),
      1000
    );
  -- Existing logic: rejected_by_validator
  ELSIF (NEW.credit_status = 'rejected_by_validator') THEN
    PERFORM net.http_post(
      'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/credit-validation-notification',
      jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'requires_invoice', NEW.requires_invoice,
          'created_by', NEW.created_by,
          'order_number', NEW.order_number
        ),
        'type', 'rejected_by_validator'
      ),
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo'
      ),
      1000
    );
  -- Existing logic: status changes to pending
  ELSIF (NEW.credit_status = 'pending' 
         AND OLD.credit_status != 'pending'
         AND NEW.client_approval_status IN ('not_required', 'approved_by_client')) THEN
    PERFORM net.http_post(
      'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/credit-validation-notification',
      jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'requires_invoice', NEW.requires_invoice,
          'created_by', NEW.created_by,
          'order_number', NEW.order_number
        ),
        'type', 'new_order'
      ),
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo'
      ),
      1000
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_credit_validation_webhook_insert IS 
  'Triggers credit validation notification webhook on order insert. Modified to respect client approval workflow - only notifies when client approval not required or already approved.';

COMMENT ON FUNCTION handle_credit_validation_webhook_update IS 
  'Triggers credit validation notification webhook on order updates. Modified to include notification when client approves an order (pending_client -> approved_by_client transition).';
```

### Step 3.4: Order Approval History Trigger (Optional)

```sql
-- Trigger: Log approval actions to history table
CREATE OR REPLACE FUNCTION log_order_approval_action()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log client approval changes only
  IF NEW.client_approval_status IS DISTINCT FROM OLD.client_approval_status THEN
    INSERT INTO order_approval_history (
      order_id,
      actioned_by,
      action,
      approval_stage,
      notes,
      rejection_reason
    ) VALUES (
      NEW.id,
      COALESCE(NEW.client_approved_by, NEW.created_by),
      CASE 
        WHEN NEW.client_approval_status = 'approved_by_client' THEN 'approved'
        WHEN NEW.client_approval_status = 'rejected_by_client' THEN 'rejected'
        WHEN NEW.client_approval_status = 'pending_client' THEN 'submitted'
        ELSE 'submitted'
      END,
      'client_internal',
      NULL,
      NEW.client_rejection_reason
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_order_approval
  AFTER INSERT OR UPDATE OF client_approval_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_approval_action();
```

---

## PHASE 4: RLS Policies (✅ CORRECTED - Proper Cleanup First)

### Step 4.1: Drop Existing External Client Policies (✅ CORRECTED)

```sql
-- ✅ CORRECTED: Properly drop all variations of external client policies
-- This prevents conflicts with new multi-user policies
DO $$
BEGIN
  -- Drop policies on clients table
  BEGIN
    DROP POLICY IF EXISTS external_client_clients_read ON clients;
    RAISE NOTICE 'Dropped policy: external_client_clients_read';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Policy external_client_clients_read did not exist';
  END;
  
  BEGIN
    DROP POLICY IF EXISTS external_client_clients_select ON clients;
    RAISE NOTICE 'Dropped policy: external_client_clients_select';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Policy external_client_clients_select did not exist';
  END;
  
  -- Drop policies on orders table
  BEGIN
    DROP POLICY IF EXISTS external_client_orders_read ON orders;
    RAISE NOTICE 'Dropped policy: external_client_orders_read';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Policy external_client_orders_read did not exist';
  END;
  
  BEGIN
    DROP POLICY IF EXISTS external_client_orders_select ON orders;
    RAISE NOTICE 'Dropped policy: external_client_orders_select';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Policy external_client_orders_select did not exist';
  END;
END $$;

-- Verify policies were dropped
SELECT 
  tablename,
  policyname
FROM pg_policies
WHERE tablename IN ('clients', 'orders')
  AND policyname LIKE '%external_client%';
-- Should return 0 rows
```

### Step 4.2: RLS Policies for `client_portal_users` Table

```sql
-- Enable RLS on client_portal_users
ALTER TABLE client_portal_users ENABLE ROW LEVEL SECURITY;

-- Policy: Executives can view all users in their organization
CREATE POLICY client_portal_users_executive_select ON client_portal_users
  FOR SELECT
  TO authenticated
  USING (
    is_client_executive(auth.uid(), client_id) = true
  );

-- Policy: Executives can insert (invite) new users to their organization
CREATE POLICY client_portal_users_executive_insert ON client_portal_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_client_executive(auth.uid(), client_id) = true
  );

-- Policy: Executives can update users in their organization
CREATE POLICY client_portal_users_executive_update ON client_portal_users
  FOR UPDATE
  TO authenticated
  USING (
    is_client_executive(auth.uid(), client_id) = true
  );

-- Policy: Executives can delete (deactivate) users in their organization
-- Note: Actual deletion is prevented by setting is_active = false
CREATE POLICY client_portal_users_executive_delete ON client_portal_users
  FOR DELETE
  TO authenticated
  USING (
    is_client_executive(auth.uid(), client_id) = true
  );

-- Policy: Users can view their own access record
CREATE POLICY client_portal_users_self_select ON client_portal_users
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );
```

### Step 4.3: Updated RLS Policies for `clients` Table

```sql
-- ✅ NEW POLICY: External clients can read clients they're associated with
CREATE POLICY external_client_clients_read_multi_user ON clients
  FOR SELECT
  TO authenticated
  USING (
    current_user_is_external_client() = true
    AND id IN (
      SELECT client_id 
      FROM client_portal_users 
      WHERE user_id = auth.uid() 
        AND is_active = true
    )
  );

-- Note: Keep existing internal staff policies unchanged
-- They should still work as before:
-- - clients_all_roles_access
-- - clients_management_insert
-- - clients_management_update
-- - clients_restricted_delete
```

### Step 4.4: Updated RLS Policies for `orders` Table

```sql
-- ✅ NEW POLICY: External clients can read orders for clients they're associated with
CREATE POLICY external_client_orders_read_multi_user ON orders
  FOR SELECT
  TO authenticated
  USING (
    current_user_is_external_client() = true
    AND client_id IN (
      SELECT client_id 
      FROM client_portal_users 
      WHERE user_id = auth.uid() 
        AND is_active = true
    )
  );

-- ✅ NEW POLICY: External clients can create orders if they have permission
CREATE POLICY external_client_orders_insert ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_is_external_client() = true
    AND client_id IN (
      SELECT cpu.client_id 
      FROM client_portal_users cpu
      WHERE cpu.user_id = auth.uid() 
        AND cpu.is_active = true
        AND (
          -- Executives always have create permission
          cpu.role_within_client = 'executive'
          -- Regular users need explicit permission
          OR (cpu.permissions->>'create_orders')::boolean = true
        )
    )
  );

-- ✅ NEW POLICY: External clients can update orders (only executives for now)
-- This could be refined to allow creator to edit pending orders
CREATE POLICY external_client_orders_update ON orders
  FOR UPDATE
  TO authenticated
  USING (
    current_user_is_external_client() = true
    AND is_client_executive(auth.uid(), client_id) = true
  );

-- Note: Keep existing internal staff order policies
-- They continue to work independently:
-- - orders_allow_all_insert
-- - orders_hierarchical_select
-- - orders_hierarchical_update
-- - orders_select_creator_or_hierarchical
-- - orders_select_own
-- - orders_delete_creator_authorized
-- - orders_delete_managers_authorized
```

### Step 4.5: RLS Policies for `order_approval_history`

```sql
-- Enable RLS
ALTER TABLE order_approval_history ENABLE ROW LEVEL SECURITY;

-- Policy: External clients can view approval history for their orders
CREATE POLICY order_approval_history_external_read ON order_approval_history
  FOR SELECT
  TO authenticated
  USING (
    current_user_is_external_client() = true
    AND order_id IN (
      SELECT o.id 
      FROM orders o
      JOIN client_portal_users cpu ON cpu.client_id = o.client_id
      WHERE cpu.user_id = auth.uid() 
        AND cpu.is_active = true
    )
  );

-- Policy: System can insert approval history
CREATE POLICY order_approval_history_insert ON order_approval_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Controlled by trigger, not direct user input
```

---

## PHASE 5: Indexes & Performance Optimization

### Step 5.1: Create Performance Indexes

```sql
-- Junction table indexes (critical for performance)
CREATE INDEX IF NOT EXISTS idx_client_portal_users_client 
  ON client_portal_users(client_id) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_client_portal_users_user 
  ON client_portal_users(user_id) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_client_portal_users_client_role 
  ON client_portal_users(client_id, role_within_client) 
  WHERE is_active = true;

-- Orders approval status index (already created in Step 1.3, but ensure it exists)
CREATE INDEX IF NOT EXISTS idx_orders_client_approval_status 
  ON orders(client_approval_status) 
  WHERE client_approval_status != 'not_required';

-- Orders lookup by client and status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_orders_client_approval 
  ON orders(client_id, client_approval_status) 
  WHERE client_approval_status = 'pending_client';

-- Orders approved by (for audit queries)
CREATE INDEX IF NOT EXISTS idx_orders_client_approved_by 
  ON orders(client_approved_by) 
  WHERE client_approved_by IS NOT NULL;

-- User profiles portal flag
CREATE INDEX IF NOT EXISTS idx_user_profiles_portal 
  ON user_profiles(role) 
  WHERE role = 'EXTERNAL_CLIENT';
```

### Step 5.2: Analyze Tables

```sql
-- Update statistics for query planner
ANALYZE client_portal_users;
ANALYZE orders;
ANALYZE clients;
ANALYZE user_profiles;
```

---

## PHASE 6: Data Migration

### Step 6.1: Migrate Existing Portal Users

```sql
-- Migrate existing single portal users to new multi-user system
-- All existing users become executives by default
INSERT INTO client_portal_users (
  client_id,
  user_id,
  role_within_client,
  is_active,
  permissions,
  invited_by,
  invited_at
)
SELECT 
  c.id as client_id,
  c.portal_user_id as user_id,
  'executive' as role_within_client,
  c.is_portal_enabled as is_active,
  '{}'::jsonb as permissions, -- Executives get all permissions automatically
  NULL as invited_by, -- Legacy migration, no inviter
  c.created_at as invited_at
FROM clients c
WHERE c.portal_user_id IS NOT NULL
ON CONFLICT (client_id, user_id) DO NOTHING; -- Prevent duplicates if run multiple times

-- Verify migration
SELECT 
  COUNT(*) as migrated_users,
  COUNT(DISTINCT client_id) as clients_with_users
FROM client_portal_users;
```

### Step 6.2: Update Existing Orders

```sql
-- Update all existing orders to not require client approval
-- These are legacy orders created before the approval system
UPDATE orders
SET client_approval_status = 'not_required'
WHERE client_approval_status IS NULL;

-- Verify
SELECT 
  client_approval_status,
  COUNT(*) as count
FROM orders
GROUP BY client_approval_status
ORDER BY client_approval_status;
```

### Step 6.3: Update User Profiles Flag

```sql
-- Ensure all EXTERNAL_CLIENT users have is_portal_user = true
UPDATE user_profiles
SET is_portal_user = true
WHERE role = 'EXTERNAL_CLIENT'
  AND is_portal_user = false;

-- Verify
SELECT 
  role,
  is_portal_user,
  COUNT(*) as count
FROM user_profiles
WHERE role = 'EXTERNAL_CLIENT'
GROUP BY role, is_portal_user;
```

---

## PHASE 7: Post-Migration Validation

### Step 7.1: Validation Queries

```sql
-- 1. Verify all previous portal users are now in junction table
SELECT 
  c.id as client_id,
  c.business_name,
  c.portal_user_id,
  cpu.user_id as junction_user_id,
  cpu.role_within_client
FROM clients c
LEFT JOIN client_portal_users cpu ON cpu.client_id = c.id AND cpu.user_id = c.portal_user_id
WHERE c.portal_user_id IS NOT NULL
  AND cpu.user_id IS NULL;
-- Should return 0 rows

-- 2. Verify RLS policies are working (run as portal user)
-- This should be tested in the application, not in admin context

-- 3. Check order approval status distribution
SELECT 
  client_approval_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM orders
GROUP BY client_approval_status
ORDER BY count DESC;

-- 4. Verify indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('client_portal_users', 'orders')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 5. Test helper functions
SELECT 
  is_client_executive(
    (SELECT portal_user_id FROM clients WHERE portal_user_id IS NOT NULL LIMIT 1),
    (SELECT id FROM clients WHERE portal_user_id IS NOT NULL LIMIT 1)
  ) as should_be_true;
-- Should return true

-- 6. Verify no orphaned records
SELECT 
  'client_portal_users with invalid client_id' as check_name,
  COUNT(*) as count
FROM client_portal_users cpu
LEFT JOIN clients c ON c.id = cpu.client_id
WHERE c.id IS NULL
UNION ALL
SELECT 
  'client_portal_users with invalid user_id',
  COUNT(*)
FROM client_portal_users cpu
LEFT JOIN user_profiles up ON up.id = cpu.user_id
WHERE up.id IS NULL;
-- Both should return 0

-- 7. ✅ NEW: Verify trigger execution order
SELECT 
  t.tgname as trigger_name,
  t.tgenabled as is_enabled,
  pg_get_triggerdef(t.oid) as definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'orders'
  AND NOT t.tgisinternal
  AND t.tgtype & 4 = 4 -- BEFORE INSERT triggers
ORDER BY t.tgname;
-- Verify aaa_trg_order_client_approval_status appears first alphabetically

-- 8. ✅ NEW: Verify old policies are gone
SELECT 
  tablename,
  policyname
FROM pg_policies
WHERE tablename IN ('clients', 'orders')
  AND policyname LIKE '%external_client%'
  AND policyname NOT LIKE '%multi_user%';
-- Should return 0 rows (only new multi_user policies should exist)

-- 9. ✅ NEW: Verify internal staff are not marked as portal users (CRITICAL)
SELECT 
    role,
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_portal_user = false THEN 1 END) as internal_staff,
    COUNT(CASE WHEN is_portal_user = true THEN 1 END) as portal_users
FROM user_profiles
GROUP BY role
ORDER BY role;
-- EXPECTED: Only EXTERNAL_CLIENT should have portal_users > 0
-- All SALES_AGENT, PLANT_MANAGER, etc. should have portal_users = 0

-- 10. ✅ NEW: Fail-safe check for misconfigured internal staff
DO $$
DECLARE
  internal_staff_marked_as_portal INTEGER;
BEGIN
  SELECT COUNT(*) INTO internal_staff_marked_as_portal
  FROM user_profiles
  WHERE role != 'EXTERNAL_CLIENT'
    AND is_portal_user = true;
  
  IF internal_staff_marked_as_portal > 0 THEN
    RAISE EXCEPTION 'CRITICAL: Found % internal staff users incorrectly marked as portal users! Sales agents will not bypass client approval!', internal_staff_marked_as_portal;
  ELSE
    RAISE NOTICE '✅ All internal staff correctly configured (is_portal_user = false). Sales agents will bypass client approval.';
  END IF;
END $$;
```

### Step 7.2: Performance Validation

```sql
-- Test query performance for common operations

-- 1. Get orders for a portal user (should use indexes)
EXPLAIN ANALYZE
SELECT o.*
FROM orders o
JOIN client_portal_users cpu ON cpu.client_id = o.client_id
WHERE cpu.user_id = (SELECT portal_user_id FROM clients WHERE portal_user_id IS NOT NULL LIMIT 1)
  AND cpu.is_active = true
  AND o.client_approval_status = 'pending_client';

-- Look for "Index Scan" in output, not "Seq Scan"

-- 2. Check if user is executive (should be fast)
EXPLAIN ANALYZE
SELECT is_client_executive(
  (SELECT portal_user_id FROM clients WHERE portal_user_id IS NOT NULL LIMIT 1),
  (SELECT id FROM clients WHERE portal_user_id IS NOT NULL LIMIT 1)
);

-- 3. ✅ NEW: Test RLS policy performance on clients table
SET ROLE authenticated;
SET request.jwt.claim.sub = '(SELECT portal_user_id FROM clients WHERE portal_user_id IS NOT NULL LIMIT 1)';

EXPLAIN ANALYZE
SELECT * FROM clients WHERE id IN (
  SELECT client_id 
  FROM client_portal_users 
  WHERE user_id = auth.uid() 
    AND is_active = true
);

RESET ROLE;
```

### Step 7.3: ✅ NEW: Function Security Audit

```sql
-- Verify all critical functions have SECURITY DEFINER
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER ✅'
    ELSE 'SECURITY INVOKER ⚠️'
  END as security_mode,
  p.provolatile as volatility
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
  'is_client_executive',
  'get_client_user_permissions',
  'user_has_client_permission',
  'get_user_clients',
  'current_user_is_external_client'
)
ORDER BY p.proname;

-- All should show 'SECURITY DEFINER ✅'
```

---

## ROLLBACK PROCEDURES

### Complete Rollback (if needed)

```sql
-- ⚠️ ONLY RUN IF MIGRATION FAILS AND YOU NEED TO REVERT

-- 1. Drop triggers
DROP TRIGGER IF EXISTS aaa_trg_order_client_approval_status ON orders;
DROP TRIGGER IF EXISTS trg_client_portal_users_updated_at ON client_portal_users;
DROP TRIGGER IF EXISTS trg_log_order_approval ON orders;

-- 2. Drop functions
DROP FUNCTION IF EXISTS set_order_client_approval_status();
DROP FUNCTION IF EXISTS log_order_approval_action();
DROP FUNCTION IF EXISTS is_client_executive(UUID, UUID);
DROP FUNCTION IF EXISTS get_client_user_permissions(UUID, UUID);
DROP FUNCTION IF EXISTS user_has_client_permission(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS get_user_clients(UUID);

-- 3. Restore original current_user_is_external_client function
CREATE OR REPLACE FUNCTION current_user_is_external_client()
RETURNS boolean
LANGUAGE sql
STABLE PARALLEL SAFE
AS $$
  SELECT role = 'EXTERNAL_CLIENT' 
  FROM public.user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- 3b. Restore original credit validation webhook functions
CREATE OR REPLACE FUNCTION handle_credit_validation_webhook_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (NEW.credit_status = 'pending') THEN
    PERFORM net.http_post(
      'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/credit-validation-notification',
      jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'requires_invoice', NEW.requires_invoice,
          'created_by', NEW.created_by,
          'order_number', NEW.order_number
        ),
        'type', 'new_order'
      ),
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo'
      ),
      1000
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_credit_validation_webhook_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (NEW.credit_status = 'rejected_by_validator') THEN
    PERFORM net.http_post(
      'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/credit-validation-notification',
      jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'requires_invoice', NEW.requires_invoice,
          'created_by', NEW.created_by,
          'order_number', NEW.order_number
        ),
        'type', 'rejected_by_validator'
      ),
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo'
      ),
      1000
    );
  ELSIF (NEW.credit_status = 'pending' AND OLD.credit_status != 'pending') THEN
    PERFORM net.http_post(
      'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/credit-validation-notification',
      jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'requires_invoice', NEW.requires_invoice,
          'created_by', NEW.created_by,
          'order_number', NEW.order_number
        ),
        'type', 'new_order'
      ),
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo'
      ),
      1000
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Drop RLS policies
DROP POLICY IF EXISTS client_portal_users_executive_select ON client_portal_users;
DROP POLICY IF EXISTS client_portal_users_executive_insert ON client_portal_users;
DROP POLICY IF EXISTS client_portal_users_executive_update ON client_portal_users;
DROP POLICY IF EXISTS client_portal_users_executive_delete ON client_portal_users;
DROP POLICY IF EXISTS client_portal_users_self_select ON client_portal_users;
DROP POLICY IF EXISTS external_client_clients_read_multi_user ON clients;
DROP POLICY IF EXISTS external_client_orders_read_multi_user ON orders;
DROP POLICY IF EXISTS external_client_orders_insert ON orders;
DROP POLICY IF EXISTS external_client_orders_update ON orders;
DROP POLICY IF EXISTS order_approval_history_external_read ON order_approval_history;
DROP POLICY IF EXISTS order_approval_history_insert ON order_approval_history;

-- 5. Restore old external client policies
CREATE POLICY external_client_clients_read ON clients
  FOR SELECT
  TO authenticated
  USING (
    current_user_is_external_client() = true
    AND portal_user_id = auth.uid()
  );

CREATE POLICY external_client_orders_read ON orders
  FOR SELECT
  TO authenticated
  USING (
    current_user_is_external_client() = true
    AND client_id IN (
      SELECT clients.id
      FROM clients
      WHERE clients.portal_user_id = auth.uid()
    )
  );

-- 6. Drop indexes
DROP INDEX IF EXISTS idx_client_portal_users_client;
DROP INDEX IF EXISTS idx_client_portal_users_user;
DROP INDEX IF EXISTS idx_client_portal_users_client_role;
DROP INDEX IF EXISTS idx_orders_client_approval_status;
DROP INDEX IF EXISTS idx_orders_client_approval;
DROP INDEX IF EXISTS idx_orders_client_approved_by;

-- 7. Remove columns
ALTER TABLE orders
DROP COLUMN IF EXISTS client_approval_status,
DROP COLUMN IF EXISTS client_approved_by,
DROP COLUMN IF EXISTS client_approval_date,
DROP COLUMN IF EXISTS client_rejection_reason;

ALTER TABLE clients
DROP COLUMN IF EXISTS requires_internal_approval,
DROP COLUMN IF EXISTS default_permissions;

ALTER TABLE user_profiles
DROP COLUMN IF EXISTS is_portal_user;

-- 8. Drop tables
DROP TABLE IF EXISTS order_approval_history;
DROP TABLE IF EXISTS client_portal_users;

-- 9. ⚠️ If you need to restore data, use Supabase dashboard
-- Navigate to: Database → Backups → Select backup point → Restore
-- Supabase handles automatic backups, no manual restore scripts needed
```

---

## API Integration Testing Checklist

After completing database migration, test these scenarios:

### Test 1: Executive Invites User
```sql
-- Simulate executive inviting a user
-- Create test user
INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'test-user@client.com');
INSERT INTO user_profiles (id, email, role, is_portal_user) 
VALUES (
  (SELECT id FROM auth.users WHERE email = 'test-user@client.com'),
  'test-user@client.com',
  'EXTERNAL_CLIENT',
  true
);

-- Invite to client (as executive)
INSERT INTO client_portal_users (client_id, user_id, role_within_client, invited_by)
VALUES (
  (SELECT id FROM clients LIMIT 1),
  (SELECT id FROM auth.users WHERE email = 'test-user@client.com'),
  'user',
  (SELECT portal_user_id FROM clients LIMIT 1)
);
```

### Test 2: Order Approval Workflow
```sql
-- Create order as non-executive user
-- Should auto-set to 'pending_client' if client requires approval

-- Approve order as executive
UPDATE orders
SET 
  client_approval_status = 'approved_by_client',
  client_approved_by = (SELECT portal_user_id FROM clients WHERE id = orders.client_id),
  client_approval_date = now()
WHERE id = 'test-order-id';
```

### Test 3: Permission Checks
```sql
-- Test permission function
SELECT user_has_client_permission(
  'user-uuid',
  'client-uuid',
  'create_orders'
);
```

---

## Production Deployment Checklist

- [ ] **Pre-migration validation** passed (no orphaned references)
- [ ] **Credit validation webhooks** verified to exist
- [ ] **All SQL scripts** reviewed by senior developer
- [ ] **Test execution** on staging environment successful
- [ ] **Performance benchmarks** acceptable (< 200ms for common queries)
- [ ] **Rollback procedure** tested and documented
- [ ] **Monitoring alerts** configured for new tables
- [ ] **API endpoints** ready to use new schema
- [ ] **Frontend code** updated to support multi-user
- [ ] **User documentation** prepared for executives
- [ ] **Support team** trained on new features
- [ ] **Migration scheduled** for off-peak hours
- [ ] **Post-migration validation** queries prepared
- [ ] **Announcement email** drafted for clients
- [ ] ✅ **NEW: Function security audit** completed (all SECURITY DEFINER)
- [ ] ✅ **NEW: Trigger execution order** verified
- [ ] ✅ **NEW: Old RLS policies** confirmed dropped
- [ ] ✅ **NEW: Credit validation edge function** understands new 'client_approved_order' type
- [ ] ✅ **NEW: Tested client approval → credit validation flow**

---

## Execution Timeline

**Recommended Execution:**
```
00:00 - Execute Phase 0 (Validation - ABORT if fails)
00:01 - Execute Phase 1 (Schema changes) (5 min)
00:06 - Execute Phase 2 (Functions with role setup) (3 min)
00:09 - Execute Phase 3 (Triggers + Credit Webhook Updates) (3 min)
00:12 - Execute Phase 4 (Drop old policies + create new) (5 min)
00:17 - Execute Phase 5 (Indexes) (3 min)
00:20 - Execute Phase 6 (Data migration) (2 min)
00:22 - Execute Phase 7 (Validation) (5 min)
00:27 - Deploy updated application code
00:33 - Smoke tests
00:38 - Monitor for issues
```

**Total estimated downtime:** 0 minutes (if executed correctly, system remains operational throughout)

> **Note:** No manual backups needed - Supabase handles this automatically

---

## ✅ SUMMARY OF CORRECTIONS

1. **RLS Policy Conflicts** - Old policies now properly dropped before creating new ones
2. **SECURITY DEFINER Setup** - Added proper role setting before function creation
3. **Trigger Naming** - Renamed to ensure proper alphabetical execution order
4. **NULL Safety** - Added COALESCE calls in trigger logic
5. **Function Optimization** - Preserved PARALLEL SAFE in current_user_is_external_client
6. **Fail-Fast Validation** - Pre-migration checks now abort on errors
7. **Security Audit** - Added verification that all functions have SECURITY DEFINER
8. **Policy Verification** - Added check to confirm old policies are dropped
9. **Backup Simplification** - Removed manual backups (Supabase handles automatically)
10. **Credit Validation Integration** - Updated webhooks to work with client approval workflow

---

## 🔒 CRITICAL REMINDERS

1. **ALWAYS set role to postgres/service_role before creating SECURITY DEFINER functions**
2. **NEVER skip the pre-migration validation** - it will save you from data integrity issues
3. **ALWAYS verify trigger execution order** - alphabetical naming matters
4. **TEST on staging first** - never run directly on production
5. **MONITOR after deployment** - watch for RLS policy performance issues
6. **VERIFY credit webhooks** - ensure credit validators receive notifications after client approval

---

This completes the **CORRECTED** Supabase backend configuration plan. All critical issues have been addressed and the scripts are production-ready.
