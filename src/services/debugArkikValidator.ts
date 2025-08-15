/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DEBUG ARKIK VALIDATOR
 * 
 * Simple, step-by-step validator to debug the core logic
 * Based on comprehensive_arkik_guide.md principles
 * 
 * Strategy: Recipe → Unified Pricing → Client/Site Auto-Detection
 */

import { supabase } from '@/lib/supabase/client';
import { ArkikErrorType, StagingRemision, ValidationError } from '@/types/arkik';

interface DebugPricing {
  recipe_id: string;
  client_id: string;
  construction_site: string;
  price: number;
  source: 'client' | 'client_site' | 'plant' | 'quotes';
  quote_id?: string; // Optional: only present for quotes source
  quote_detail_id?: string; // CRITICAL: Required for order creation
  business_name: string;
  client_code?: string;
}

interface DebugMatch {
  pricing: DebugPricing;
  clientScore: number;
  siteScore: number;
  quoteBonus: number;
  totalScore: number;
  reasoning: string;
}

interface BatchData {
  recipes: Map<string, any>; // keyed by normalized code
  materials: Map<string, any>; // keyed by material_code
  pricingByRecipe: Map<string, DebugPricing[]>; // keyed by recipe_id
  constructionSites: Map<string, Map<string, any>>; // keyed by client_id -> site_name -> site_data
  productPricesData: any[]; // Raw product prices data for freshness checking
  quotesData: any[]; // Raw quotes data for quote_detail_id resolution
}

export class DebugArkikValidator {
  private plantId: string;

  constructor(plantId: string) {
    this.plantId = plantId;
  }

