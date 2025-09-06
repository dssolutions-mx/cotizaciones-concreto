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
import { 
  normalizeRecipeCode, 
  exactRecipeMatch, 
  findRecipeMatch, 
  getRecipeCodeSuggestions,
  validateRecipeCodeFormat 
} from '@/lib/utils/recipeCodeUtils';
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
  validationFailed?: boolean; // Flag to indicate strict validation failure
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
          const result = await this.validateSingleRowFromCache(row, batchData);
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

    // Build recipe lookup maps first using standardized normalization
    const recipes = new Map<string, any>();
    recipesData.forEach(recipe => {
      // Index by all possible codes for fast lookup using standardized normalization
      if (recipe.arkik_long_code) {
        recipes.set(normalizeRecipeCode(recipe.arkik_long_code), recipe);
      }
      if (recipe.recipe_code) {
        recipes.set(normalizeRecipeCode(recipe.recipe_code), recipe);
      }
      if (recipe.arkik_short_code) {
        recipes.set(normalizeRecipeCode(recipe.arkik_short_code), recipe);
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
    const sitesMap = new Map<string, Map<string, any>>();
    
    console.log('[DebugArkikValidator] === LOADING CONSTRUCTION SITES ===');
    console.log('[DebugArkikValidator] Client names to search:', clientNames);
    
    if (clientNames.length === 0) {
      console.log('[DebugArkikValidator] ❌ No client names provided');
      return sitesMap;
    }

    // First get all clients by business name - use OR query for multiple names
    const clientQueries = clientNames.map(name => 
      supabase
        .from('clients')
        .select('id, business_name')
        .ilike('business_name', `%${name.trim()}%`)
    );

    const clientResults = await Promise.all(clientQueries);
    const allClients: any[] = [];
    
    clientResults.forEach((result, index) => {
      if (result.error) {
        console.error(`[DebugArkikValidator] Error loading client "${clientNames[index]}":`, result.error);
      } else if (result.data) {
        console.log(`[DebugArkikValidator] Found ${result.data.length} clients for "${clientNames[index]}":`, result.data.map(c => c.business_name));
        allClients.push(...result.data);
      }
    });

    // Remove duplicates
    const uniqueClients = allClients.filter((client, index, array) => 
      array.findIndex(c => c.id === client.id) === index
    );

    console.log('[DebugArkikValidator] Unique clients found:', uniqueClients.length);
    
    if (uniqueClients.length === 0) {
      console.log('[DebugArkikValidator] ❌ No clients found in database');
      return sitesMap;
    }

    const clientIds = uniqueClients.map(c => c.id);
    console.log('[DebugArkikValidator] Client IDs to load sites for:', clientIds);

    // Then get all construction sites for those clients
    // First try to load active sites
    const { data: activeSites, error: activeSitesError } = await supabase
      .from('construction_sites')
      .select('id, name, client_id, is_active')
      .in('client_id', clientIds)
      .eq('is_active', true);

    if (activeSitesError) {
      console.error('[DebugArkikValidator] Error loading active construction sites:', activeSitesError);
      return sitesMap;
    }

    console.log('[DebugArkikValidator] Active construction sites loaded:', activeSites?.length || 0);

    // Check which clients have no active sites and load their inactive sites too
    const clientsWithActiveSites = new Set((activeSites || []).map(site => site.client_id));
    const clientsNeedingInactiveSites = clientIds.filter(id => !clientsWithActiveSites.has(id));

    let allSites = activeSites || [];

    if (clientsNeedingInactiveSites.length > 0) {
      console.log('[DebugArkikValidator] Loading inactive sites for clients without active sites:', clientsNeedingInactiveSites);
      
      const { data: inactiveSites, error: inactiveSitesError } = await supabase
        .from('construction_sites')
        .select('id, name, client_id, is_active')
        .in('client_id', clientsNeedingInactiveSites)
        .eq('is_active', false);

      if (!inactiveSitesError && inactiveSites) {
        console.log('[DebugArkikValidator] Inactive construction sites loaded:', inactiveSites.length);
        allSites = [...allSites, ...inactiveSites];
      }
    }

    console.log('[DebugArkikValidator] Total construction sites loaded:', allSites.length);

    // Build nested map: client_id -> site_name -> site_data
    allSites.forEach(site => {
      if (!sitesMap.has(site.client_id)) {
        sitesMap.set(site.client_id, new Map());
      }
      const clientSites = sitesMap.get(site.client_id)!;
      const normalizedName = this.normalizeString(site.name);
      clientSites.set(normalizedName, site);
      
      console.log(`[DebugArkikValidator] Added site: "${site.name}" -> "${normalizedName}" for client: ${site.client_id} (active: ${site.is_active})`);
    });

    console.log('[DebugArkikValidator] Final construction sites map:');
    sitesMap.forEach((sites, clientId) => {
      console.log(`[DebugArkikValidator]   Client ${clientId}: ${sites.size} sites`);
      sites.forEach((siteData, siteName) => {
        console.log(`[DebugArkikValidator]     "${siteName}" -> ${siteData.id}`);
      });
    });

    return sitesMap;
  }

  private async validateSingleRowFromCache(row: StagingRemision, batchData: BatchData): Promise<{
    row: StagingRemision;
    errors: ValidationError[];
  }> {
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
    
    console.log('[DebugArkikValidator] === BEST MATCH RESULTS ===');
    console.log('[DebugArkikValidator] Row:', row.row_number, 'Remision:', row.remision_number);
    console.log('[DebugArkikValidator] Best match pricing:', {
      client_id: bestMatch.pricing.client_id,
      business_name: bestMatch.pricing.business_name,
      construction_site: bestMatch.pricing.construction_site,
      price: bestMatch.pricing.price,
      source: bestMatch.pricing.source,
      quote_id: bestMatch.pricing.quote_id
    });

    // STEP 4.5: Check for strict client validation failure (CACHE METHOD)
    console.log(`[DebugArkikValidator] 🔍 VALIDATION FAILURE CHECK (CACHE) for remision ${row.remision_number}:`);
    console.log(`[DebugArkikValidator]   - validationFailed flag: ${bestMatch.validationFailed}`);
    console.log(`[DebugArkikValidator]   - clientScore: ${bestMatch.clientScore}`);
    console.log(`[DebugArkikValidator]   - reasoning: ${bestMatch.reasoning}`);

    if (bestMatch.validationFailed) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.RECIPE_NO_PRICE,
        field_name: 'cliente_name',
        field_value: row.cliente_name,
        message: `No hay precio activo para el cliente "${row.cliente_name}" con la receta "${row.product_description || row.recipe_code}". Se encontró precio para un cliente diferente: "${bestMatch.pricing.business_name}" (similitud de cliente: ${(bestMatch.clientScore * 100).toFixed(1)}%).`,
        suggestion: {
          action: 'configure_client_pricing',
          suggestion: `Contacta al equipo comercial para configurar precio para el cliente "${row.cliente_name}" con esta receta, o verifica si el nombre del cliente debería ser "${bestMatch.pricing.business_name}".`
        },
        recoverable: true
      });

      return {
        row: { 
          ...row, 
          recipe_id: recipe.id, 
          validation_status: 'error', 
          validation_errors: errors 
        },
        errors
      };
    }

    // STEP 5: Resolve quote_detail_id if we have quote_id but no quote_detail_id
    if (bestMatch.pricing.quote_id && !bestMatch.pricing.quote_detail_id) {
      bestMatch.pricing.quote_detail_id = this.resolveQuoteDetailId(
        bestMatch.pricing.quote_id,
        bestMatch.pricing.recipe_id,
        batchData.quotesData
      );
      console.log('[DebugArkikValidator] Resolved quote_detail_id:', bestMatch.pricing.quote_detail_id);
    }

    // STEP 6: Resolve construction site from cache AND fallback sources
    console.log('[DebugArkikValidator] About to resolve construction site...');
    const resolvedConstructionSiteId = await this.resolveConstructionSiteIdFromCache(
      bestMatch.pricing.client_id,
      bestMatch.pricing.construction_site,
      batchData.constructionSites,
      bestMatch.pricing.quote_detail_id
    );
    console.log('[DebugArkikValidator] Resolved construction site ID:', resolvedConstructionSiteId);

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

    // DEBUG: Log validation status determination
    console.log(`[DebugArkikValidator] 🎯 VALIDATION STATUS DETERMINATION for remision ${row.remision_number}:`);
    console.log(`[DebugArkikValidator]   - Total errors: ${errors.length}`);
    console.log(`[DebugArkikValidator]   - Errors array:`, errors);
    console.log(`[DebugArkikValidator]   - Final status: ${errors.length > 0 ? 'warning' : 'valid'}`);
    console.log(`[DebugArkikValidator]   - Status logic: errors.length > 0 ? 'warning' : 'valid'`);

    console.log('[DebugArkikValidator] === FINAL VALIDATED ROW ===');
    console.log('[DebugArkikValidator] Final validated row for remision', row.remision_number, ':', {
      client_id: validatedRow.client_id,
      construction_site_id: validatedRow.construction_site_id,
      recipe_id: validatedRow.recipe_id,
      unit_price: validatedRow.unit_price,
      price_source: validatedRow.price_source,
      quote_id: validatedRow.quote_id,
      quote_detail_id: validatedRow.quote_detail_id,
      validation_status: validatedRow.validation_status,
      obra_name: validatedRow.obra_name
    });

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

    // Convert map to array for the new utility function
    const recipes = Array.from(recipesMap.values());
    
    // Try primary code first (arkik_long_code)
    if (primaryCode) {
      // Validate format
      if (!validateRecipeCodeFormat(primaryCode)) {
        console.warn(`[DebugArkikValidator] Invalid recipe code format: "${primaryCode}"`);
      }
      
      const recipe = findRecipeMatch(primaryCode, recipes, false); // No fuzzy matching
      if (recipe) {
        console.log(`[DebugArkikValidator] ✅ Exact match found for primary code: "${primaryCode}" -> Recipe ID: ${recipe.id}`);
        return recipe;
      }
    }

    // Try fallback code (recipe_code/prod_tecnico)
    if (fallbackCode) {
      // Validate format
      if (!validateRecipeCodeFormat(fallbackCode)) {
        console.warn(`[DebugArkikValidator] Invalid recipe code format: "${fallbackCode}"`);
      }
      
      const recipe = findRecipeMatch(fallbackCode, recipes, false); // No fuzzy matching
      if (recipe) {
        console.log(`[DebugArkikValidator] ✅ Exact match found for fallback code: "${fallbackCode}" -> Recipe ID: ${recipe.id}`);
        return recipe;
      }
    }

    // No exact matches found - provide suggestions for manual review
    const searchCode = primaryCode || fallbackCode || '';
    const suggestions = getRecipeCodeSuggestions(searchCode, recipes, 3);
    
    let suggestionText = '';
    if (suggestions.length > 0) {
      suggestionText = ` Possible matches: [${suggestions.join(', ')}]`;
    }

    console.log(`[DebugArkikValidator] ❌ No exact match found for: "${searchCode}"${suggestionText}`);

    errors.push({
      row_number: row.row_number,
      error_type: ArkikErrorType.RECIPE_NOT_FOUND,
      field_name: 'product_description',
      field_value: searchCode,
      message: `Recipe not found: "${searchCode}"${suggestionText}`,
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

    // DEBUG: Log what materials we're validating
    console.log(`[DebugArkikValidator] 🔍 Validating materials for remision ${row.remision_number}:`, Array.from(materialCodes));
    console.log(`[DebugArkikValidator] 📊 Materials map size: ${materialsMap.size}`);
    console.log(`[DebugArkikValidator] 📋 Available materials in map:`, Array.from(materialsMap.keys()));

    const unmappedCodes: string[] = [];
    const inactiveMaterials: string[] = [];

    materialCodes.forEach(code => {
      const material = materialsMap.get(code);
      if (!material) {
        unmappedCodes.push(code);
        console.log(`[DebugArkikValidator] ❌ Material ${code} NOT FOUND in materials map`);
      } else if (!material.is_active) {
        inactiveMaterials.push(code);
        console.log(`[DebugArkikValidator] ⚠️ Material ${code} found but INACTIVE (is_active: ${material.is_active})`);
      } else {
        console.log(`[DebugArkikValidator] ✅ Material ${code} found and ACTIVE`);
      }
    });

    if (unmappedCodes.length > 0) {
      console.log(`[DebugArkikValidator] 🚨 Adding unmapped materials error for remision ${row.remision_number}:`, unmappedCodes);
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
      console.log(`[DebugArkikValidator] 🚨 Adding inactive materials error for remision ${row.remision_number}:`, inactiveMaterials);
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.MATERIAL_NOT_FOUND,
        field_name: 'materials',
        field_value: inactiveMaterials.join(', '),
        message: `Inactive materials referenced: ${inactiveMaterials.join(', ')}`,
        recoverable: true
      });
    }

    // DEBUG: Log final error count
    console.log(`[DebugArkikValidator] 📝 Total validation errors for remision ${row.remision_number}: ${errors.length}`);
  }

  private async resolveConstructionSiteIdFromCache(
    clientId: string, 
    siteName: string, 
    constructionSitesMap: Map<string, Map<string, any>>,
    quoteDetailId?: string
  ): Promise<string | null> {
    const name = (siteName || '').trim();
    
    console.log('[DebugArkikValidator] === RESOLVING CONSTRUCTION SITE ===');
    console.log('[DebugArkikValidator] Input:', { clientId, siteName: name, quoteDetailId });
    
    if (!clientId || !name) {
      console.log('[DebugArkikValidator] ❌ Missing clientId or siteName');
      return null;
    }

    // STEP 1: Try direct lookup in cache (existing logic)
    const clientSites = constructionSitesMap.get(clientId);
    console.log('[DebugArkikValidator] Client sites found:', clientSites ? clientSites.size : 0);
    
    if (clientSites) {
      console.log('[DebugArkikValidator] Available sites for client:', Array.from(clientSites.keys()));

      const normalizedName = this.normalizeString(name);
      console.log('[DebugArkikValidator] Normalized site name:', normalizedName);
      
      // Exact match
      const exactMatch = clientSites.get(normalizedName);
      if (exactMatch) {
        console.log('[DebugArkikValidator] ✅ Exact match found:', exactMatch.id);
        return exactMatch.id;
      }

      // Substring match
      for (const [siteName, siteData] of Array.from(clientSites.entries())) {
        if (siteName.includes(normalizedName) || normalizedName.includes(siteName)) {
          console.log('[DebugArkikValidator] ✅ Substring match found:', siteData.id);
          return siteData.id;
        }
      }
    }

    // STEP 2: Fallback - try database lookup with quote context
    console.log('[DebugArkikValidator] Direct match failed, trying database fallback...');
    
    if (quoteDetailId) {
      console.log('[DebugArkikValidator] Trying to resolve from quote_detail_id:', quoteDetailId);
      try {
        const constructionSiteInfo = await this.getConstructionSiteFromQuote(quoteDetailId, clientId);
        if (constructionSiteInfo) {
          console.log('[DebugArkikValidator] ✅ Resolved from quote:', constructionSiteInfo.name, 'ID:', constructionSiteInfo.id);
          return constructionSiteInfo.id;
        }
      } catch (error) {
        console.warn('[DebugArkikValidator] Quote fallback failed:', error);
      }
    }

    // STEP 3: Fallback - direct database lookup for the resolved site name
    console.log('[DebugArkikValidator] Trying direct database lookup for site:', name);
    try {
      const { data: constructionSite, error } = await supabase
        .from('construction_sites')
        .select('id, name, is_active')
        .eq('client_id', clientId)
        .ilike('name', name)
        .order('is_active', { ascending: false }) // Prefer active sites
        .limit(1)
        .maybeSingle();

      if (!error && constructionSite) {
        console.log('[DebugArkikValidator] ✅ Found via direct DB lookup:', constructionSite.name, 'ID:', constructionSite.id, '(active:', constructionSite.is_active + ')');
        return constructionSite.id;
      }
    } catch (error) {
      console.warn('[DebugArkikValidator] Direct DB lookup failed:', error);
    }

    console.log('[DebugArkikValidator] ❌ No construction site resolution possible');
    return null;
  }

  /**
   * Get construction site information from quote_detail (same logic as ArkikOrderCreator)
   */
  private async getConstructionSiteFromQuote(
    quoteDetailId: string, 
    clientId: string
  ): Promise<{ id: string; name: string } | null> {
    try {
      const { data: quoteDetail, error: quoteDetailError } = await supabase
        .from('quote_details')
        .select(`
          quote_id,
          quotes!inner (
            id,
            construction_site,
            client_id
          )
        `)
        .eq('id', quoteDetailId)
        .single();

      if (quoteDetailError || !quoteDetail) {
        console.error('[DebugArkikValidator] Error fetching quote detail:', quoteDetailError);
        return null;
      }

      const quote = quoteDetail.quotes;
      if (!quote || quote.client_id !== clientId) {
        console.warn('[DebugArkikValidator] Quote client mismatch or missing quote');
        return null;
      }

      // Now get the actual construction site ID from the construction_sites table
      const { data: constructionSite, error: siteError } = await supabase
        .from('construction_sites')
        .select('id, name, is_active')
        .eq('client_id', clientId)
        .eq('name', quote.construction_site)
        .order('is_active', { ascending: false }) // Prefer active sites
        .limit(1)
        .maybeSingle();

      if (siteError || !constructionSite) {
        console.warn('[DebugArkikValidator] Construction site not found:', quote.construction_site, 'for client:', clientId);
        return null;
      }

      return {
        id: constructionSite.id,
        name: constructionSite.name
      };
    } catch (error) {
      console.error('[DebugArkikValidator] Unexpected error in getConstructionSiteFromQuote:', error);
      return null;
    }
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

    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      console.log(`[DebugArkikValidator] 🔍 VALIDATION FAILURE CHECK for remision ${row.remision_number}:`);
      console.log(`[DebugArkikValidator]   - validationFailed flag: ${bestMatch.validationFailed}`);
      console.log(`[DebugArkikValidator]   - clientScore: ${bestMatch.clientScore}`);
      console.log(`[DebugArkikValidator]   - reasoning: ${bestMatch.reasoning}`);
    }

    // STEP 5: Check for strict client validation failure
    if (bestMatch.validationFailed) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.RECIPE_NO_PRICE,
        field_name: 'cliente_name',
        field_value: row.cliente_name,
        message: `No hay precio activo para el cliente "${row.cliente_name}" con la receta "${row.product_description || row.recipe_code}". Se encontró precio para un cliente diferente: "${bestMatch.pricing.business_name}" (similitud de cliente: ${(bestMatch.clientScore * 100).toFixed(1)}%).`,
        suggestion: {
          action: 'configure_client_pricing',
          suggestion: `Contacta al equipo comercial para configurar precio para el cliente "${row.cliente_name}" con esta receta, o verifica si el nombre del cliente debería ser "${bestMatch.pricing.business_name}".`
        },
        recoverable: true
      });

      return {
        row: { 
          ...row, 
          recipe_id: recipe.id, 
          validation_status: 'error', 
          validation_errors: errors 
        },
        errors
      };
    }

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

        // Use standardized recipe matching (exact matches only)
    const searchCode = primaryCode || fallbackCode || '';
    
    // Validate format
    if (!validateRecipeCodeFormat(searchCode)) {
      console.warn(`[DebugArkikValidator] Invalid recipe code format: "${searchCode}"`);
    }
    
    const recipe = findRecipeMatch(searchCode, recipes, false); // No fuzzy matching
    
    if (recipe) {
      console.log(`[DebugArkikValidator] ✅ Exact match found for: "${searchCode}" -> Recipe ID: ${recipe.id}`);
      return recipe;
    }

    // No exact matches found - provide suggestions for manual review
    const suggestions = getRecipeCodeSuggestions(searchCode, recipes, 3);
    
    let suggestionText = '';
    if (suggestions.length > 0) {
      suggestionText = ` Possible matches: [${suggestions.join(', ')}]`;
    }

    console.log(`[DebugArkikValidator] ❌ No exact match found for: "${searchCode}"${suggestionText}`);

    errors.push({
      row_number: row.row_number,
      error_type: ArkikErrorType.RECIPE_NOT_FOUND,
      field_name: 'product_description',
      field_value: searchCode,
      message: `Recipe not found: "${searchCode}"${suggestionText}`,
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

    // Single option - validate client similarity first
    if (pricingOptions.length === 1) {
      const pricing = pricingOptions[0];
      
      // CRITICAL: Even with single option, validate client similarity
      const clientScore = this.calculateClientSimilarity(clientName, pricing.business_name);
      const siteScore = this.calculateSiteSimilarity(siteName, pricing.construction_site);
      const quoteBonus = pricing.quote_id ? 2.0 : 0;
      
      if (isDevelopment) {
        console.log(`[DebugArkikValidator]   Single option found: ${pricing.source} - Quote ID: ${pricing.quote_id || 'N/A'}`);
        console.log(`[DebugArkikValidator]   Client similarity: "${clientName}" vs "${pricing.business_name}" = ${clientScore.toFixed(3)}`);
        console.log(`[DebugArkikValidator]   Checking if client match is acceptable...`);
      }
      
      // Check if single option meets strict validation criteria
      if (!this.isClientMatchAcceptable(clientName, pricing.business_name, clientScore)) {
        if (isDevelopment) {
          console.log(`[DebugArkikValidator]   ❌ CLIENT-RECIPE PRICING MISMATCH: Client "${clientName}" doesn't match pricing client "${pricing.business_name}" (similarity ${clientScore.toFixed(3)} too low)`);
        }
        
        const failedMatch = {
          pricing,
          clientScore,
          siteScore,
          quoteBonus,
          totalScore: clientScore + siteScore + quoteBonus,
          reasoning: 'CLIENT_RECIPE_PRICING_MISMATCH: No matching client-recipe pricing available',
          validationFailed: true
        };
        
        if (isDevelopment) {
          console.log(`[DebugArkikValidator]   🚨 RETURNING FAILED MATCH:`, failedMatch);
        }
        
        return failedMatch;
      }
      
      if (isDevelopment) {
        console.log(`[DebugArkikValidator]   ✅ Single option accepted: Client similarity ${clientScore.toFixed(3)} meets criteria`);
      }
      
      return {
        pricing,
        clientScore,
        siteScore,
        quoteBonus,
        totalScore: clientScore + siteScore + quoteBonus,
        reasoning: `Single pricing option (validated) - Client: ${clientScore.toFixed(2)}, Site: ${siteScore.toFixed(2)}`
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
    
    const bestMatch = scoredOptions[0];
    
    // STRICT CLIENT VALIDATION: Check if the best match meets our strict criteria
    if (!this.isClientMatchAcceptable(clientName, bestMatch.pricing.business_name, bestMatch.clientScore)) {
      if (isDevelopment) {
        console.log(`[DebugArkikValidator]   ❌ STRICT VALIDATION FAILED: Client match score ${bestMatch.clientScore.toFixed(2)} is too low for "${clientName}" vs "${bestMatch.pricing.business_name}"`);
      }
      
      // Return a match that indicates validation failure
      return {
        pricing: bestMatch.pricing,
        clientScore: bestMatch.clientScore,
        siteScore: bestMatch.siteScore,
        quoteBonus: bestMatch.quoteBonus,
        totalScore: bestMatch.totalScore,
        reasoning: 'STRICT_VALIDATION_FAILED: Client name match too weak',
        validationFailed: true // Flag to indicate strict validation failure
      };
    }
    
    return bestMatch;
  }

  private calculateClientSimilarity(inputName: string, businessName: string): number {
    if (!inputName || !businessName) return 0;
    
    const input = this.normalizeString(inputName);
    const business = this.normalizeString(businessName);
    
    // Check if this is a SEDENA-related client (special case - keep flexible)
    const isSedenaRelated = this.isSedenaRelatedClient(input, business);
    
    // Exact match
    if (input === business) return 1.0;
    
    // For SEDENA, maintain flexible matching
    if (isSedenaRelated) {
      // Substring match for SEDENA
      if (business.includes(input) || input.includes(business)) {
        return 0.8;
      }
      
      // Word overlap for SEDENA (more lenient)
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
    }
    
    // STRICT VALIDATION FOR NON-SEDENA CLIENTS
    // Only allow high-confidence matches
    
    // Strict substring match - must be substantial overlap
    if (business.includes(input) && input.length >= 5) {
      return 0.7; // Lower score for substring matches
    }
    if (input.includes(business) && business.length >= 5) {
      return 0.7;
    }
    
    // Very strict word overlap - require high percentage of matching words
    const inputWords = input.split(/\s+/).filter(w => w.length > 3); // Longer words only
    const businessWords = business.split(/\s+/).filter(w => w.length > 3);
    
    if (inputWords.length === 0 || businessWords.length === 0) return 0;
    
    const matchingWords = inputWords.filter(inputWord => 
      businessWords.some(businessWord => businessWord === inputWord) // Exact word match only
    );
    
    const matchPercentage = matchingWords.length / Math.max(inputWords.length, businessWords.length);
    
    // Require at least 80% of words to match for non-SEDENA clients
    if (matchPercentage >= 0.8 && matchingWords.length >= 2) {
      return 0.5 + (matchPercentage * 0.2); // Max 0.7 for word overlap
    }
    
    // No match for strict validation
    return 0;
  }

  /**
   * Check if client is SEDENA-related and should use flexible matching
   */
  private isSedenaRelatedClient(inputName: string, businessName: string): boolean {
    const sedenaKeywords = ['sedena', 'secretaria', 'defensa', 'nacional', 'fideicomiso', 'administracion'];
    const input = inputName.toLowerCase();
    const business = businessName.toLowerCase();
    
    // If either name contains SEDENA-related keywords, use flexible matching
    return sedenaKeywords.some(keyword => 
      input.includes(keyword) || business.includes(keyword)
    );
  }

  /**
   * Check if the client match meets our strict validation criteria
   */
  private isClientMatchAcceptable(inputName: string, businessName: string, clientScore: number): boolean {
    if (!inputName || !businessName) return false;
    
    const input = this.normalizeString(inputName);
    const business = this.normalizeString(businessName);
    
    // Always accept exact matches
    if (input === business) return true;
    
    // SEDENA gets flexible treatment - accept any score > 0.5
    if (this.isSedenaRelatedClient(input, business)) {
      return clientScore >= 0.5;
    }
    
    // STRICT CRITERIA FOR NON-SEDENA CLIENTS
    // Require minimum score of 0.7 for non-SEDENA clients
    // This means substantial overlap is required
    const MIN_ACCEPTABLE_SCORE = 0.7;
    
    if (clientScore < MIN_ACCEPTABLE_SCORE) {
      return false;
    }
    
    // Additional validation: if score is between 0.7-0.8, require that one name contains the other
    // This prevents weak partial matches from passing
    if (clientScore < 0.8) {
      const hasSubstantialOverlap = business.includes(input) || input.includes(business);
      if (!hasSubstantialOverlap) {
        return false;
      }
    }
    
    return true;
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

  // DEPRECATED: Use standardized functions from recipeCodeUtils instead
  // Kept for client/site name normalization only
  private normalizeString(str: string): string {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // REMOVED: Old fuzzy matching logic that caused recipe mismatches
  // The old isFuzzyMatch and levenshteinDistance methods have been replaced
  // with standardized utilities from recipeCodeUtils.ts

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
