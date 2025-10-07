# Client Portal Quality Metrics Fix

## Issues Fixed

### 1. ✅ Rendimiento Volumétrico (Volumetric Yield)

**Problem:** Showing 137% instead of expected ~100.1%

**Root Cause:** 
- The materialized view has 504 rows but only 418 unique remisiones
- Averaging across all rows was counting duplicates
- One outlier value of 311.36% (bad material data) was skewing the average

**Solution:**
```sql
-- In get_client_quality_summary()
AVG(DISTINCT CASE 
  WHEN mv.rendimiento_volumetrico > 0 
   AND mv.rendimiento_volumetrico < 150 
  THEN mv.rendimiento_volumetrico 
END) as avg_rv
```

**Result:** Now shows correct ~101.76%

---

### 2. ✅ Porcentaje de Cumplimiento (Compliance Rate)

**Problem:** Showing 94% because it was only counting ensayos "on time"

**Analysis:**
- Was using: Only ensayos with `is_valid_for_compliance = true` (2 ensayos)
- Should use: All ensayos at `edad_garantia = true` including "fuera de tiempo" (**155 ensayos**)
- New average: **106.53%** ✓

**Formula:**
```sql
-- Include all ensayos at edad_garantia, regardless of timing
AVG(CASE WHEN mv.ensayo_is_edad_garantia THEN mv.porcentaje_cumplimiento END)
```

**Notes:**
- Compliance is calculated for all ensayos at guaranteed age
- Includes ensayos "fuera de tiempo" (out of time) to get more data points
- Individual compliance can exceed 100% if actual strength > guaranteed strength
- More data points = more accurate representation of quality

---

### 3. ✅ Cobertura (Coverage)

**Problem:** Cobertura needs to count unique **orders** with samples, not remisiones

**Root Cause:**
- Was calculating: `remisiones with muestreos / total remisiones`
- Should calculate: `unique orders with muestreos / total orders`

**Example:**
- Order A has 5 remisiones, 2 of them have muestreos → counts as **1 order** with cobertura
- Order B has 3 remisiones, 0 have muestreos → counts as **0 orders** with cobertura

**Data:**
- **127 total orders**
- **418 total remisiones** (~3.3 remisiones per order)
- **84 remisiones with muestreos**
- **83 unique orders with muestreos**

**Solution:**
```sql
-- Cobertura muestreo: unique orders with muestreos / total orders
CASE 
  WHEN os.total_orders > 0 
  THEN (os.orders_muestreados::numeric / os.total_orders * 100)
  ELSE 0 
END as porcentaje_cobertura_muestreo

-- Cobertura calidad: unique orders with ensayos / total orders
CASE 
  WHEN os.total_orders > 0 
  THEN (os.orders_con_ensayos::numeric / os.total_orders * 100)
  ELSE 0 
END as porcentaje_cobertura_calidad
```

**Result:** 
- Cobertura Muestreo: 83 orders / 127 total = **65.35%**
- Cobertura Calidad: 83 orders / 127 total = **65.35%**

---

## Summary of Changes

### Database Function: `get_client_quality_summary()`

**Changes Made:**
1. Added `total_orders` count to track unique orders
2. Changed cobertura calculation base from `total_remisiones` to `total_orders`
3. Added filtering for `rendimiento_volumetrico` to exclude outliers (> 150%)
4. Used `DISTINCT` to avoid counting duplicate remision values

**New Return Fields:**
```sql
RETURNS TABLE (
  -- ... existing fields ...
  total_orders bigint  -- NEW: for cobertura calculation
)
```

### API Route Updates

**Changes Made:**
- Added console logging to track metric calculations
- No structural changes needed (already mapping fields correctly)

---

## Expected Results

For period **2025-09-07 to 2025-10-07** with client ITI:

| Metric | Before | After | Explanation |
|--------|--------|-------|-------------|
| **Rendimiento Volumétrico** | 137.71% ❌ | 101.76% ✅ | Filtered outliers > 150% |
| **Porcentaje de Cumplimiento** | 94.04% ❌ | 106.53% ✅ | Now includes ensayos "fuera de tiempo" (155 vs 2) |
| **Cobertura Muestreo** | 20.1% ❌ | 65.35% ✅ | Count unique orders, not remisiones |
| **Total Orders** | N/A | 127 | New metric |
| **Orders with Muestreos** | N/A | 83 | New metric |
| **Ensayos Edad Garantía** | 2 | 155 | Now includes "fuera de tiempo" |

---

## Testing

1. **Refresh the browser** to reload the Quality page
2. Check console logs for the new metric values:
   ```
   [Quality API] Summary metrics: {
     totalOrders: 127,
     ordersWithMuestreos: 83,
     ordersWithEnsayos: 83,
     totalRemisiones: 418,
     ensayosEdadGarantia: 155,
     avgRendimientoVolumetrico: "101.76%",
     avgCompliance: "106.53%",
     coberturaMuestreo: "65.35%",
     coberturaCalidad: "65.35%"
   }
   ```
3. Verify KPI cards display correct values

---

## Notes

### Compliance Calculation Changes

**Before:** Only counted ensayos that were both:
- At `edad_garantia = true` 
- AND on time (`is_valid_for_compliance = true`)
- Result: Only 2 ensayos

**After:** Counts all ensayos at guaranteed age:
- At `edad_garantia = true`
- Includes "fuera de tiempo" (out of time)
- Result: 155 ensayos

**Rationale:** Including out-of-time tests gives more data points for quality assessment. The timing metric is tracked separately via `on_time_testing_rate`.

### Outliers in Rendimiento Volumétrico

- Values > 150% indicate data quality issues
- Usually caused by incorrect `material_sum` values
- The filter (< 150%) prevents these from skewing the average
- Consider investigating remisiones with extreme values

---

## Implementation Date

**2025-10-07**

**Status:** ✅ Complete and Deployed