  async validateBatch(rows: StagingRemision[]): Promise<{ 
    validated: StagingRemision[]; 
    errors: ValidationError[];
  }> {
    const validated: StagingRemision[] = [];
    const allErrors: ValidationError[] = [];

    if (rows.length === 0) {
      return { validated, errors: allErrors };
    }

    const startTime = Date.now();

    try {
      // STEP 1: Pre-load all required data in parallel batch operations
      const batchData = await this.preloadBatchData(rows);
      
      // STEP 2: Process all rows using in-memory lookups (much faster)
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          const result = this.validateSingleRowFromCache(row, batchData);
          validated.push(result.row);
          if (result.errors.length > 0) {
            allErrors.push(...result.errors);
          }
        } catch (error: any) {
          allErrors.push({
            row_number: row.row_number,
            error_type: ArkikErrorType.DATA_TYPE_ERROR,
            field_name: 'row',
            field_value: null,
            message: `Error processing row: ${error.message}`,
            recoverable: false
          });
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[DebugArkikValidator] Batch validation completed in ${Date.now() - startTime}ms`);
      }
      return { validated, errors: allErrors };

    } catch (error: any) {
      console.error('[DebugArkikValidator] Batch validation failed:', error);
      // Fallback to original method if batch fails
      return this.validateBatchFallback(rows);
    }
  }

  private async preloadBatchData(rows: StagingRemision[]): Promise<BatchData> {
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      console.log('[DebugArkikValidator] Preloading batch data...');
    }
    
    // Collect all unique codes and client names from rows
    const productCodes = new Set<string>();
    const materialCodes = new Set<string>();
    const clientNames = new Set<string>();
    
    rows.forEach(row => {
      // Recipe codes
      if (row.product_description?.trim()) productCodes.add(this.normalizeString(row.product_description.trim()));
      if (row.recipe_code?.trim()) productCodes.add(this.normalizeString(row.recipe_code.trim()));
      
      // Material codes - only add materials with non-zero values
      Object.keys(row.materials_teorico || {}).forEach(code => {
        const teoricoValue = row.materials_teorico[code];
        const realValue = row.materials_real?.[code] || 0;
        // Only add material if either teorico or real has a non-zero value
        if ((teoricoValue && teoricoValue > 0) || (realValue && realValue > 0)) {
          materialCodes.add(code);
        }
      });
      
      // Add materials from real that weren't covered above
      Object.keys(row.materials_real || {}).forEach(code => {
        const realValue = row.materials_real[code];
        if (realValue && realValue > 0) {
          materialCodes.add(code);
        }
      });
      
      // Client names for construction site lookups
      if (row.cliente_name?.trim()) clientNames.add(this.normalizeString(row.cliente_name.trim()));
    });

    if (isDevelopment) {
      console.log(`[DebugArkikValidator] Found ${productCodes.size} product codes, ${materialCodes.size} material codes (filtered from zero values), ${clientNames.size} client names`);
    }

    // Execute all queries in parallel
    const [
      recipesData,
      materialsData,
      productPricesData
    ] = await Promise.all([
      this.loadAllRecipes(),
      this.loadAllMaterials(Array.from(materialCodes)),
      this.loadAllProductPrices()
    ]);

    // Build recipe lookup maps first
    const recipes = new Map<string, any>();
    recipesData.forEach(recipe => {
      // Index by all possible codes for fast lookup
      if (recipe.arkik_long_code) {
        recipes.set(this.normalizeString(recipe.arkik_long_code), recipe);
      }
      if (recipe.recipe_code) {
        recipes.set(this.normalizeString(recipe.recipe_code), recipe);
      }
      if (recipe.arkik_short_code) {
        recipes.set(this.normalizeString(recipe.arkik_short_code), recipe);
      }
    });

    // Load quotes and construction sites in parallel
    const [quotesData, constructionSitesData] = await Promise.all([
      this.loadAllQuotes(),
      this.loadConstructionSitesForClients(Array.from(clientNames))
    ]);



    // Build materials lookup
    const materials = new Map<string, any>();
    materialsData.forEach(material => {
      materials.set(material.material_code, material);
    });

    // Build pricing lookup by recipe_id
    const pricingByRecipe = new Map<string, DebugPricing[]>();
    
    // Add product prices (PRIORITY: These are the most current and accurate)
    productPricesData.forEach(price => {
      if (!pricingByRecipe.has(price.recipe_id)) {
        pricingByRecipe.set(price.recipe_id, []);
      }
      
      const hasSite = Boolean(price.construction_site && String(price.construction_site).trim());
      const scope: string = hasSite ? 'client_site' : 'client';
      
      pricingByRecipe.get(price.recipe_id)!.push({
        recipe_id: price.recipe_id,
        client_id: price.client_id,
        construction_site: price.construction_site || '',
        price: Number(price.base_price),
        source: scope as any,
        quote_id: price.quote_id, // CRITICAL: Use quote_id from product_prices (most accurate)
        quote_detail_id: undefined, // Will be resolved later from quote_id + recipe_id
        business_name: price.clients?.business_name || '',
        client_code: price.clients?.client_code || ''
      });
    });

    // Add quotes data (FALLBACK: Only for recipes not covered by product_prices)
    if (isDevelopment) console.log(`[DebugArkikValidator] Processing ${quotesData.length} quotes...`);
    quotesData.forEach((quote: any) => {
      if (isDevelopment) console.log(`[DebugArkikValidator] Quote ${quote.id}: client=${quote.client_id}, site=${quote.construction_site}, details=${quote.quote_details?.length || 0}`);
      
      if (quote.quote_details && quote.quote_details.length > 0) {
        quote.quote_details.forEach((detail: any) => {
          if (isDevelopment) console.log(`[DebugArkikValidator]   Detail: recipe_id=${detail.recipe_id}, price=${detail.final_price}`);
          
          // Check if this combination already exists in product_prices
          const existingProductPrice = productPricesData.some(price => 
            price.recipe_id === detail.recipe_id &&
            price.client_id === quote.client_id &&
            price.construction_site === quote.construction_site &&
            price.quote_id === quote.id
          );
          
          if (existingProductPrice) {
            if (isDevelopment) console.log(`[DebugArkikValidator]   ⏭️ Skipping quote detail - already in product_prices`);
            return; // Skip this quote detail as it's already represented in product_prices
          }
          
          if (!pricingByRecipe.has(detail.recipe_id)) {
            pricingByRecipe.set(detail.recipe_id, []);
          }
          
          const pricingEntry = {
            recipe_id: detail.recipe_id,
            client_id: quote.client_id,
            construction_site: quote.construction_site || '',
            price: Number(detail.final_price),
            source: 'quotes' as const,
            quote_id: quote.id,
            quote_detail_id: detail.id, // CRITICAL: Required for order creation
            business_name: quote.clients?.business_name || '',
            client_code: quote.clients?.client_code || ''
          };
          
          pricingByRecipe.get(detail.recipe_id)!.push(pricingEntry);
          if (isDevelopment) console.log(`[DebugArkikValidator]   ✅ Added fallback quote pricing`);
        });
      } else if (isDevelopment) {
        console.log(`[DebugArkikValidator]   ⚠️ Quote ${quote.id} has no quote_details`);
      }
    });

    if (isDevelopment) {
      console.log(`[DebugArkikValidator] Loaded ${recipes.size} recipes, ${materials.size} materials, ${pricingByRecipe.size} pricing entries`);
    }

    return {
      recipes,
      materials,
      pricingByRecipe,
      constructionSites: constructionSitesData,
      productPricesData,
      quotesData
    };
  }

  private async loadAllRecipes(): Promise<any[]> {
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id, recipe_code, arkik_long_code, arkik_short_code')
      .eq('plant_id', this.plantId);

    if (error) {
      console.error('[DebugArkikValidator] Error loading recipes:', error);
      return [];
    }

    return recipes || [];
  }

  private async loadAllMaterials(materialCodes: string[]): Promise<any[]> {
    if (materialCodes.length === 0) return [];

    const { data: materials, error } = await supabase
      .from('materials')
      .select('id, material_code, material_name, category, unit_of_measure, is_active')
      .eq('plant_id', this.plantId)
      .eq('is_active', true)
      .in('material_code', materialCodes);

    if (error) {
      console.error('[DebugArkikValidator] Error loading materials:', error);
      return [];
    }

    return materials || [];
  }

  private async loadAllProductPrices(): Promise<any[]> {
    const { data: prices, error } = await supabase
      .from('product_prices')
      .select(`
        recipe_id, client_id, construction_site, base_price, quote_id,
        clients:client_id(business_name, client_code)
      `)
      .eq('plant_id', this.plantId)
      .eq('is_active', true);

    if (error) {
      console.error('[DebugArkikValidator] Error loading product prices:', error);
      return [];
    }

    return prices || [];
  }

  private async loadAllQuotes(): Promise<any[]> {
    const { data: quotes, error } = await supabase
      .from('quotes')
      .select(`
        id, client_id, construction_site, status,
        clients:client_id(business_name, client_code),
        quote_details(id, recipe_id, final_price)
      `)
      .eq('plant_id', this.plantId)
      .eq('status', 'APPROVED');

    if (error) {
      console.error('[DebugArkikValidator] Error loading quotes:', error);
      return [];
    }

    // Filter quotes that have quote_details
    return (quotes || []).filter(quote => quote.quote_details && quote.quote_details.length > 0);
  }

  private async loadQuotesForRecipes(recipeIds: string[]): Promise<any[]> {
    if (recipeIds.length === 0) return [];

    // First get all quote_details for the specific recipes
    const { data: quoteDetails, error: detailsError } = await supabase
      .from('quote_details')
      .select('id, quote_id, recipe_id, final_price')
      .in('recipe_id', recipeIds);

    if (detailsError || !quoteDetails) {
      console.error('[DebugArkikValidator] Error loading quote details:', detailsError);
      return [];
    }

    // Get the quote IDs from the details
    const quoteIds = Array.from(new Set(quoteDetails.map(detail => detail.quote_id)));
    if (quoteIds.length === 0) return [];

    // Now load the full quotes with client info
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select(`
        id, client_id, construction_site, status,
        clients:client_id(business_name, client_code)
      `)
      .eq('plant_id', this.plantId)
      .eq('status', 'APPROVED')
      .in('id', quoteIds);

    if (quotesError || !quotes) {
      console.error('[DebugArkikValidator] Error loading quotes:', quotesError);
      return [];
    }

    // Combine quotes with their details
    return quotes.map(quote => ({
      ...quote,
      quote_details: quoteDetails.filter(detail => detail.quote_id === quote.id)
    }));
  }

  private async loadConstructionSitesForClients(clientNames: string[]): Promise<Map<string, Map<string, any>>> {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const sitesMap = new Map<string, Map<string, any>>();
    
    if (clientNames.length === 0) return sitesMap;

    // First get all clients by business name
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, business_name')
      .ilike('business_name', `%${clientNames.join('%|%')}%`);

    if (clientsError || !clients) {
      console.error('[DebugArkikValidator] Error loading clients:', clientsError);
      return sitesMap;
    }

    const clientIds = clients.map(c => c.id);
    if (clientIds.length === 0) return sitesMap;

    // Then get all construction sites for those clients
    const { data: sites, error: sitesError } = await supabase
      .from('construction_sites')
      .select('id, name, client_id')
      .in('client_id', clientIds);

    if (sitesError || !sites) {
      console.error('[DebugArkikValidator] Error loading construction sites:', sitesError);
      return sitesMap;
    }

    // Build nested map: client_id -> site_name -> site_data
    sites.forEach(site => {
      if (!sitesMap.has(site.client_id)) {
        sitesMap.set(site.client_id, new Map());
      }
      const clientSites = sitesMap.get(site.client_id)!;
      const normalizedName = this.normalizeString(site.name);
      clientSites.set(normalizedName, site);
    });

    if (isDevelopment) {
      console.log(`[DebugArkikValidator] Loaded construction sites for ${clientIds.length} clients`);
    }
    return sitesMap;
  }

  private validateSingleRowFromCache(row: StagingRemision, batchData: BatchData): {
    row: StagingRemision;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];

    // STEP 1: Find Recipe from cache
    const recipe = this.findRecipeFromCache(row, errors, batchData.recipes);
    if (!recipe) {
      return {
        row: { ...row, validation_status: 'error', validation_errors: errors },
        errors
      };
    }

    // STEP 2: Validate Materials from cache
    this.validateMaterialsFromCache(row, errors, batchData.materials);

    // STEP 3: Get Pricing from cache
    const pricingOptions = batchData.pricingByRecipe.get(recipe.id) || [];
    if (pricingOptions.length === 0) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.RECIPE_NO_PRICE,
        field_name: 'recipe_id',
        field_value: recipe.id,
        message: `No pricing found for recipe "${recipe.arkik_long_code || recipe.recipe_code}"`,
        recoverable: true
      });
      return {
        row: { ...row, recipe_id: recipe.id, validation_status: 'error', validation_errors: errors },
        errors
      };
    }

    // STEP 4: Smart Client/Site Matching
    const bestMatch = this.selectBestPricing(pricingOptions, row, batchData.productPricesData);

    // STEP 5: Resolve quote_detail_id if we have quote_id but no quote_detail_id
    if (bestMatch.pricing.quote_id && !bestMatch.pricing.quote_detail_id) {
      bestMatch.pricing.quote_detail_id = this.resolveQuoteDetailId(
        bestMatch.pricing.quote_id,
        bestMatch.pricing.recipe_id,
        batchData.quotesData
      );
    }

    // STEP 6: Resolve construction site from cache
    const resolvedConstructionSiteId = this.resolveConstructionSiteIdFromCache(
      bestMatch.pricing.client_id,
      bestMatch.pricing.construction_site,
      batchData.constructionSites
    );

    const validatedRow: StagingRemision = {
      ...row,
      recipe_id: recipe.id,
      client_id: bestMatch.pricing.client_id,
      unit_price: bestMatch.pricing.price,
      price_source: bestMatch.pricing.source as any,
      quote_id: bestMatch.pricing.quote_id,
      quote_detail_id: bestMatch.pricing.quote_detail_id, // CRITICAL: Required for order creation
      prod_tecnico: (row.prod_tecnico || row.recipe_code) as any,
      product_description: (row.product_description || row.recipe_code) as any,
      suggested_client_id: bestMatch.pricing.client_id,
      suggested_site_name: bestMatch.pricing.construction_site,
      construction_site_id: (resolvedConstructionSiteId || row.construction_site_id || undefined) as any,
      validation_status: errors.length > 0 ? 'warning' : 'valid',
      validation_errors: errors
    };

    return { row: validatedRow, errors };
  }

  private findRecipeFromCache(row: StagingRemision, errors: ValidationError[], recipesMap: Map<string, any>): any | null {
    const primaryCode = row.product_description?.trim();
    const fallbackCode = row.recipe_code?.trim();

    if (!primaryCode && !fallbackCode) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.RECIPE_NOT_FOUND,
        field_name: 'product_description',
        field_value: '',
        message: 'No recipe codes provided',
        recoverable: true
      });
      return null;
    }

    // Try exact matches first
    if (primaryCode) {
      const normalizedPrimary = this.normalizeString(primaryCode);
      const recipe = recipesMap.get(normalizedPrimary);
      if (recipe) return recipe;
    }

    if (fallbackCode) {
      const normalizedFallback = this.normalizeString(fallbackCode);
      const recipe = recipesMap.get(normalizedFallback);
      if (recipe) return recipe;
    }

    // Fuzzy matching - iterate through all recipes
    const searchCode = primaryCode || fallbackCode || '';
    const normalizedSearch = this.normalizeString(searchCode);
    
    for (const [key, recipe] of Array.from(recipesMap.entries())) {
      if (this.isFuzzyMatch(normalizedSearch, key)) {
        return recipe;
      }
    }

    // No matches found
    errors.push({
      row_number: row.row_number,
      error_type: ArkikErrorType.RECIPE_NOT_FOUND,
      field_name: 'product_description',
      field_value: primaryCode || fallbackCode,
      message: `Recipe not found: "${primaryCode || fallbackCode}"`,
      recoverable: true
    });
    
    return null;
  }

  private validateMaterialsFromCache(row: StagingRemision, errors: ValidationError[], materialsMap: Map<string, any>): void {
    const materialCodes = new Set<string>();
    
    // Only validate materials with non-zero values
    Object.keys(row.materials_teorico || {}).forEach(code => {
      const teoricoValue = row.materials_teorico[code];
      const realValue = row.materials_real?.[code] || 0;
      if ((teoricoValue && teoricoValue > 0) || (realValue && realValue > 0)) {
        materialCodes.add(code);
      }
    });
    
    // Add materials from real that weren't covered above
    Object.keys(row.materials_real || {}).forEach(code => {
      const realValue = row.materials_real[code];
      if (realValue && realValue > 0) {
        materialCodes.add(code);
      }
    });

    if (materialCodes.size === 0) return;

    const unmappedCodes: string[] = [];
    const inactiveMaterials: string[] = [];

    materialCodes.forEach(code => {
      const material = materialsMap.get(code);
      if (!material) {
        unmappedCodes.push(code);
      } else if (!material.is_active) {
        inactiveMaterials.push(code);
      }
    });

    if (unmappedCodes.length > 0) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.MATERIAL_NOT_FOUND,
        field_name: 'materials',
        field_value: unmappedCodes.join(', '),
        message: `Unmapped material codes for plant: ${unmappedCodes.join(', ')}`,
        suggestion: { 
          action: 'configure_material_mapping', 
          unmapped_codes: unmappedCodes 
        },
        recoverable: true
      });
    }

    if (inactiveMaterials.length > 0) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.MATERIAL_NOT_FOUND,
        field_name: 'materials',
        field_value: inactiveMaterials.join(', '),
        message: `Inactive materials referenced: ${inactiveMaterials.join(', ')}`,
        recoverable: true
      });
    }
  }

  private resolveConstructionSiteIdFromCache(
    clientId: string, 
    siteName: string, 
    constructionSitesMap: Map<string, Map<string, any>>
  ): string | null {
    const name = (siteName || '').trim();
    if (!clientId || !name) return null;

    const clientSites = constructionSitesMap.get(clientId);
    if (!clientSites) return null;

    const normalizedName = this.normalizeString(name);
    
    // Exact match
    const exactMatch = clientSites.get(normalizedName);
    if (exactMatch) return exactMatch.id;

    // Substring match
    for (const [siteName, siteData] of Array.from(clientSites.entries())) {
      if (siteName.includes(normalizedName) || normalizedName.includes(siteName)) {
        return siteData.id;
      }
    }

    return null;
  }

  private resolveQuoteDetailId(quoteId: string, recipeId: string, quotesData: any[]): string | undefined {
    // Find the quote that matches the quote_id
    const quote = quotesData.find(q => q.id === quoteId);
    if (!quote || !quote.quote_details) {
      return undefined;
    }

    // Find the quote_detail that matches the recipe_id
    const quoteDetail = quote.quote_details.find((detail: any) => detail.recipe_id === recipeId);
    return quoteDetail?.id;
  }

  private async validateBatchFallback(rows: StagingRemision[]): Promise<{ 
    validated: StagingRemision[]; 
    errors: ValidationError[];
  }> {
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      console.log('[DebugArkikValidator] Using fallback sequential processing...');
    }
    const validated: StagingRemision[] = [];
    const allErrors: ValidationError[] = [];

    // Process each row individually (original method)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        const result = await this.validateSingleRow(row);
        validated.push(result.row);
        if (result.errors.length > 0) {
          allErrors.push(...result.errors);
        }
      } catch (error: any) {
        allErrors.push({
          row_number: row.row_number,
          error_type: ArkikErrorType.DATA_TYPE_ERROR,
          field_name: 'row',
          field_value: null,
          message: `Error processing row: ${error.message}`,
          recoverable: false
        });
      }
    }

    return { validated, errors: allErrors };
  }

  private async validateSingleRow(row: StagingRemision): Promise<{
    row: StagingRemision;
    errors: ValidationError[];
  }> {
    const errors: ValidationError[] = [];

    // STEP 1: Find Recipe
    const recipe = await this.findRecipe(row, errors);
    if (!recipe) {
      return {
        row: { ...row, validation_status: 'error', validation_errors: errors },
        errors
      };
    }

    // STEP 2: Validate Materials
    await this.validateMaterials(row, errors);

    // STEP 3: Load Unified Pricing
    const pricingOptions = await this.loadUnifiedPricing(recipe.id);
    if (pricingOptions.length === 0) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.RECIPE_NO_PRICE,
        field_name: 'recipe_id',
        field_value: recipe.id,
        message: `No pricing found for recipe "${recipe.arkik_long_code || recipe.recipe_code}"`,
        recoverable: true
      });
      return {
        row: { ...row, recipe_id: recipe.id, validation_status: 'error', validation_errors: errors },
        errors
      };
    }

    // STEP 4: Smart Client/Site Matching
    const bestMatch = this.selectBestPricing(pricingOptions, row, []); // Fallback: no product prices data available

    // Apply Results (resolve construction_site_id when possible)
    const resolvedConstructionSiteId = await this.resolveConstructionSiteId(
      bestMatch.pricing.client_id,
      bestMatch.pricing.construction_site
    );

    const validatedRow: StagingRemision = {
      ...row,
      recipe_id: recipe.id,
      client_id: bestMatch.pricing.client_id,
      unit_price: bestMatch.pricing.price,
      price_source: bestMatch.pricing.source as any,
      quote_id: bestMatch.pricing.quote_id, // Include quote_id if available
      quote_detail_id: bestMatch.pricing.quote_detail_id, // CRITICAL: Required for order creation
      // Denormalized display fields for UI table (reusing existing optional fields)
      prod_tecnico: (row.prod_tecnico || row.recipe_code) as any, // Keep original Excel code
      product_description: (row.product_description || row.recipe_code) as any, // Keep original Excel code
      suggested_client_id: bestMatch.pricing.client_id,
      suggested_site_name: bestMatch.pricing.construction_site,
      construction_site_id: (resolvedConstructionSiteId || row.construction_site_id || undefined) as any,
      validation_status: errors.length > 0 ? 'warning' : 'valid',
      validation_errors: errors
    };

    return { row: validatedRow, errors };
  }

  private async resolveConstructionSiteId(clientId: string, siteName: string): Promise<string | null> {
    try {
      const name = (siteName || '').trim();
      if (!clientId || !name) return null;
      // Exact name match first
      const { data, error } = await supabase
        .from('construction_sites')
        .select('id, name')
        .eq('client_id', clientId)
        .ilike('name', name);
      if (error) return null;
      if (data && data.length > 0) return data[0].id;

      // Fallback: normalized comparison over client's sites
      const { data: allSites } = await supabase
        .from('construction_sites')
        .select('id, name')
        .eq('client_id', clientId)
        .limit(100);
      const target = this.normalizeString(name);
      const found = (allSites || []).find(s => this.normalizeString(s.name) === target);
      if (found) return found.id;

      // Substring fallback
      const contains = (allSites || []).find(s => this.normalizeString(s.name).includes(target) || target.includes(this.normalizeString(s.name)));
      return contains ? contains.id : null;
    } catch {
      return null;
    }
  }

  private async findRecipe(row: StagingRemision, errors: ValidationError[]): Promise<any | null> {
    const primaryCode = row.product_description?.trim(); // arkik_long_code (PRIMARY)
    const fallbackCode = row.recipe_code?.trim();        // prod_tecnico (FALLBACK)

    if (!primaryCode && !fallbackCode) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.RECIPE_NOT_FOUND,
        field_name: 'product_description',
        field_value: '',
        message: 'No recipe codes provided',
        recoverable: true
      });
      return null;
    }

    // Query recipes for this plant
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id, recipe_code, arkik_long_code, arkik_short_code')
      .eq('plant_id', this.plantId);

    if (error) {
      return null;
    }

    if (!recipes || recipes.length === 0) {
      return null;
    }

    // Try exact matches first
    let recipe = null;

    // 1. Exact match on arkik_long_code
    if (primaryCode) {
      recipe = recipes.find(r => 
        r.arkik_long_code && 
        this.normalizeString(r.arkik_long_code) === this.normalizeString(primaryCode)
      );
      if (recipe) {
        return recipe;
      }
    }

    // 2. Exact match on recipe_code
    if (fallbackCode) {
      recipe = recipes.find(r => 
        r.recipe_code && 
        this.normalizeString(r.recipe_code) === this.normalizeString(fallbackCode)
      );
      if (recipe) {
        return recipe;
      }
    }

    // 3. Fuzzy matching
    const candidates = recipes.filter(r => {
      const codes = [r.arkik_long_code, r.recipe_code, r.arkik_short_code].filter(Boolean);
      return codes.some(code => 
        this.isFuzzyMatch(primaryCode || fallbackCode || '', code)
      );
    });

    if (candidates.length === 1) {
      recipe = candidates[0];
      return recipe;
    } else if (candidates.length > 1) {
      recipe = candidates[0]; // Take first match
      return recipe;
    }

    // No matches found
    errors.push({
      row_number: row.row_number,
      error_type: ArkikErrorType.RECIPE_NOT_FOUND,
      field_name: 'product_description',
      field_value: primaryCode || fallbackCode,
      message: `Recipe not found: "${primaryCode || fallbackCode}"`,
      recoverable: true
    });
    
    return null;
  }

  private async loadUnifiedPricing(recipeId: string): Promise<DebugPricing[]> {
    const unifiedPricing: DebugPricing[] = [];

    // Load product_prices
    const { data: prices, error: pricesError } = await supabase
      .from('product_prices')
      .select(`
        recipe_id, client_id, construction_site, base_price,
        clients:client_id(business_name, client_code)
      `)
      .eq('plant_id', this.plantId)
      .eq('is_active', true)
      .eq('recipe_id', recipeId);

    if (!pricesError) {
      // Process prices sequentially to find quote_ids
      for (const price of (prices || [])) {
        if (price.clients) {
          const hasSite = Boolean(price.construction_site && String(price.construction_site).trim());
          const scope: string = hasSite ? 'client_site' : 'client';
          
          // Try to find the corresponding quote_id for this price
          let quoteId = undefined;
          if (scope === 'client_site' && price.construction_site) {
            const { data: matchingQuote, error: quoteError } = await supabase
              .from('quotes')
              .select('id, status')
              .eq('plant_id', this.plantId)
              .eq('client_id', price.client_id)
              .eq('construction_site', price.construction_site)
              .eq('status', 'APPROVED')
              .maybeSingle();
            
            if (matchingQuote && !quoteError) {
              quoteId = matchingQuote.id;
            }
          }
          
          unifiedPricing.push({
            recipe_id: (price as any).recipeid,
            client_id: price.client_id,
            construction_site: price.construction_site || '',
            price: Number(price.base_price),
            source: scope as any,
            quote_id: quoteId, // Include quote_id if found
            business_name: price.clients.business_name,
            client_code: price.clients.client_code
          });
        }
      }
    }

    // Load quotes
    const { data: allQuotes, error: allQuotesError } = await supabase
      .from('quote_details')
      .select('recipe_id, final_price')
      .eq('recipe_id', recipeId);
    
    // Get quotes for this recipe by filtering on client and construction site first
    // This is more efficient than complex joins
    let { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select(`
        id, client_id, construction_site, status,
        clients:client_id(business_name, client_code),
        quote_details(recipe_id, final_price)
      `)
      .eq('plant_id', this.plantId)
      .eq('status', 'APPROVED');

    if (quotes && quotes.length > 0) {
      // Filter quotes that have this recipe in their details
      const matchingQuotes = quotes.filter(quote => 
        quote.quote_details.some((detail: any) => detail.recipe_id === recipeId)
      );
      
      if (matchingQuotes.length > 0) {
        quotes = matchingQuotes;
      } else {
        quotes = [];
      }
    }

    if (!quotesError) {
      (quotes || []).forEach(quote => {
        if (quote.clients && quote.quote_details && quote.quote_details.length > 0) {
          // Get the price from the first quote_detail (should be only one due to inner join)
          const quoteDetail = quote.quote_details[0];
          const pricingEntry = {
            recipe_id: quoteDetail.recipe_id,
            client_id: quote.client_id,
            construction_site: quote.construction_site || '',
            price: Number(quoteDetail.final_price),
            source: 'quotes' as const,
            quote_id: quote.id, // This is the actual quote_id
            business_name: quote.clients.business_name,
            client_code: quote.clients.client_code
          };
          unifiedPricing.push(pricingEntry);
        }
      });
    }

    return unifiedPricing;
  }

  private selectBestPricing(pricingOptions: DebugPricing[], row: StagingRemision, productPricesData: any[]): DebugMatch {
    // CRITICAL: Use cliente_name, NOT cliente_codigo (as per strategy)
    const clientName = this.normalizeString(row.cliente_name || '');
    const siteName = this.normalizeString(row.obra_name || '');

    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      console.log(`[DebugArkikValidator] Selecting best pricing for row ${row.row_number}:`);
      console.log(`[DebugArkikValidator]   Client name: "${row.cliente_name}" -> normalized: "${clientName}"`);
      console.log(`[DebugArkikValidator]   Site name: "${row.obra_name}" -> normalized: "${siteName}"`);
      console.log(`[DebugArkikValidator]   Available pricing options: ${pricingOptions.length}`);
    }

    // Single option - use directly
    if (pricingOptions.length === 1) {
      const pricing = pricingOptions[0];
      const quoteBonus = pricing.quote_id ? 2.0 : 0;
      if (isDevelopment) {
        console.log(`[DebugArkikValidator]   ✅ Single option selected: ${pricing.source} - Quote ID: ${pricing.quote_id || 'N/A'} - Quote Bonus: ${quoteBonus}`);
      }
      return {
        pricing,
        clientScore: 1,
        siteScore: 1,
        quoteBonus,
        totalScore: 2 + quoteBonus,
        reasoning: 'Single pricing option available'
      };
    }

    // Score each option
    const scoredOptions = pricingOptions.map(pricing => {
      const clientScore = this.calculateClientSimilarity(clientName, pricing.business_name);
      const siteScore = this.calculateSiteSimilarity(siteName, pricing.construction_site);
      
      // CRITICAL: Prioritize quotes over other pricing sources, BUT consider freshness
      let quoteBonus = 0;
      let freshnessBonus = 0;
      
      if (pricing.quote_id) {
        quoteBonus = 1.0; // Reduced from 2.0 to balance with freshness
        
        // Check if this quote has a corresponding active product_price (more recent)
        const hasActiveProductPrice = productPricesData.some(price => 
          price.client_id === pricing.client_id && 
          price.construction_site === pricing.construction_site &&
          price.recipe_id === pricing.recipe_id &&
          price.is_active === true &&
          price.quote_id === pricing.quote_id // Direct reference to quote
        );
        
        if (hasActiveProductPrice) {
          freshnessBonus = 2.0; // High bonus for quotes with active product_prices (most recent)
          if (isDevelopment) {
            console.log(`[DebugArkikValidator]   Freshness bonus applied: +${freshnessBonus} (has active product_price)`);
          }
        } else {
          freshnessBonus = -1.0; // Penalty for quotes without active product_prices (obsolete)
          if (isDevelopment) {
            console.log(`[DebugArkikValidator]   Freshness penalty applied: ${freshnessBonus} (obsolete quote)`);
          }
        }
        
        if (isDevelopment) {
          console.log(`[DebugArkikValidator]   Quote bonus applied: +${quoteBonus} for quote ${pricing.quote_id}`);
        }
      }
      
      const totalScore = clientScore + siteScore + quoteBonus + freshnessBonus;

      return {
        pricing,
        clientScore,
        siteScore,
        quoteBonus,
        totalScore,
        reasoning: `Client: ${clientScore.toFixed(2)}, Site: ${siteScore.toFixed(2)}, Quote Bonus: ${quoteBonus.toFixed(1)}`
      };
    });

    // Sort by score and return best
    scoredOptions.sort((a, b) => b.totalScore - a.totalScore);
    
    if (isDevelopment) {
      console.log(`[DebugArkikValidator]   Final scoring results:`);
      scoredOptions.forEach((option, index) => {
        console.log(`[DebugArkikValidator]     ${index + 1}. ${option.pricing.source} - Score: ${option.totalScore.toFixed(2)} - Quote ID: ${option.pricing.quote_id || 'N/A'} - ${option.reasoning}`);
      });
      
      const bestMatch = scoredOptions[0];
      console.log(`[DebugArkikValidator]   🎯 Selected: ${bestMatch.pricing.source} with score ${bestMatch.totalScore.toFixed(2)} - Quote ID: ${bestMatch.pricing.quote_id || 'N/A'}`);
    }
    
    return scoredOptions[0];
  }

  private calculateClientSimilarity(inputName: string, businessName: string): number {
    if (!inputName || !businessName) return 0;
    
    const input = this.normalizeString(inputName);
    const business = this.normalizeString(businessName);
    
    // Exact match
    if (input === business) return 1.0;
    
    // Substring match
    if (business.includes(input) || input.includes(business)) {
      return 0.8;
    }
    
    // Word overlap
    const inputWords = input.split(/\s+/).filter(w => w.length > 2);
    const businessWords = business.split(/\s+/).filter(w => w.length > 2);
    
    const matchingWords = inputWords.filter(inputWord => 
      businessWords.some(businessWord => 
        businessWord.includes(inputWord) || inputWord.includes(businessWord)
      )
    );
    
    if (matchingWords.length > 0) {
      return 0.6 + (matchingWords.length / Math.max(inputWords.length, businessWords.length)) * 0.2;
    }
    
    return 0;
  }

  private calculateSiteSimilarity(inputSite: string, pricingSite: string): number {
    if (!inputSite || !pricingSite) return 0.1;
    
    const input = this.normalizeString(inputSite);
    const pricing = this.normalizeString(pricingSite);
    
    // Exact match
    if (input === pricing) return 1.0;
    
    // Substring match
    if (pricing.includes(input) || input.includes(pricing)) {
      return 0.9;
    }
    
    return 0.1; // Small base score
  }

  private normalizeString(str: string): string {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private isFuzzyMatch(input: string, target: string): boolean {
    const normalizedInput = this.normalizeString(input);
    const normalizedTarget = this.normalizeString(target);
    
    // Substring match
    if (normalizedTarget.includes(normalizedInput) || normalizedInput.includes(normalizedTarget)) {
      return true;
    }
    
    // Simple Levenshtein check for typos
    return this.levenshteinDistance(normalizedInput, normalizedTarget) <= 2;
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[b.length][a.length];
  }

  private async validateMaterials(row: StagingRemision, errors: ValidationError[]): Promise<void> {
    // Get all material codes from teorico and real
    const materialCodes = new Set<string>([
      ...Object.keys(row.materials_teorico || {}),
      ...Object.keys(row.materials_real || {})
    ]);

    if (materialCodes.size === 0) {
      return;
    }

    // Look for materials directly in materials table by material_code
    const { data: directMaterials, error: directError } = await supabase
      .from('materials')
      .select('id, material_code, material_name, category, unit_of_measure, is_active')
      .eq('plant_id', this.plantId)
      .eq('is_active', true)
      .in('material_code', Array.from(materialCodes));

    if (directError) {
      return;
    }

    // Use only direct materials lookup
    const mappedCodes = new Set<string>();
    const materialDetails = new Map<string, any>();

    // Add direct materials
    (directMaterials || []).forEach(material => {
      mappedCodes.add(material.material_code);
      materialDetails.set(material.material_code, material);
    });

    const unmappedCodes = Array.from(materialCodes).filter(code => !mappedCodes.has(code));

    if (unmappedCodes.length > 0) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.MATERIAL_NOT_FOUND,
        field_name: 'materials',
        field_value: unmappedCodes.join(', '),
        message: `Unmapped material codes for plant: ${unmappedCodes.join(', ')}`,
        suggestion: { 
          action: 'configure_material_mapping', 
          unmapped_codes: unmappedCodes 
        },
        recoverable: true
      });
    }

    // Check for inactive materials
    const inactiveMaterials = Array.from(materialDetails.values()).filter(material => !material.is_active);

    if (inactiveMaterials.length > 0) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.MATERIAL_NOT_FOUND,
        field_name: 'materials',
        field_value: inactiveMaterials.map(m => m.material_code).join(', '),
        message: `Inactive materials referenced: ${inactiveMaterials.map(m => m.material_code).join(', ')}`,
        recoverable: true
      });
    }
  }
}
