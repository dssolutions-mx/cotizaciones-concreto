# IVA-Based Auto-Approval Implementation

## Summary

Successfully implemented conditional auto-approval thresholds based on IVA (receipt) requirements in the quote builder system.

## Changes Made

### 1. ✅ Updated Auto-Approval Logic (`src/services/quotes.ts`)

**Location**: Lines 329-344

**Changes**:
- Added IVA detection logic that checks if all quote details require IVA
- Implemented conditional threshold: 8% for quotes with IVA, 14% for quotes without IVA
- Updated auto-approval decision to use the appropriate threshold based on IVA status

**Code**:
```typescript
// Determine IVA status from details
const requiresIVA = quoteData.details.length > 0 && quoteData.details.every(d => d.includes_vat);

// Conditional auto-approval threshold based on IVA status
// With IVA (requires receipt): 8% margin
// Without IVA (no receipt): 14% margin
const autoApprovalThreshold = requiresIVA ? 8.0 : 14.0;
const shouldAutoApprove = marginPercentage >= autoApprovalThreshold;
const initialStatus = shouldAutoApprove ? 'APPROVED' : 'PENDING_APPROVAL';
```

### 2. ✅ Updated Success Messages (`src/components/prices/QuoteBuilder.tsx`)

**Location**: Lines 915-921

**Changes**:
- Modified toast success message to display the correct threshold (8% or 14%) used for auto-approval
- Message now reflects whether the quote was approved with IVA requirements or without

**Code**:
```typescript
const thresholdUsed = includesVAT ? 8 : 14;
const statusMessage = isAutoApproved 
  ? `Cotización ${createdQuote.quote_number} creada y auto-aprobada (margen >= ${thresholdUsed}%)`
  : `Cotización ${createdQuote.quote_number} creada y pendiente de aprobación (margen < ${thresholdUsed}%)`;
```

### 3. ✅ Added UI Guidance for IVA Toggle (`src/components/prices/QuoteBuilder.tsx`)

**Location**: Lines 1751-1778

**Changes**:
- Added an informative blue callout box below the IVA checkbox
- The message dynamically updates when users toggle the IVA checkbox
- Explains the auto-approval threshold (8% vs 14%) based on current IVA selection
- Uses Info icon for visual clarity

**UI Features**:
- **With IVA checked**: Shows "Con IVA (requiere factura): Auto-aprobación al 8% de margen"
- **Without IVA checked**: Shows "Sin IVA (sin factura): Auto-aprobación al 14% de margen"
- Subtle, professional design using blue color scheme
- Positioned directly below the IVA checkbox for immediate visibility

### 4. ✅ Added Visual Margin Status Indicator (`src/components/prices/QuoteBuilder.tsx`)

**Location**: Lines 1876-1918 (in the quote summary section)

**Changes**:
- Added a prominent status banner in the quote products section
- Shows current average margin and required threshold
- Color-coded status:
  - **Green**: Meets threshold, will be auto-approved ✅
  - **Amber**: Close to threshold (within 2%), needs attention ⚠️
  - **Red**: Below threshold, requires manual approval ❌
- Displays gap to threshold when not meeting requirements

**Visual States**:
1. **Auto-Approved (Green)**:
   - "Esta cotización será auto-aprobada"
   - Shows margin and threshold
   
2. **Close to Threshold (Amber)**:
   - "Cerca del umbral de auto-aprobación"
   - Encourages user to adjust margin
   
3. **Requires Approval (Red)**:
   - "Requiere aprobación manual"
   - Shows how much margin is missing

## Testing Scenarios

### Test Case 1: With IVA Checked (8% Threshold)

**Setup**: Check the "Incluir IVA" checkbox

| Margin | Expected Result | Expected Status |
|--------|----------------|-----------------|
| 7.0%   | Pending Approval | Red indicator, "Requiere aprobación manual (faltan 1.0%)" |
| 7.5%   | Pending Approval | Amber indicator, "Cerca del umbral" |
| 8.0%   | Auto-Approved | Green indicator, "Esta cotización será auto-aprobada" |
| 10.0%  | Auto-Approved | Green indicator, "Esta cotización será auto-aprobada" |

**Expected Toast**: "Cotización ... creada y auto-aprobada (margen >= 8%)" or "... pendiente de aprobación (margen < 8%)"

**Expected Guidance**: "Con IVA (requiere factura): Auto-aprobación al 8% de margen"

### Test Case 2: Without IVA Checked (14% Threshold)

**Setup**: Uncheck the "Incluir IVA" checkbox

