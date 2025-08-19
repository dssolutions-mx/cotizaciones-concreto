# 🚨 MUESTRAS 403 Forbidden Error - RLS Policy Fix

## ⚠️ **Issue Identified**

### **Error Details:**
```
POST https://pkjqznogflgbnwzkzmpg.supabase.co/rest/v1/muestras?select=id 403 (Forbidden)
```

### **Root Cause:**
The `muestras` table (and related quality tables) had Row Level Security (RLS) enabled with **hierarchical access policies that were missing `WITH CHECK` clauses for INSERT operations**. This caused:

- ✅ **SELECT operations**: Worked (covered by `USING` clause in existing policies)
- ❌ **INSERT operations**: **403 Forbidden** (missing `WITH CHECK` clause in policies)
- ❌ **UPDATE operations**: **403 Forbidden** (missing `WITH CHECK` clause in policies)

**Affected Tables:**
1. `muestras` ❌ 403 Forbidden on INSERT (policy: `muestras_hierarchical_access`)
2. `muestreos` ❌ Missing INSERT/UPDATE permissions (policy: `muestreos_hierarchical_access`)
3. `ensayos` ❌ Missing INSERT/UPDATE permissions (policy: `ensayos_hierarchical_access`)

---

## 🔍 **Error Analysis**

### **What Happened:**
1. **RLS was enabled** on quality tables with hierarchical access policies
2. **Policies existed** but only covered `SELECT` operations via `USING` clause
3. **Missing `WITH CHECK` clauses** meant INSERT/UPDATE operations were implicitly denied
4. **AddSampleModal.tsx** tried to insert into `muestras` table
5. **403 Forbidden** because no INSERT policy existed

### **User Impact:**
- Users cannot add new samples to existing muestreos
- Quality team workflow is blocked
- Modal shows error: "No se pudo agregar la muestra. Intente nuevamente."

---

## 🔧 **Solution Applied**

### **1. Applied Migration:**
`fix_muestras_insert_policy` - Updated existing hierarchical RLS policies

### **2. Fixed RLS Policies:**
The existing hierarchical policies were updated to include `WITH CHECK` clauses:

```sql
-- Before: Policy only had USING clause (SELECT only)
CREATE POLICY "muestras_hierarchical_access" ON public.muestras
FOR ALL TO authenticated
USING (hierarchical_access_logic);

-- After: Policy now has both USING and WITH CHECK clauses
CREATE POLICY "muestras_hierarchical_access" ON public.muestras
FOR ALL TO authenticated
USING (hierarchical_access_logic)
WITH CHECK (hierarchical_access_logic);
```

### **3. Hierarchical Access Control Maintained:**
**Access Levels:**
- **EXECUTIVE**: Full access across all plants/business units
- **Business Unit Managers**: Access to plants within their business unit
- **Plant-Level Users**: Access limited to their assigned plant

**Allowed Roles for INSERT/UPDATE:**
- `QUALITY_TEAM` - Primary quality control users
- `EXECUTIVE` - Management oversight
- `PLANT_MANAGER` - Plant-level quality control
- `DOSIFICADOR` - Plant operators

---

## 🚀 **How the Fix Was Applied**

### **Migration Applied:**
The fix was applied directly to the database using Supabase MCP tools:

1. **Identified the issue**: Existing policies had `USING` but no `WITH CHECK`
2. **Updated policies**: Added `WITH CHECK` clauses to existing hierarchical policies
3. **Maintained security**: All existing access control logic preserved
4. **Verified fix**: Tested INSERT operations successfully

### **Tables Fixed:**
- ✅ `muestras` - INSERT operations now work
- ✅ `muestreos` - INSERT operations now work  
- ✅ `ensayos` - INSERT operations now work

---

## ✅ **Verification Steps**

### **1. Check Policies Exist:**
```sql
SELECT schemaname, tablename, policyname, cmd, 
       CASE WHEN with_check IS NOT NULL THEN 'WITH CHECK: Yes' ELSE 'WITH CHECK: No' END
FROM pg_policies 
WHERE tablename IN ('muestras', 'muestreos', 'ensayos')
ORDER BY tablename, policyname;
```

### **2. Test INSERT Operation:**
```sql
-- This should now work for users with proper roles
INSERT INTO public.muestras (
    muestreo_id, tipo_muestra, identificacion, 
    fecha_programada_ensayo, estado
) VALUES (
    'your-muestreo-id'::uuid, 'CILINDRO', 'TEST-001',
    CURRENT_DATE, 'PENDIENTE'
);
```

### **3. Check User Role and Plant Assignment:**
```sql
-- Verify current user has proper role and plant assignment
SELECT 
    up.role as user_role,
    up.plant_id as user_plant_id,
    p.code as plant_code
FROM user_profiles up 
LEFT JOIN plants p ON p.id = up.plant_id
WHERE up.id = auth.uid();
```

---

## 🎯 **Expected Results**

### **After Fix:**
- ✅ **AddSampleModal.tsx** works correctly
- ✅ Users can add new samples to muestreos
- ✅ Quality workflow is restored
- ✅ No more 403 Forbidden errors
- ✅ Hierarchical access control maintained

### **Security Maintained:**
- Only authorized roles can create/update quality data
- Plant-level access restrictions enforced
- Business unit boundaries respected
- Executive oversight maintained

---

## 🔒 **Security Notes**

### **Why This Approach:**
1. **Maintains Security**: Hierarchical RLS policies still enforce access control
2. **Preserves Logic**: All existing access control rules maintained
3. **Role-Based Access**: Only quality team and management can modify data
4. **Plant Isolation**: Users can only access data from their assigned plants
5. **Audit Trail**: All operations are logged and traceable

### **Access Control Matrix:**
| Role | Plant Access | Business Unit Access | Global Access |
|------|-------------|---------------------|---------------|
| QUALITY_TEAM | ✅ Assigned Plant | ❌ | ❌ |
| PLANT_MANAGER | ✅ Assigned Plant | ❌ | ❌ |
| DOSIFICADOR | ✅ Assigned Plant | ❌ | ❌ |
| EXECUTIVE | ✅ All Plants | ✅ All Business Units | ✅ |

---

## 📞 **Support**

If you encounter issues after this fix:

1. **Check user role and plant assignment** in `user_profiles` table
2. **Verify RLS policies** have both `USING` and `WITH CHECK` clauses
3. **Test with different user accounts** to isolate role/plant issues
4. **Review plant assignments** for quality team users

**Migration Applied:** `fix_muestras_insert_policy`
**Documentation:** `docs/MUESTRAS_403_FIX.md`

---

## 🔍 **Technical Details**

### **Policy Structure:**
The hierarchical policies use a three-tier access model:

1. **Global Executive Access**: `plant_id IS NULL AND business_unit_id IS NULL`
2. **Business Unit Access**: `plant_id IS NULL AND business_unit_id IS NOT NULL`
3. **Plant-Level Access**: `plant_id = specific_plant_id`

### **Policy Components:**
- **`USING` clause**: Controls SELECT operations
- **`WITH CHECK` clause**: Controls INSERT/UPDATE operations
- **`FOR ALL`**: Applies to all operations (SELECT, INSERT, UPDATE, DELETE)

### **Performance Considerations:**
- Policies use EXISTS subqueries for efficient evaluation
- Plant ID filtering ensures minimal data access
- Role-based filtering happens at the database level
