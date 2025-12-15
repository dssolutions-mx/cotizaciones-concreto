# Calculator Save Performance Optimization Plan

## Current Performance Bottleneck

**Current Flow (Sequential):**
- For each recipe (36 recipes):
  - **updateVariant**: 1 recipe update + 1 version select + 1 version update + 1 version insert = **4 queries**
  - **createVariant/newMaster**: 1 master insert (if newMaster) + 1 recipe insert + 1 version insert = **2-3 queries**
- **Total: 72-144 sequential queries** for 36 recipes

**Current Time:** ~5-10 seconds for 36 recipes

## Optimization Strategy

Transform sequential operations into batched operations to reduce database round trips from **72-144 queries → ~8-10 queries**.

---

## Phase 1: Batch Master Creation ⚡

**Current:** Create masters one by one (1 query per master)
**Optimized:** Collect all new masters, create in single batch insert

**Impact:** Reduces N master queries → 1 query

**Implementation:**
1. Collect all `newMaster` decisions
2. Build array of master records
3. Single batch insert: `INSERT INTO master_recipes VALUES (...), (...), ...`
4. Map master codes to IDs for recipe creation

**Expected Speedup:** 2-5x faster for recipes with new masters

---

## Phase 2: Pre-fetch Version Numbers (Batch) ⚡

**Current:** Query version number for each recipe update individually
**Optimized:** Batch query all version numbers needed

**Impact:** Reduces N version queries → 1 query

**Implementation:**
1. Collect all `updateVariant` recipe IDs
2. Single query: `SELECT recipe_id, MAX(version_number) FROM recipe_versions WHERE recipe_id IN (...) GROUP BY recipe_id`
3. Build map of recipe_id → next_version_number

**Expected Speedup:** Eliminates 36 sequential queries

---

## Phase 3: Batch Recipe Updates ⚡

**Current:** Update recipes one by one
**Optimized:** Batch update all recipes that need updates

**Impact:** Reduces N update queries → 1 query (or minimal queries)

**Implementation:**
1. Collect all `updateVariant` recipes
2. Group by similar update patterns
3. Use PostgreSQL `UPDATE ... FROM VALUES` or multiple targeted updates
4. Note: Supabase doesn't support multi-row updates directly, but we can batch by grouping similar updates

**Expected Speedup:** 5-10x faster for recipe updates

---

## Phase 4: Batch Recipe Creation ⚡

**Current:** Create recipes one by one (1 query per recipe)
**Optimized:** Batch insert all new recipes

**Impact:** Reduces N recipe inserts → 1 query

**Implementation:**
1. Collect all `createVariant` and `newMaster` recipes
2. Build array of recipe records (with master_id already mapped from Phase 1)
3. Single batch insert: `INSERT INTO recipes VALUES (...), (...), ... RETURNING id, recipe_code`
4. Map recipe codes to IDs for version creation

**Expected Speedup:** 10-20x faster for recipe creation

---

## Phase 5: Batch Version Creation ⚡

**Current:** Create versions one by one (1 query per version)
**Optimized:** Batch insert all versions

**Impact:** Reduces N version inserts → 1 query

**Implementation:**
1. Collect all versions to create (both updates and new recipes)
2. Build array of version records (with recipe_id already mapped)
3. Single batch insert: `INSERT INTO recipe_versions VALUES (...), (...), ... RETURNING id, recipe_id`
4. Map recipe codes to version IDs for material insertion

**Expected Speedup:** 10-20x faster for version creation

---

## Phase 6: Batch Version Updates (Mark Non-Current) ⚡

**Current:** Update versions one by one to mark as non-current
**Optimized:** Batch update all versions that need to be marked non-current

**Impact:** Reduces N update queries → 1 query

**Implementation:**
1. Collect all recipe IDs that need version updates
2. Single batch update: `UPDATE recipe_versions SET is_current = false WHERE recipe_id IN (...) AND is_current = true`

**Expected Speedup:** Eliminates 36 sequential queries

---

## Expected Overall Performance

**Before Optimization:**
- 72-144 sequential queries
- ~5-10 seconds for 36 recipes
- High risk of timeouts

**After Optimization:**
- ~8-10 batched queries total:
  1. Batch create masters (if any)
  2. Batch query version numbers (if updates)
  3. Batch update versions (mark non-current)
  4. Batch update recipes (if updates)
  5. Batch create recipes (if new)
  6. Batch create versions
  7. Batch insert materials (already optimized)
  8. Batch insert SSS materials (already optimized)
- **~1-2 seconds for 36 recipes** (5-10x faster)
- Zero timeout risk

---

## Implementation Order

1. ✅ **Phase 1: Batch Master Creation** (Highest impact for new masters)
2. ✅ **Phase 2: Pre-fetch Version Numbers** (Eliminates sequential queries)
3. ✅ **Phase 3: Batch Recipe Updates** (Reduces update overhead)
4. ✅ **Phase 4: Batch Recipe Creation** (Highest impact for new recipes)
5. ✅ **Phase 5: Batch Version Creation** (Critical - most queries)
6. ✅ **Phase 6: Batch Version Updates** (Eliminates sequential queries)

---

## Risk Mitigation

- **Rollback Strategy:** Track all created IDs in arrays, delete in reverse order if any batch fails
- **Error Handling:** Provide detailed error messages indicating which batch failed
- **Validation:** Verify batch sizes don't exceed Supabase limits (typically 1000 rows per insert)
- **Testing:** Test with 36 recipes to ensure all batches work correctly

---

## Success Metrics

- ✅ Save time reduced from 5-10s → 1-2s
- ✅ Zero timeout errors
- ✅ All recipes created successfully
- ✅ User sees immediate feedback

