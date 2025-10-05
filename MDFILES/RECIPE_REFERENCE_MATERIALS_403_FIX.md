# Recipe Reference Materials 403 Fix - RLS Policy INSERT Issue

## 🚨 **Issue Identified**

### **Error Details:**
```
POST https://pkjqznogflgbnwzkzmpg.supabase.co/rest/v1/recipe_reference_materials 403 (Forbidden)
```

### **Root Cause:**
The `recipe_reference_materials` table (and related recipe tables) had Row Level Security (RLS) policies with `with_check = null`. In PostgreSQL RLS:
- `USING` clause controls SELECT permissions  
- `WITH CHECK` clause controls INSERT/UPDATE permissions

When `WITH CHECK` is null, **INSERT operations are completely forbidden**, even if the user has SELECT permissions through the `USING` clause.

**Affected Tables:**
1. `recipe_reference_materials` ❌ 403 Forbidden on INSERT
2. `material_quantities` ❌ Missing WITH CHECK 
3. `recipe_versions` ❌ Missing WITH CHECK
4. `recipes` ❌ Missing WITH CHECK

---

## 🔧 **Root Cause Analysis**

### **Policy Structure Before Fix:**
```sql
-- BROKEN: Only USING clause, no WITH CHECK
CREATE POLICY policy_name ON table_name
FOR ALL TO authenticated
USING (complex_hierarchy_check)
-- ❌ WITH CHECK was NULL - prevents INSERTs!
```

### **PostgreSQL RLS Behavior:**
- ✅ **SELECT**: Uses `USING` clause → worked fine
- ❌ **INSERT**: Requires `WITH CHECK` clause → **403 Forbidden**
- ❌ **UPDATE**: Requires both `USING` + `WITH CHECK` → **403 Forbidden**

---

## 🔧 **Fixes Applied**

### **1. ✅ recipe_reference_materials**
- **Updated Policy**: Added proper `WITH CHECK` condition
- **Hierarchy Support**: Maintains same access rules for INSERT as SELECT
- **User Roles**: Executive, Business Unit Admin, Plant-specific users

### **2. ✅ material_quantities**  
- **Updated Policy**: Added `WITH CHECK` clause
- **Consistent Access**: Same hierarchy rules for all operations

### **3. ✅ recipe_versions**
- **Updated Policy**: Added `WITH CHECK` clause  
- **Recipe Relationship**: Maintains link to parent recipe permissions

### **4. ✅ recipes**
- **Updated Policy**: Added `WITH CHECK` clause
- **Plant Hierarchy**: Supports multi-plant business unit access

---

## 🎯 **Technical Details**

### **Fixed Policy Structure:**
```sql
CREATE POLICY table_hierarchical_access ON table_name
FOR ALL TO authenticated
USING (
  -- SELECT permissions (unchanged)
  hierarchy_check_logic
)
WITH CHECK (
  -- INSERT/UPDATE permissions (NEW!)
  same_hierarchy_check_logic
);
```

### **Hierarchy Access Rules:**
1. **🏢 Executive Role**: Global access (plant_id IS NULL, business_unit_id IS NULL, role = 'EXECUTIVE')
2. **🏭 Business Unit Admin**: Access to all plants in their business unit
3. **🏪 Plant User**: Access only to their specific plant

---

## 🧪 **Verification**

### **Policy Status Check:**
```sql
-- ✅ All tables now have WITH_CHECK conditions
material_quantities          | HAS_WITH_CHECK
recipe_reference_materials   | HAS_WITH_CHECK  
recipe_versions             | HAS_WITH_CHECK
recipes                     | HAS_WITH_CHECK
```

### **Expected Behavior:**
- ✅ **SELECT**: Works as before (no changes)
- ✅ **INSERT**: Now works with proper hierarchy validation
- ✅ **UPDATE**: Now works with proper hierarchy validation  
- ✅ **DELETE**: Works with hierarchy validation

---

## 📝 **Impact Summary**

### **✅ Fixed Issues:**
- ❌ **Before**: `POST /recipe_reference_materials` → 403 Forbidden
- ✅ **After**: INSERT operations work with proper access control

### **✅ Security Maintained:**
- ✅ **Hierarchy Rules**: Same access control for all operations
- ✅ **User Isolation**: Plant/business unit separation preserved
- ✅ **Role-Based Access**: Executive, Admin, Plant user roles respected

### **✅ System Stability:**
- ✅ **Recipe Creation**: Can now insert supporting data
- ✅ **Material Management**: Full CRUD operations available
- ✅ **Version Control**: Recipe versioning INSERT/UPDATE works

This fix resolves the fundamental RLS configuration issue that was preventing any INSERT operations on recipe-related tables while maintaining the existing security hierarchy. 