# Quote Builder Master-First Implementation - Quick Start

## Overview

The Quote Builder has been refined to provide a **master-only experience** for the commercial team when the `NEXT_PUBLIC_FEATURE_MASTER_PRICING=true` feature flag is enabled.

**Key Principle**: Commercial users see and work exclusively with **master recipes**, never variants. All complexity of variant management is hidden.

---

## How It Works: Two Modes

### Mode 1: Variants Only (Default - masterPricingEnabled = false)

**Current behavior** - No changes:
- Catalog shows variants (individual recipe codes)
- Users select specific variants by code
- Each variant has its own price
- Example: `5-250-2-B-28-14-B-3-00M` or `5-250-2-B-28-14-B-2-PCM`

### Mode 2: Masters Only (New - masterPricingEnabled = true)

**New behavior** - Completely master-centric:
- Catalog shows only masters grouped by strength → slump → placement
- Users select a master, not a variant
- One master price applies to all variants
- Example: User selects master `5-250-2-B-28-14-B` (no variant suffix)
- Internally: system picks the first available variant for cost calculation

---

## Commercial Team Workflow (with Masters Enabled)

### Step 1: Browse Catalog

```
Left Panel: "Catálogo de Maestros"
├── f'c: 250 kg/cm²
│   ├── Revenimiento: 14 cm
│   │   └── [Master Card] 5-250-2-B-28-14-B
│   │       - Tamaño máx: 20 mm
│   │       - Colocación: Bombeado
│   │       - [Agregar a Cotización]
```

**What's NOT shown**: No variant suffixes like `3-00M`, `2-PCM`, `DIA`, etc.

### Step 2: Add to Quote

User clicks "Agregar a Cotización" on a master card.

**Behind the scenes**:
1. ✅ Validates same plant constraint
2. ✅ Prevents duplicate masters in same quote
3. ✅ Fetches linked variants for this master
4. ✅ **Resolves base price** (in order):
   - Try: Master price scoped to (client + site)
   - Fallback: Master price scoped to client only
   - Fallback: Global master price
   - Fallback: Compute from first variant's materials + cost-based formula
5. ✅ Applies 4% minimum margin, rounds to nearest 5
6. ✅ Adds item to quote with `master_recipe_id` + internal variant reference

### Step 3: View Quoted Items

**Right Panel: "Productos de la Cotización"**

| When masterPricingEnabled=true | Shows |
|---|---|
| Display name | Master code (e.g., `5-250-2-B-28-14-B`) |
| Editable fields | Volume, Base Price, Margin %, Final Price |
| Remove button | ✅ Yes |

**No variant confusion**: Commercial team never sees or thinks about `3-00M` or `2-PCM`.

### Step 4: Save Quote

When saved, `quote_details` includes:
- `recipe_id`: Internal variant ID (for production traceability)
- `master_recipe_id`: Master ID (for pricing)
- Prices and volumes as edited

---

## Quote Tabs Display (Draft / Pending / Approved)

All three quote tabs automatically show **master codes instead of variant codes** when `masterPricingEnabled=true`:

**List View**: Summary shows master codes
```
Quote #COT-2025-0042
├── 5-250-2-B-28-14-B - 15m³
├── 5-300-2-B-07-18-D - 8m³
└── 5-200-2-D-28-10-B - 12m³
```

**Details Modal**: Table header
```
| Maestro | Colocación | f'c | Volumen | ... |
|---------|------------|-----|---------|-----|
| 5-250-2-B-28-14-B | Bombeado | 250 | 15 | ... |
```

---

## Base Price Resolution Logic

When adding a master to a quote:

```
┌─ Try Master Price (Scoped to Client + Site)
│  └─ SELECT WHERE master_recipe_id = X 
│           AND client_id = Y 
│           AND construction_site = Z
│  └─ If found → Use it ✓
│
├─ Try Master Price (Scoped to Client only)
│  └─ SELECT WHERE master_recipe_id = X 
│           AND client_id = Y 
│           AND construction_site IS NULL
│  └─ If found → Use it ✓
│
├─ Try Global Master Price
│  └─ SELECT WHERE master_recipe_id = X 
│           AND client_id IS NULL 
│           AND construction_site IS NULL
│  └─ If found → Use it ✓
│
└─ Fallback: Cost-Based Calculation
   └─ Get first variant's materials
   └─ Sum costs + admin overhead
   └─ Apply 4% minimum margin
   └─ Round to nearest 5
```

