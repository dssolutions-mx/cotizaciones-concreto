# Master Recipe Detection - Debug & Fix Summary

## Problem
When creating new recipes in the calculator, only 1 master recipe was being shown in the dropdown even though 4 masters exist with the same core specifications.

## Root Causes Identified & Fixed

### 1. **Incomplete Master Fetching** ✅
**Problem**: The calculator was only fetching master recipes that had existing recipe variants, not standalone masters without variants.

**Fix**: 
- Query master_recipes table directly with same core specs
- Fetch BOTH:
  - Masters that have recipe variants already
  - Masters that have no variants yet
- Combine both lists in `allCandidates`

### 2. **Placement Type Conversion** ✅
**Problem**: The calculator uses 'D'/'B' notation but database uses 'DIRECTO'/'BOMBEADO'

**Fix**:
- Added conversion: `r.placement === 'D' ? 'DIRECTO' : 'BOMBEADO'`
- Applied to both recipes and masters queries

### 3. **Age Filtering** ✅
**Problem**: Masters with different ages were being included

**Fix**:
- Added proper age filtering after fetch:
  - For 'D' unit: check `age_days === r.age AND age_hours = 0`
  - For 'H' unit: check `age_hours === r.age AND age_days = 0`

## Implementation Changes

### File: `src/components/calculator/ConcreteMixCalculator.tsx`

**Enhanced Preflight Query:**
```typescript
// 1. Query recipes with same core specs (includes master data via join)
const { data: sameSpecs } = await supabase
  .from('recipes')
  .select('id, recipe_code, ..., master_recipes:master_recipe_id(id, master_code)')
  .eq('plant_id', currentPlant.id)
  .eq('strength_fc', r.strength)
  .eq('placement_type', r.placement === 'D' ? 'DIRECTO' : 'BOMBEADO')
  .eq('max_aggregate_size', r.aggregateSize)
  .eq('slump', r.slump);

// 2. Query masters directly with same core specs
const { data: sameMasters } = await supabase
  .from('master_recipes')
  .select('id, master_code, ...')
  .eq('plant_id', currentPlant.id)
  .eq('strength_fc', r.strength)
  .eq('placement_type', r.placement === 'D' ? 'DIRECTO' : 'BOMBEADO')
  .eq('max_aggregate_size', r.aggregateSize)
  .eq('slump', r.slump);

// 3. Filter each by age
// 4. Combine:
//    - Recipe variants (with their linked masters)
//    - Standalone masters (no variants yet)
```

**Improved Dropdown Deduplication:**
```typescript
// Clearer deduplication logic with explicit tracking
const seenMasterIds = new Set<string>();
const uniqueMasters: any[] = [];

for (const candidate of c.sameSpecCandidates) {
  if (candidate.master_recipe_id && !seenMasterIds.has(candidate.master_recipe_id)) {
    seenMasterIds.add(candidate.master_recipe_id);
    uniqueMasters.push(candidate);
  }
}
```

## Debug Logging Added

### 1. Search Parameters Log
```
[Preflight Recipe: {code}]
{
  searchParams: {
    strength_fc: 250,
    placement_type: "DIRECTO",
    max_aggregate_size: 19,
    slump: 14,
    age: "28D"
  },
  foundMasters: 4,
  foundRecipes: 2
}
```

### 2. Age Filter Results
```
[Preflight Recipe: {code}] After age filter:
{
  mastersBeforeFilter: 4,
  mastersAfterFilter: 4,
  masters: [
    { id: "m1", code: "5-250-2-B-28-14-D-2", age_days: 28, age_hours: null },
    { id: "m2", code: "5-250-2-B-28-14-D-2", age_days: 28, age_hours: null },
    ...
  ]
}
```

### 3. Final Candidates
```
[Preflight Recipe: {code}] Final candidates:
{
  recipeVariants: 2,
  standaloneMAsters: 2,
  total: 4,
  candidates: [
    { type: "recipe", masterCode: "5-250-2-B-28-14-D-2", masterId: "m1", recipeCode: "6-250-..." },
    { type: "master", masterCode: "5-250-2-B-28-14-D-2", masterId: "m2", recipeCode: null },
    ...
  ]
}
```

### 4. Dropdown Population
```
[Conflict Row 0] Total candidates: 4, Unique masters: 4
```

## What These Logs Tell Us

✅ **If you see 4 masters in all logs** → Everything is working correctly  
❌ **If you see < 4 in foundMasters** → The query isn't matching all masters  
❌ **If you see < 4 in mastersAfterFilter** → Age filtering is too strict  
❌ **If you see 4 candidates but < 4 unique masters** → Deduplication issue  

## Testing Instructions

1. Open Browser DevTools → Console
2. Create a recipe in calculator with specs matching 4 existing masters
3. Check console logs from preflight query
4. Look for the 4 master candidates
5. Open conflicts dialog
6. Verify all 4 appear in the "Maestro" dropdown
7. Verify each has correct master_code

## Expected Result

When user creates recipe with matching core specs (F'c, Edad, Colocación, Slump, TMA):
- All 4 master recipes should appear in dropdown
- User can select any to create a new variant
- Dropdown shows unique masters (no duplicates)
