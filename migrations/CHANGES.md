# Changes to Support Client-Specific Pricing Per Construction Site

## Overview

Previously, the system was setting active prices based on client and recipe combinations. The updated logic now sets active prices based on client, recipe, AND construction site combinations. This allows for more granular pricing control where the same client can have different prices for the same product at different construction sites.

## Changes Made

1. **Database Schema**:
   - Added `construction_site` column to the `product_prices` table
   - Created an index on `client_id`, `recipe_id`, and `construction_site` for faster lookups

2. **Product Prices Service**:
   - Updated `ProductPriceData` interface to include `construction_site` field
   - Modified `deactivateExistingPrices` function to consider construction site
   - Updated `handleQuoteApproval` function to include construction site data from the quote
   - Enhanced `createNewPrice` function to log and store construction site information

3. **Price Service**:
   - Updated `saveProductPrice` function to include optional `constructionSite` and `clientId` parameters
   - Modified `getActiveProducts` function to allow filtering by client ID and construction site

4. **Quotes Service**:
   - Fixed linter errors by adding the `Client` interface
   - Updated data handling to properly handle null cases
   - Implemented direct calculations for final price and total amount

## How It Works Now

1. When a quote is approved, the system deactivates existing prices for the specific client-recipe-construction site combination.
2. New price records are created with the construction site information included.
3. When retrieving active products, you can now filter by both client ID and construction site.
4. The product description now includes the construction site information for better identification.

## Migration Steps

1. Run the database migration:
   - `add_construction_site_to_product_prices.sql`
2. Deploy the updated code to your environment
3. Restart the application to ensure all changes take effect

## Testing

After implementing these changes, you should test:
1. Creating and approving quotes with construction site information
2. Verifying that prices are correctly associated with the construction site
3. Retrieving prices filtered by construction site
4. Ensuring that the same client can have different prices for the same product at different construction sites 