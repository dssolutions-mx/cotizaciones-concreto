# Debug Arkik Validator Testing Guide

## 🎯 Purpose

The Debug Arkik Validator is a simplified, step-by-step validation system designed to help debug and understand the core validation logic without complex UI interference.

## 🚀 How to Use

### Option 1: Dedicated Debug Page
Visit: `/arkik/debug`

This provides a clean, focused environment for testing the core validation logic with:
- Simple file upload
- Step-by-step validation processing (limited to first 5 rows)
- Detailed debug logging in terminal-style output
- Clear result display

### Option 2: Debug Mode in Main Processor
On the main `/arkik` page:
1. Enable "Modo debug (logging detallado)" checkbox
2. Upload your Excel file normally
3. The validation will use the debug validator instead
4. Detailed logs will appear below the validation table

## 🔍 What the Debug Validator Tests

### Step 1: Recipe Lookup
- **Primary**: Uses `product_description` (arkik_long_code)
- **Fallback**: Uses `recipe_code` (prod_tecnico)
- **Strategy**: Exact match → Fuzzy match → Error

**Debug Output Shows:**
- Input codes being searched
- Database query results
- Match attempts and results
- Success/failure reasons

### Step 2: Unified Pricing
- **Product Prices**: Active prices for the plant
- **Approved Quotes**: Quotes with status='APPROVED' (CRITICAL addition)
- **Strategy**: Load both sources and merge

**Debug Output Shows:**
- Number of prices loaded
- Number of quotes loaded
- Total pricing options available
- Individual pricing details (client, site, price, source)

### Step 3: Client/Site Matching
- **Client Matching**: Uses `cliente_name` (IGNORES `cliente_codigo`)
- **Site Matching**: Uses `obra_name`
- **Strategy**: Similarity scoring with exact → substring → word overlap

**Debug Output Shows:**
- Input client and site names
- Similarity scores for each pricing option
- Best match selection reasoning
- Final assignments

## 🧪 Testing Strategy

### 1. Start Simple
Test with 1-2 rows first to understand the flow:
```
Row 1: Known recipe + known client + known site
Row 2: Unknown recipe (to test error handling)
```

### 2. Test Core Components
- **Recipe Lookup**: Try variations of recipe codes
- **Price Discovery**: Ensure both prices and quotes are found
- **Client Detection**: Test with abbreviated vs full client names

### 3. Common Test Cases
- **Perfect Match**: Recipe exists, exact client/site match in pricing
- **Fuzzy Match**: Recipe with slight variations, similar client names
- **Quote Fallback**: Recipe that only exists in approved quotes
- **No Pricing**: Recipe exists but no prices/quotes configured
- **Unknown Recipe**: Recipe code not in database

## 📝 Reading Debug Logs

### Log Format
```
[HH:MM:SS] Message
```

### Key Sections to Watch
1. **Recipe Search**: `Looking for recipe with:`
2. **Pricing Load**: `Loading unified pricing for recipe`
3. **Matching**: `Scoring option:`
4. **Final Result**: `Row validated successfully`

### Success Indicators
- ✅ Green checkmarks indicate successful operations
- ❌ Red X marks indicate failures
- ⚠️ Yellow warnings indicate issues but not failures

### Common Issues to Debug
- **Recipe Not Found**: Check if recipe codes match database exactly
- **No Pricing**: Recipe found but no prices or quotes configured
- **Poor Matching**: Client/site names too different from pricing data

## 🔧 What to Look For

### Expected Behavior
1. **Recipe Matching**: Should find recipes even with slight variations
2. **Price Loading**: Should load BOTH product_prices AND quotes
3. **Client Detection**: Should match client names intelligently
4. **Site Assignment**: Should assign sites based on pricing data

### Red Flags
- Zero pricing options loaded (indicates missing quotes integration)
- Always failing client matches (indicates client code vs name issue)
- Recipe exact matches failing (indicates normalization problems)

## 🎯 Key Validation Points

### Recipe Strategy
- Primary: `product_description` (Arkik long code)
- Fallback: `recipe_code` (technical code)
- **Never** use only technical codes without trying long codes first

### Client Strategy  
- **Use**: `cliente_name` for matching
- **Ignore**: `cliente_codigo` (unreliable in Excel)
- **Match**: Against `business_name` in database

### Pricing Strategy
- **Load**: Both `product_prices` AND `quote_details`
- **Prioritize**: Prices over quotes, newer over older
- **Match**: Client and site similarity scoring

## 📊 Success Metrics

### Good Results
- 90%+ recipe match rate
- 80%+ client auto-detection
- Mixed price sources (both prices and quotes used)
- Clear debug reasoning for each decision

### Concerning Results
- Low recipe match rates (check normalization)
- No quote-sourced pricing (check quotes integration)
- Poor client detection (check similarity algorithms)
- Frequent "fallback" decisions (check input data quality)

## 🚨 Troubleshooting

### No Recipes Found
1. Check plant selection is correct
2. Verify recipe codes in database match Excel format
3. Test normalization (spaces, dashes, accents)

### No Pricing Found
1. Verify both `product_prices` AND `quotes` are loaded
2. Check if quotes have `status='APPROVED'`
3. Ensure `plant_id` matches correctly

### Poor Client Matching
1. Check if using `cliente_name` not `cliente_codigo`
2. Test with known good client names
3. Verify client similarity algorithm

---

**Remember**: This debug system is designed to reveal exactly what's happening at each step. Use the detailed logs to understand why validation succeeds or fails, then apply those insights to improve the main system.
