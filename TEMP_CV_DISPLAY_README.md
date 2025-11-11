# Temporary CV Breakdown Display - GRUPO INMOBICARPIO DEL BAJIOxxxx

## Overview

This document explains the temporary hardcoded CV (Coefficient of Variation) breakdown values displayed in the client portal for GRUPO INMOBICARPIO DEL BAJIO.

## Purpose

To provide a visual example of how the per-recipe CV breakdown will look in the client portal, using real data from the manual report provided to this client.

## Implementation Details

### Location

**File:** `src/components/client-portal/quality/QualitySummary.tsx`

### Hardcoded Values

The following values from the client's manual report are temporarily displayed:

#### Overall Weighted CV

- **14.60%** - Calculated as weighted average: `(9.26×2 + 7.16×2 + 20.19×18 + 15.27×15 + 3.98×8) / 45 = 14.60%`

#### Per-Recipe Breakdown

**FC' = 150 kg/cm²**

- **3 días**: CV 9.26% (n=2 muestras) - Promedio 165.65, σ 15.34
- **28 días**: CV 7.16% (n=2 muestras) - Promedio 175.95, σ 12.60

**FC' = 200 kg/cm²**

- **3 días**: CV 20.19% (n=18 muestras) - Promedio 212.13, σ 42.83
- **7 días**: CV 15.27% (n=15 muestras) - Promedio 245.24, σ 37.44
- **28 días**: CV 3.98% (n=8 muestras) - Promedio 255.46, σ 10.16

### Code Logic

```typescript
const isInmobicarpio = summary.clientInfo.business_name === 'GRUPO INMOBICARPIO DEL BAJIO';

const tempCvByRecipe = isInmobicarpio && !summary.averages.cvByRecipe ? [
  // Hardcoded per-recipe values here
] : summary.averages.cvByRecipe;

// Calculate weighted average CV from the breakdown
const tempOverallCV = isInmobicarpio && tempCvByRecipe ? (() => {
  const totalWeight = tempCvByRecipe.reduce((sum, r) => sum + r.muestreoCount, 0);
  const weightedSum = tempCvByRecipe.reduce((sum, r) => sum + (r.coefficientVariation * r.muestreoCount), 0);
  return weightedSum / totalWeight;
})() : summary.averages.coefficientVariation;
```

### Visual Indicators

- **Main CV Card**: Shows "Demo" label in blue next to the CV percentage value
- **Subtitle**: Shows "(Promedio Ponderado)" to indicate it's calculated from the breakdown
- **Per-Recipe Section**: Shows "Ejemplo" label in blue next to "Por Receta:" header
- Only appears when viewing GRUPO INMOBICARPIO DEL BAJIO's quality portal
- Only shows if real API data is not available (`!summary.averages.cvByRecipe`)

## When to Remove

### Option 1: Remove After Testing

Once the API integration is complete and real data is flowing:

1. Remove the `tempCvByRecipe` constant
2. Replace all references back to `summary.averages.cvByRecipe`
3. Remove the "Ejemplo" label logic

### Option 2: Keep Until Data Syncs

If you want to keep it until historical data is fully populated:

- The code already checks `!summary.averages.cvByRecipe`
- When real data becomes available, it will automatically use that instead
- The hardcoded values serve as a fallback

## Removal Instructions

Search for this comment in the codebase:

```typescript
// TEMPORARY: Use hardcoded example data from GRUPO INMOBICARPIO DEL BAJIO report
```

And remove the entire `tempCvByRecipe` logic block, replacing references with:

```typescript
summary.averages.cvByRecipe
```

## Data Source

- **Client:** GRUPO INMOBICARPIO DEL BAJIO (Client Code: 110)
- **Report Date:** Manual statistical analysis report
- **Methodology:** Per-muestreo CV calculation (matches our implementation)
- **Screenshot Reference:** Provided on October 15, 2025

## Notes

- These values represent actual quality control data for this client
- The calculation methodology matches our database implementation exactly
- Values are based on muestreo averages (not individual ensayos)
- Only edad_garantia (guarantee age) ensayos are used

---

**Created:** October 15, 2025
**Purpose:** Visual demonstration and client presentation
**Status:** Temporary - Remove when real API data is available
