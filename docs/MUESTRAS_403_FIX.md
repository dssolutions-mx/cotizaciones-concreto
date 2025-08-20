# 🚨 MUESTRAS 403 Forbidden Error - RLS Policy Fix

## ⚠️ **Issue Identified**

### **Error Details:**
```
POST https://pkjqznogflgbnwzkzmpg.supabase.co/rest/v1/muestras?select=id 403 (Forbidden)
```

### **Root Cause:**
The `muestras` table had Row Level Security (RLS) enabled with **hierarchical access policies that required the `plant_id` field to match the user's plant assignment**, but the frontend service was **NOT setting the `plant_id` field** when inserting samples. This caused:

- ✅ **SELECT operations**: Worked (covered by existing policies)
- ❌ **INSERT operations**: **403 Forbidden** (RLS policy failed because `plant_id` was NULL)
- ❌ **UPDATE operations**: **403 Forbidden** (RLS policy failed because `plant_id` was NULL)

**The Real Problem:**
1. **RLS Policy**: Required `muestras.plant_id` to match user's `plant_id` for INSERT/UPDATE
2. **Frontend Service**: `addSampleToMuestreo()` function was missing `plant_id` field
3. **Database**: `muestras.plant_id` was NULL, causing RLS policy to fail

**Affected Tables:**
1. `muestras` ❌ 403 Forbidden on INSERT (missing `plant_id`)
2. `muestreos` ✅ Working (has proper `plant_id`)
3. `ensayos` ✅ Working (has proper `plant_id`)

---

## 🔍 **Error Analysis**

### **What Happened:**
1. **RLS was properly configured** with hierarchical access policies
2. **Policy required `plant_id` matching** between `muestras` and user's profile
3. **Frontend service was incomplete** - missing `plant_id` field in INSERT
4. **403 Forbidden** because RLS policy rejected NULL `plant_id`

### **User Impact:**
- Users cannot add new samples to existing muestreos
- Quality team workflow is blocked
- Modal shows error: "No se pudo agregar la muestra. Intente nuevamente."

---

## 🔧 **Solution Applied**

### **1. Fixed Frontend Service:**
Updated `src/services/qualityService.ts` in the `addSampleToMuestreo` function:

```typescript
// BEFORE (missing plant_id):
const sampleToInsert = {
  id: uuidv4(),
  muestreo_id: muestreoId,
  tipo_muestra: sampleData.tipo_muestra,
  // ... other fields
};

// AFTER (with plant_id):
const sampleToInsert = {
  id: uuidv4(),
  muestreo_id: muestreoId,
  plant_id: muestreo.plant_id, // Add plant_id from muestreo for RLS policy
  tipo_muestra: sampleData.tipo_muestra,
  // ... other fields
};
```

### **2. RLS Policy Already Correct:**
The existing policy `muestras_hierarchical_access` was already properly configured:

```sql
CREATE POLICY "muestras_hierarchical_access" ON public.muestras
FOR ALL TO authenticated
USING (
    -- Executive access
    (EXISTS (SELECT 1 FROM user_profiles WHERE ... AND role = 'EXECUTIVE'))
    OR 
    -- Business unit access
    (EXISTS (SELECT 1 FROM user_profiles p JOIN plants pl ON ...))
    OR 
    -- Plant-level access (this is what we need)
    (EXISTS (SELECT 1 FROM user_profiles WHERE 
        user_profiles.id = auth.uid() 
        AND user_profiles.plant_id = muestras.plant_id  -- ← This was the key!
        AND user_profiles.role IN ('PLANT_MANAGER', 'QUALITY_TEAM', 'DOSIFICADOR')
    ))
)
WITH CHECK (
    -- Same conditions for INSERT/UPDATE
    -- ... (same logic as USING clause)
);
```

---

## 🚀 **How the Fix Works**

### **Data Flow:**
1. **User** (role: `QUALITY_TEAM`, plant_id: `4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad`)
2. **Muestreo** (plant_id: `4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad`) ✅ Matches
3. **Sample Insert** (plant_id: `4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad`) ✅ Now matches
4. **RLS Policy** ✅ Allows INSERT because `plant_id` matches user's plant

### **Why It Failed Before:**
1. **User** (plant_id: `4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad`)
2. **Muestreo** (plant_id: `4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad`) ✅ Matches
3. **Sample Insert** (plant_id: `NULL`) ❌ No match
4. **RLS Policy** ❌ Rejected INSERT because `NULL != plant_id`

---

## ✅ **Verification Steps**

### **1. Check the Fix is Applied:**
The frontend service now includes `plant_id` when inserting samples.

### **2. Test INSERT Operation:**
```sql
-- This should now work for users with proper roles and plant assignment
INSERT INTO public.muestras (
    muestreo_id,
    plant_id,  -- ← This field is now populated!
    tipo_muestra,
    identificacion,
    fecha_programada_ensayo,
    estado
) VALUES (
    'your-muestreo-id'::uuid,
    'your-plant-id'::uuid,  -- ← Must match user's plant_id
    'CILINDRO',
    'TEST-001',
    CURRENT_DATE,
    'PENDIENTE'
);
```

### **3. Check User Role and Plant:**
```sql
-- Verify current user has proper role and plant assignment
SELECT 
    up.role,
    up.plant_id,
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
- ✅ RLS policies properly enforce plant-based access control

### **Security Maintained:**
- Users can only create samples for their assigned plant
- RLS policies enforce hierarchical access control
- Plant isolation is maintained
- All operations are logged and traceable

---

## 🔒 **Security Notes**

### **Why This Approach:**
1. **Maintains Security**: RLS policies still enforce plant-based access control
2. **Plant Isolation**: Users can only access data for their assigned plant
3. **Role-Based Access**: Only quality team and management can modify data
4. **Audit Trail**: All operations are logged and traceable
5. **Compliance**: Follows security best practices for multi-plant operations

### **Future Considerations:**
- Monitor policy effectiveness
- Consider adding DELETE policies if needed
- Review plant assignments regularly
- Add more granular permissions if required

---

## 📞 **Support**

If you encounter issues after applying this fix:

1. **Check if `plant_id` is being set** in the frontend service
2. **Verify user plant assignment** in `user_profiles` table
3. **Check muestreo `plant_id`** matches user's plant
4. **Review RLS policies** in Authentication → Policies section

**Files Modified:** 
- `src/services/qualityService.ts` (added `plant_id` field)

**Key Change:** 
- Added `plant_id: muestreo.plant_id` to sample insertion data
