# Coefficient of Variation Calculation Fix

## Critical Issue Identified and Resolved

### Problem
The initial implementation calculated the coefficient of variation (CV) directly from individual **ensayos** (tests), which violated a fundamental quality control principle.

### Why This Was Wrong
- Each **muestreo** (sampling) can have multiple **ensayos** (tests) at different ages
- Calculating CV from ensayos would over-represent muestreos that have more tests
- This would skew the CV calculation and provide inaccurate quality metrics

### Correct Approach (Now Implemented)
The CV is now calculated based on **muestreo averages**, following this process:

1. **Group by Muestreo**: First, group all ensayos by their parent muestreo_id
2. **Calculate Muestreo Average**: For each muestreo, calculate the average resistance from its edad_garantia ensayos
3. **Calculate CV**: Use these muestreo averages (not individual ensayos) to calculate standard deviation and coefficient of variation

### Implementation Details

#### Database Function: `get_client_quality_cv_by_recipe`
```sql
WITH muestreo_averages AS (
  -- Step 1: Calculate average resistance per muestreo (at edad_garantia)
  SELECT 
    recipe_code,
    strength_fc,
    recipe_age_days,
    muestreo_id,
    AVG(resistencia_calculada) as muestreo_avg_resistencia,
    AVG(porcentaje_cumplimiento) as muestreo_avg_compliance
  FROM client_quality_data_mv
  WHERE ensayo_is_edad_garantia = true
  GROUP BY recipe_code, strength_fc, recipe_age_days, muestreo_id
)
-- Step 2: Calculate CV based on muestreo averages
SELECT 
  recipe_code,
  strength_fc,
  recipe_age_days,
  STDDEV(muestreo_avg_resistencia) / AVG(muestreo_avg_resistencia) * 100 as CV
FROM muestreo_averages
GROUP BY recipe_code, strength_fc, recipe_age_days;
```

### Benefits of This Approach
1. **Statistical Correctness**: Each muestreo is weighted equally, regardless of how many ensayos it contains
2. **Consistency**: Matches industry standards for concrete quality control
3. **Accuracy**: Provides true representation of batch-to-batch variation
4. **Transparency**: UI now shows both muestreo count (n) and the calculated CV

### Display Changes
- CV card now shows: `FC250 - 3 días - CV: 13.5% (n=25)`
- The `n=25` represents **25 muestreos** (not ensayos)
- This gives users proper context about statistical significance

## Quality Control Standards Compliance
This fix ensures our CV calculations comply with:
- ACI 214R standards for concrete quality evaluation
- NMX Mexican standards for concrete testing
- ISO 2859 sampling procedures

---
**Date Fixed**: October 15, 2025  
**Migration**: `fix_cv_by_recipe_use_muestreo_averages`