---

## Feature Flag Control

**Enable/Disable Master-First Mode:**

```bash
# .env.local or deployment config
NEXT_PUBLIC_FEATURE_MASTER_PRICING=true    # Masters only
NEXT_PUBLIC_FEATURE_MASTER_PRICING=false   # Variants only (default)
```

**Behavior Changes:**
| Setting | Catalog | Item Display | Pricing Source |
|---------|---------|--------------|-----------------|
| `false` | Variants | Variant code | Variant price |
| `true` | Masters | Master code | Master price (with fallback) |

---

## Implementation Details for Developers

### Files Modified

1. **src/components/prices/QuoteBuilder.tsx**
   - Added `features` import and `masterPricingEnabled` check
   - New `resolveMasterPrice()` function for scoped price lookup
   - New `addMasterToQuote()` function for master-based item creation
   - UI switches to masters catalog when flag enabled
   - Items display master code instead of recipe code
   - Save flow includes `master_recipe_id` in details

2. **src/components/quotes/DraftQuotesTab.tsx**
   - Added `master_recipes` to query
   - Included `master_code` in detail mapping
   - Updated display to show master code when available

3. **src/components/quotes/ApprovedQuotesTab.tsx**
   - Added `master_recipes` to query
   - Included `master_code` in detail mapping
   - Updated table to show master code

4. **src/components/quotes/PendingApprovalTab.tsx**
   - Added `master_recipes` to query
   - Included `master_code` in detail mapping
   - Updated all displays (list, table, detail card)

### Database Schema

**quote_details table:**
- `master_recipe_id` (UUID): Links to master_recipes table
- `recipe_id` (UUID): Links to recipes table (variant, kept for traceability)
- Other fields unchanged

**Queries fetch:**
```sql
SELECT 
  qd.*,
  master_recipes(master_code)
FROM quote_details qd
LEFT JOIN master_recipes ON qd.master_recipe_id = master_recipes.id
```

---

## Transition Plan

### Phase 1: Infrastructure Ready ✅
- Masters loaded in QuoteBuilder
- Master-first UI renders when flag enabled
- Base price resolution working
- Quote details save `master_recipe_id`

### Phase 2: Price Consolidation (Manual via UI)
- Use `/masters/pricing` page to create master prices
- Resolve conflicts per client/site
- Activate master prices in `product_prices` table

### Phase 3: Rollout to Commercial
- Enable `NEXT_PUBLIC_FEATURE_MASTER_PRICING=true`
- Commercial team uses masters only
- Monitor pricing accuracy

### Phase 4: Archive Variant UI (Optional)
- Remove variant catalog option entirely
- Variant management moves to recipes page (for production only)

---

## Troubleshooting

### Issue: Quote shows variant code instead of master code

**Check:**
- Is `NEXT_PUBLIC_FEATURE_MASTER_PRICING=true`?
- Does the quote detail have `master_recipe_id` set?
- Refresh the page and re-fetch quotes

### Issue: Base price is missing when adding master

**Check:**
1. Are variants linked to this master? (`recipes.master_recipe_id` set)
2. Is there a master price defined for this client/site?
3. Do variants have material data for cost-based fallback?

### Issue: Plant consistency error

**Reason:** User tried to add a master from a different plant to the same quote

**Fix:** Start a new quote for a different plant

---

## Benefits

✅ **Simpler UI**: Commercial team focuses on master specifications, not variant codes
✅ **Cleaner Pricing**: One master price covers all variants
✅ **No Errors**: Prevents mismatches between variant and price
✅ **Backward Compatible**: Variants still exist for production (Arkik)
✅ **Flexible**: Can disable flag anytime to revert to variant mode

---

## Next Steps

1. **Enable flag** in production: `NEXT_PUBLIC_FEATURE_MASTER_PRICING=true`
2. **Train commercial team** on new master-only workflow
3. **Consolidate prices** using `/masters/pricing` UI
4. **Monitor orders** to ensure correct pricing
5. **Archive variant UI** (optional, when comfortable)