| Margin | Expected Result | Expected Status |
|--------|----------------|-----------------|
| 10.0%  | Pending Approval | Red indicator, "Requiere aprobación manual (faltan 4.0%)" |
| 12.5%  | Pending Approval | Amber indicator, "Cerca del umbral" |
| 14.0%  | Auto-Approved | Green indicator, "Esta cotización será auto-aprobada" |
| 16.0%  | Auto-Approved | Green indicator, "Esta cotización será auto-aprobada" |

**Expected Toast**: "Cotización ... creada y auto-aprobada (margen >= 14%)" or "... pendiente de aprobación (margen < 14%)"

**Expected Guidance**: "Sin IVA (sin factura): Auto-aprobación al 14% de margen"

### Test Case 3: Real-Time Updates

**Test Steps**:
1. Add products to quote with 10% margin
2. Toggle IVA checkbox ON → Should show amber/red (below 8% threshold)
3. Toggle IVA checkbox OFF → Should show green (meets 14% threshold)
4. Observe visual indicator updating in real-time
5. Observe guidance message updating immediately

**Expected Behavior**: 
- Visual indicator should update color and text immediately
- Guidance box should show correct threshold
- No page refresh needed

### Test Case 4: Edge Cases

1. **Multiple Products with Different Margins**:
   - Add 3 products: 6%, 8%, 10% margins (average = 8%)
   - With IVA: Should auto-approve (exactly at threshold)
   - Without IVA: Should require approval (below 14%)

2. **Pump Service Only**:
   - Create quote with only pump service
   - Verify IVA toggle still works
   - Verify guidance still displays correctly

3. **Mixed IVA Status** (future consideration):
   - Current implementation: Uses `every()` check, so ALL products must have IVA for it to apply 8% threshold
   - If ANY product doesn't have IVA, it applies 14% threshold
   - This is intentional business logic

## User Experience Improvements

### Before Implementation
- ❌ Fixed 8% auto-approval threshold for all quotes
- ❌ No guidance on IVA impact
- ❌ No real-time feedback on approval status
- ❌ Users unaware of different thresholds for IVA vs non-IVA

### After Implementation
- ✅ Smart conditional thresholds (8% with IVA, 14% without IVA)
- ✅ Clear guidance below IVA checkbox
- ✅ Real-time visual feedback on approval status
- ✅ Color-coded indicators (green/amber/red)
- ✅ Exact information on how close to threshold
- ✅ Users can optimize margins to leverage auto-approval

## Business Impact

1. **Efficiency**: More quotes (especially non-IVA) can be auto-approved at 14% threshold, reducing manual approval bottleneck

2. **Transparency**: Users understand exactly what margin is needed for auto-approval

3. **Accuracy**: Auto-approval logic now matches business requirements based on receipt needs

4. **User Empowerment**: Sales team can make informed decisions about margins to leverage auto-approval

## Technical Notes

### IVA Detection Logic
```typescript
const requiresIVA = quoteData.details.length > 0 && quoteData.details.every(d => d.includes_vat);
```

This checks if **all** quote details have `includes_vat: true`. If even one product doesn't require IVA, the entire quote uses the 14% threshold. This is intentional to handle mixed-IVA scenarios conservatively.

### Margin Calculation
The average margin is calculated from all products:
```typescript
const avgMargin = quoteProducts.reduce((sum, p) => sum + p.profitMargin, 0) / quoteProducts.length * 100;
```

### Status Colors
- **Green** (`bg-green-50 border-green-200`): Margin >= threshold
- **Amber** (`bg-amber-50 border-amber-200`): Margin within 2% of threshold (e.g., 6-7.9% when threshold is 8%)
- **Red** (`bg-red-50 border-red-200`): Margin below threshold by > 2%

## Files Modified

1. ✅ `src/services/quotes.ts` - Auto-approval logic
2. ✅ `src/components/prices/QuoteBuilder.tsx` - UI enhancements and success messages

## Deployment Checklist

- [x] Code implemented
- [x] No linting errors
- [x] Business logic tested conceptually
- [ ] Manual QA testing in development environment
- [ ] Test with real data scenarios
- [ ] User acceptance testing
- [ ] Production deployment

## Known Considerations

1. **Mixed IVA Quotes**: If a quote has both IVA and non-IVA products, the logic currently applies 14% threshold (more conservative). This may need adjustment based on business requirements.

2. **Database Storage**: The auto-approval decision is made at quote creation time. If IVA rules change, existing quotes won't be retroactively affected.

3. **Visual Updates**: The margin status indicator updates in real-time as users edit products or toggle IVA, providing immediate feedback.

## Success Metrics

After deployment, monitor:
- % of quotes auto-approved (should increase for non-IVA quotes)
- User feedback on guidance clarity
- Manual approval queue size (should decrease)
- Average time to quote approval

---

**Implementation Date**: January 5, 2026
**Implemented By**: AI Assistant
**Status**: ✅ Complete - Ready for Testing

