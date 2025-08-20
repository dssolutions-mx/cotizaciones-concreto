/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase/client';
import { ArkikErrorType, StagingRemision, ValidationError } from '@/types/arkik';
import { 
  normalizeRecipeCode, 
  exactRecipeMatch, 
  findRecipeMatch, 
  getRecipeCodeSuggestions,
  validateRecipeCodeFormat 
} from '@/lib/utils/recipeCodeUtils';

type PurePriceDrivenMaps = {
  // Recipe lookup
  recipeByArkikCode: Map<string, any>;
  recipeByShortCode: Map<string, any>;
  
  // Price lookup by recipe_id (product_prices + quotes)
  pricesByRecipeId: Map<string, any[]>;
  quotesPricesByRecipeId: Map<string, any[]>;
  
  // Supporting data
  clientsById: Map<string, any>;
  sitesById: Map<string, any>;
  materialCodesMapped: Set<string>;
  duplicateRemisiones: Set<string>;
  
  // Smart caching for performance
  resolvedCombinations: Map<string, any>; // recipe+client+site combinations
};

interface PriceMatch {
  price: any;
  clientScore: number;
  siteScore: number;
  totalScore: number;
  source: 'product_prices' | 'quotes';
}

export class PurePriceDrivenArkikValidator {
  private plantId: string;
  private cache: PurePriceDrivenMaps | null = null;
  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    dbQueries: 0,
    processedRows: 0,
    priceMatches: {
      direct: 0,           // Single price found
      clientFiltered: 0,   // Multiple prices, filtered by client
      siteFiltered: 0,     // Further filtered by site
      quoteFallback: 0,    // Found in quotes when product_prices missing
      fallback: 0          // Used best guess
    }
  };

  constructor(plantId: string) {
    this.plantId = plantId;
  }

  async validateBatch(rows: StagingRemision[]): Promise<{ 
    validated: StagingRemision[]; 
    errors: ValidationError[];
    stats: typeof this.stats;
  }> {
    console.log(`[PurePriceDrivenValidator] Starting pure price-driven validation for ${rows.length} rows`);
    const startTime = Date.now();
    
    this.cache = await this.buildPurePriceDrivenMaps(rows);
    
    const allErrors: ValidationError[] = [];
    const validated: StagingRemision[] = [];
    
    for (const row of rows) {
      this.stats.processedRows++;
      const result = this.validateRowPurePriceDriven(row, allErrors);
      validated.push(result);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[PurePriceDrivenValidator] Completed in ${duration}ms`, this.stats);
    
    return { validated, errors: allErrors, stats: this.stats };
  }

  private async buildPurePriceDrivenMaps(rows: StagingRemision[]): Promise<PurePriceDrivenMaps> {
    const maps: PurePriceDrivenMaps = {
      recipeByArkikCode: new Map(),
      recipeByShortCode: new Map(),
      pricesByRecipeId: new Map(),
      quotesPricesByRecipeId: new Map(),
      clientsById: new Map(),
      sitesById: new Map(),
      materialCodesMapped: new Set(),
      duplicateRemisiones: new Set(),
      resolvedCombinations: new Map()
    };

    // Extract unique recipe codes ONLY (ignore client codes completely)
    const uniqueRecipeCodes = new Set<string>();
    const uniqueRemisionNumbers = new Set<string>();
    const uniqueMaterialCodes = new Set<string>();

    rows.forEach(r => {
      if (r.product_description?.trim()) {
        uniqueRecipeCodes.add(this.normalizeString(r.product_description));
      }
      if (r.recipe_code?.trim()) {
        uniqueRecipeCodes.add(this.normalizeString(r.recipe_code));
      }
      if (r.remision_number?.trim()) {
        uniqueRemisionNumbers.add(r.remision_number);
      }
      Object.keys(r.materials_teorico || {}).forEach(code => uniqueMaterialCodes.add(code));
      Object.keys(r.materials_real || {}).forEach(code => uniqueMaterialCodes.add(code));
    });

    console.log(`[PurePriceDrivenValidator] Loading data for ${uniqueRecipeCodes.size} recipe codes (ignoring client codes)`);

    // Load recipes, prices, and quotes in parallel
    await Promise.all([
      this.loadRecipesAndPricesWithQuotesFallback(maps, uniqueRecipeCodes),
      this.loadSupportingData(maps, uniqueRemisionNumbers, uniqueMaterialCodes)
    ]);

    return maps;
  }

  private async loadRecipesAndPricesWithQuotesFallback(maps: PurePriceDrivenMaps, recipeCodes: Set<string>) {
    this.stats.dbQueries++;
    
    // Load recipes for this plant
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, recipe_code, arkik_long_code, arkik_short_code')
      .eq('plant_id', this.plantId);

    if (!recipes) return;

    // Index recipes with fuzzy matching
    recipes.forEach(recipe => {
      if (recipe.arkik_long_code) {
        maps.recipeByArkikCode.set(normalizeRecipeCode(recipe.arkik_long_code), recipe);
      }
      if (recipe.recipe_code) {
        maps.recipeByShortCode.set(normalizeRecipeCode(recipe.recipe_code), recipe);
      }

      // DISABLED: Fuzzy matching removed to prevent incorrect matches
      // The old fuzzy matching logic caused recipe mismatches
    });

    console.log(`[PurePriceDrivenValidator] Loaded ${recipes.length} recipes`);

    const recipeIds = recipes.map(r => r.id);
    if (recipeIds.length === 0) return;

    // Load product_prices AND quotes in parallel
    await Promise.all([
      this.loadProductPrices(maps, recipeIds),
      this.loadQuotesPrices(maps, recipeIds)
    ]);
  }

  private async loadProductPrices(maps: PurePriceDrivenMaps, recipeIds: string[]) {
    this.stats.dbQueries++;
    
    const { data: prices } = await supabase
      .from('product_prices')
      .select(`
        id, recipe_id, client_id, construction_site, 
        base_price, effective_date, updated_at,
        clients:client_id(id, business_name, client_code, rfc)
      `)
      .eq('plant_id', this.plantId)
      .eq('is_active', true)
      .in('recipe_id', recipeIds);

    if (!prices) return;

    // Group prices by recipe_id and populate client maps
    prices.forEach(price => {
      // Group by recipe
      if (!maps.pricesByRecipeId.has(price.recipe_id)) {
        maps.pricesByRecipeId.set(price.recipe_id, []);
      }
      maps.pricesByRecipeId.get(price.recipe_id)!.push({
        ...price,
        source: 'product_prices'
      });

      // Cache client info
      if (price.clients) {
        maps.clientsById.set(price.client_id, price.clients);
      }
    });

    console.log(`[PurePriceDrivenValidator] Loaded ${prices.length} product prices`);
  }

  private async loadQuotesPrices(maps: PurePriceDrivenMaps, recipeIds: string[]) {
    this.stats.dbQueries++;
    
    // Load approved quotes as fallback price source (EXACTLY like debug validator)
    const { data: quoteDetails, error: quotesError } = await supabase
      .from('quote_details')
      .select(`
        id, recipe_id, final_price,
        quotes:quote_id(id, client_id, construction_site,
          clients:client_id(business_name, client_code))
      `)
      .eq('quotes.plant_id', this.plantId)
      .eq('quotes.status', 'APPROVED')
      .in('recipe_id', recipeIds);

    if (quotesError) {
      console.log(`[PurePriceDrivenValidator] Error loading quotes: ${quotesError.message}`);
      return;
    }

    if (!quoteDetails) return;

    console.log(`[PurePriceDrivenValidator] Raw quotes data: ${quoteDetails.length} quote_details found`);

    // Process quotes (EXACTLY like debug validator)
    quoteDetails.forEach(quote => {
      const quoteData = quote.quotes as any;
      if (quoteData?.clients) {
        if (!maps.quotesPricesByRecipeId.has(quote.recipe_id)) {
          maps.quotesPricesByRecipeId.set(quote.recipe_id, []);
        }

        maps.quotesPricesByRecipeId.get(quote.recipe_id)!.push({
          id: quote.id,
          recipe_id: quote.recipe_id,
          client_id: quoteData.client_id,
          construction_site: quoteData.construction_site || '',
          base_price: Number(quote.final_price),
          source: 'quotes',
          clients: quoteData.clients
        });

        // Cache client info from quotes
        maps.clientsById.set(quoteData.client_id, quoteData.clients);
      }
    });

    const totalQuotesPrices = Array.from(maps.quotesPricesByRecipeId.values()).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[PurePriceDrivenValidator] Loaded ${totalQuotesPrices} quote prices for ${maps.quotesPricesByRecipeId.size} recipes`);
  }

  private async loadSupportingData(
    maps: PurePriceDrivenMaps, 
    remisionNumbers: Set<string>, 
    materialCodes: Set<string>
  ) {
    const promises = [];

    // Load material mappings
    if (materialCodes.size > 0) {
      promises.push(
        supabase
          .from('arkik_material_mapping')
          .select('arkik_code')
          .eq('plant_id', this.plantId)
          .eq('is_active', true)
          .in('arkik_code', Array.from(materialCodes))
          .then(({ data }) => {
            data?.forEach(m => maps.materialCodesMapped.add(m.arkik_code));
          })
      );
    }

    // Load duplicate remisiones
    if (remisionNumbers.size > 0) {
      promises.push(
        supabase
          .from('remisiones')
          .select('remision_number')
          .eq('plant_id', this.plantId)
          .in('remision_number', Array.from(remisionNumbers))
          .then(({ data }) => {
            data?.forEach(r => maps.duplicateRemisiones.add(r.remision_number));
          })
      );
    }

    if (promises.length > 0) {
      this.stats.dbQueries += promises.length;
      await Promise.all(promises);
    }
  }

  private validateRowPurePriceDriven(row: StagingRemision, allErrors: ValidationError[]): StagingRemision {
    const errors: ValidationError[] = [...(row.validation_errors || [])];
    
    console.log(`\n[PurePriceDrivenValidator] === Processing Remisión ${row.remision_number} ===`);
    console.log(`[PurePriceDrivenValidator] Input data:`);
    console.log(`[PurePriceDrivenValidator]   - Product Description: "${row.product_description}"`);
    console.log(`[PurePriceDrivenValidator]   - Recipe Code: "${row.recipe_code}"`);
    console.log(`[PurePriceDrivenValidator]   - Client Name: "${row.cliente_name}"`);
    console.log(`[PurePriceDrivenValidator]   - Client Code: "${row.cliente_codigo}" (IGNORED per strategy)`);
    console.log(`[PurePriceDrivenValidator]   - Site Name: "${row.obra_name}"`);
    
    // Create cache key - NO CLIENT CODES from Excel!
    const cacheKey = `${this.normalizeString(row.product_description || row.recipe_code || '')}::${this.normalizeString(row.cliente_name || '')}::${this.normalizeString(row.obra_name || '')}`;
    
    // Check cache first
    if (this.cache!.resolvedCombinations.has(cacheKey)) {
      this.stats.cacheHits++;
      console.log(`[PurePriceDrivenValidator] ✅ Using cached result`);
      const cached = this.cache!.resolvedCombinations.get(cacheKey);
      return this.applyResolvedData(row, cached, errors);
    }

    this.stats.cacheMisses++;

    // Step 1: Find recipe
    console.log(`[PurePriceDrivenValidator] STEP 1: Finding recipe...`);
    const recipe = this.findRecipe(row, errors);
    if (!recipe) {
      console.log(`[PurePriceDrivenValidator] ❌ Recipe not found - marking as error`);
      return this.finalizeBadRow(row, errors, allErrors);
    }
    console.log(`[PurePriceDrivenValidator] ✅ Recipe found: ID=${recipe.id}, Code=${recipe.recipe_code}, Arkik=${recipe.arkik_long_code}`);

    // Step 2: Get unified pricing
    console.log(`[PurePriceDrivenValidator] STEP 2: Loading unified pricing...`);
    const productPrices = this.cache!.pricesByRecipeId.get(recipe.id) || [];
    const quotesPrices = this.cache!.quotesPricesByRecipeId.get(recipe.id) || [];
    const allPrices = [...productPrices, ...quotesPrices];
    
    console.log(`[PurePriceDrivenValidator] ✅ Found ${allPrices.length} pricing options`);
    allPrices.forEach((p, idx) => {
      console.log(`[PurePriceDrivenValidator]   ${idx + 1}. ${p.source.toUpperCase()}: Client="${p.clients?.business_name}", Site="${p.construction_site}", Price=$${p.base_price}`);
    });

    if (allPrices.length === 0) {
      console.log(`[PurePriceDrivenValidator] ❌ No pricing found for recipe ${recipe.id}`);
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.RECIPE_NO_PRICE,
        field_name: 'recipe_id',
        field_value: recipe.id,
        message: `No pricing found for recipe "${recipe.arkik_long_code || recipe.recipe_code}"`,
        recoverable: true
      });
      return this.finalizeBadRow(row, errors, allErrors);
    }

    // Step 3: Smart Client/Site Matching
    console.log(`[PurePriceDrivenValidator] STEP 3: Smart matching...`);
    const bestPriceMatch = this.selectBestPricePurely(allPrices, row);
    
    // Track quote fallback usage
    if (bestPriceMatch.source === 'quotes') {
      this.stats.priceMatches.quoteFallback++;
    }

    // Step 4: Build resolved data - EXACTLY like debug validator
    const resolvedData = {
      recipe_id: recipe.id,
      client_id: bestPriceMatch.price.client_id,
      construction_site_id: null, // Will be resolved if construction_sites exist (like debug validator)
      unit_price: Number(bestPriceMatch.price.base_price),
      price_source: bestPriceMatch.source, // Use source directly (like debug validator)
      suggested_client_id: bestPriceMatch.price.client_id,
      suggested_site_name: bestPriceMatch.price.construction_site || ''
    };

    // Cache the result
    this.cache!.resolvedCombinations.set(cacheKey, resolvedData);

    // Validate other aspects
    this.validateMaterials(row, errors);
    this.validateDuplicateRemision(row, errors);

    console.log(`[PurePriceDrivenValidator] ✅ Row validated successfully`);
    
    allErrors.push(...errors);
    return this.applyResolvedData(row, resolvedData, errors);
  }

  private selectBestPricePurely(allPrices: any[], row: StagingRemision): PriceMatch {
    // COMPLETELY IGNORE Excel client codes - only use client names from Excel
    const clientName = this.normalizeString(row.cliente_name || '');
    const siteName = this.normalizeString(row.obra_name || '');
    
    console.log(`[PurePriceDrivenValidator] Found ${allPrices.length} prices for recipe. Client from Excel: "${clientName}", Site: "${siteName}"`);

    // If only one price, use it directly - EXACTLY like debug validator
    if (allPrices.length === 1) {
      this.stats.priceMatches.direct++;
      const pricing = allPrices[0];
      console.log(`[PurePriceDrivenValidator] Single pricing option: Client="${pricing.clients?.business_name}", Site="${pricing.construction_site}", Price=$${pricing.base_price}`);
      return {
        price: pricing,
        clientScore: 1,
        siteScore: 1,
        totalScore: 2, // Match debug validator's "2.00" total score
        source: pricing.source
      };
    }

    // Score each price based ONLY on client name and site similarity - EXACTLY like debug validator
    const scoredPrices: PriceMatch[] = allPrices.map(price => {
      const client = this.cache!.clientsById.get(price.client_id);
      const clientScore = this.calculateClientSimilarity(clientName, client?.business_name || '');
      const siteScore = this.calculateSiteSimilarity(siteName, price.construction_site || '');
      
      console.log(`[PurePriceDrivenValidator] Scoring option: "${client?.business_name}" / "${price.construction_site}"`);
      console.log(`[PurePriceDrivenValidator]   - Client similarity: ${clientScore.toFixed(2)}`);
      console.log(`[PurePriceDrivenValidator]   - Site similarity: ${siteScore.toFixed(2)}`);
      console.log(`[PurePriceDrivenValidator]   - Total score: ${(clientScore + siteScore).toFixed(2)}`);
      
      return {
        price,
        clientScore,
        siteScore,
        totalScore: clientScore + siteScore,
        source: price.source
      };
    });

    // Sort by total score (highest first), prefer product_prices over quotes if tied
    scoredPrices.sort((a, b) => {
      if (Math.abs(a.totalScore - b.totalScore) < 0.1) {
        // If scores are very close, prefer product_prices
        if (a.source === 'product_prices' && b.source === 'quotes') return -1;
        if (a.source === 'quotes' && b.source === 'product_prices') return 1;
      }
      return b.totalScore - a.totalScore;
    });
    
    const bestMatch = scoredPrices[0];
    console.log(`[PurePriceDrivenValidator] Best match selected:`);
    console.log(`[PurePriceDrivenValidator]   - Source: ${bestMatch.source.toUpperCase()}`);
    console.log(`[PurePriceDrivenValidator]   - Client: "${this.cache!.clientsById.get(bestMatch.price.client_id)?.business_name}" (score: ${bestMatch.clientScore.toFixed(2)})`);
    console.log(`[PurePriceDrivenValidator]   - Site: "${bestMatch.price.construction_site}" (score: ${bestMatch.siteScore.toFixed(2)})`);
    console.log(`[PurePriceDrivenValidator]   - Total Score: ${bestMatch.totalScore.toFixed(2)}`);

    // Determine which filtering strategy was used
    const hasGoodClientMatch = scoredPrices.some(p => p.clientScore > 0.7);
    const hasGoodSiteMatch = scoredPrices.some(p => p.siteScore > 0.7);
    
    if (hasGoodClientMatch && hasGoodSiteMatch) {
      this.stats.priceMatches.siteFiltered++;
    } else if (hasGoodClientMatch) {
      this.stats.priceMatches.clientFiltered++;
    } else {
      this.stats.priceMatches.fallback++;
    }

    return bestMatch;
  }

  private calculateClientSimilarity(inputName: string, businessName: string): number {
    if (!inputName || !businessName) return 0;
    
    const input = this.normalizeString(inputName);      // "sedena"
    const business = this.normalizeString(businessName); // "fideicomiso de administracion y pago sedena 80778"
    
    // Exact match
    if (input === business) return 1.0;
    
    // Substring match (very common for abbreviated names) - EXACTLY like debug validator
    if (business.includes(input) || input.includes(business)) {
      return 0.9;
    }
    
    // Word overlap analysis - EXACTLY like debug validator
    const inputWords = input.split(/\s+/).filter(w => w.length > 2);
    const businessWords = business.split(/\s+/).filter(w => w.length > 2);
    
    const matchingWords = inputWords.filter(inputWord => 
      businessWords.some(businessWord => 
        businessWord.includes(inputWord) || inputWord.includes(businessWord)
      )
    );
    
    if (matchingWords.length > 0) {
      const overlapRatio = matchingWords.length / Math.max(inputWords.length, businessWords.length);
      return 0.6 + (overlapRatio * 0.3); // 0.6 to 0.9 range
    }
    
    return 0;
  }

  private calculateSiteSimilarity(inputSite: string, pricingSite: string): number {
    if (!inputSite || !pricingSite) return 0.1;
    
    const input = this.normalizeString(inputSite).trim();    // "viaducto" 
    const pricing = this.normalizeString(pricingSite).trim(); // "viaducto"
    
    // Exact match - EXACTLY like debug validator
    if (input === pricing) return 1.0;
    
    // Handle common whitespace issues - EXACTLY like debug validator
    if (input.replace(/\s+/g, '') === pricing.replace(/\s+/g, '')) return 0.95;
    
    // Substring match - EXACTLY like debug validator
    if (pricing.includes(input) || input.includes(pricing)) {
      return 0.9;
    }
    
    return 0.1; // Small base score
  }

  private findRecipe(row: StagingRemision, errors: ValidationError[]): any | null {
    const primaryCode = row.product_description?.trim();
    const fallbackCode = row.recipe_code?.trim();
    
    const searchCode = primaryCode || fallbackCode || '';
    if (!searchCode) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.RECIPE_NOT_FOUND,
        field_name: 'product_description',
        field_value: '',
        message: 'No recipe codes provided',
        suggestion: null,
        recoverable: true
      });
      return null;
    }
    
    // Validate format
    if (!validateRecipeCodeFormat(searchCode)) {
      console.warn(`[PriceDrivenValidator] Invalid recipe code format: "${searchCode}"`);
    }
    
    let recipe = null;
    
    // Try exact match with standardized normalization
    if (primaryCode) {
      recipe = this.cache!.recipeByArkikCode.get(normalizeRecipeCode(primaryCode));
    }
    
    if (!recipe && fallbackCode) {
      recipe = this.cache!.recipeByShortCode.get(normalizeRecipeCode(fallbackCode)) ||
               this.cache!.recipeByArkikCode.get(normalizeRecipeCode(fallbackCode));
    }
    
    if (!recipe) {
      // Get suggestions for manual review
      const allRecipes = Array.from(this.cache!.recipeByArkikCode.values());
      const suggestions = getRecipeCodeSuggestions(searchCode, allRecipes, 3);
      
      let suggestionText = '';
      if (suggestions.length > 0) {
        suggestionText = ` Possible matches: [${suggestions.join(', ')}]`;
      }
      
      console.log(`[PriceDrivenValidator] ❌ No exact match found for: "${searchCode}"${suggestionText}`);
      
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.RECIPE_NOT_FOUND,
        field_name: 'product_description',
        field_value: searchCode,
        message: `Receta no encontrada: "${searchCode}"${suggestionText}`,
        suggestion: suggestions.length > 0 ? suggestions[0] : null,
        recoverable: true
      });
    } else {
      console.log(`[PriceDrivenValidator] ✅ Exact match found for: "${searchCode}" -> Recipe ID: ${recipe.id}`);
    }
    
    return recipe;
  }

  private validateMaterials(row: StagingRemision, errors: ValidationError[]) {
    const codes = new Set<string>([
      ...Object.keys(row.materials_teorico || {}),
      ...Object.keys(row.materials_real || {})
    ]);

    for (const code of codes) {
      if (!this.cache!.materialCodesMapped.has(code)) {
        errors.push({
          row_number: row.row_number,
          error_type: ArkikErrorType.MATERIAL_NOT_FOUND,
          field_name: 'material_code',
          field_value: code,
          message: `Material no mapeado: ${code}`,
          suggestion: { action: 'add_mapping', arkik_code: code },
          recoverable: true
        });
      }
    }
  }

  private validateDuplicateRemision(row: StagingRemision, errors: ValidationError[]) {
    if (this.cache!.duplicateRemisiones.has(row.remision_number)) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.DUPLICATE_REMISION,
        field_name: 'remision_number',
        field_value: row.remision_number,
        message: 'Remisión duplicada en el sistema',
        suggestion: { action: 'skip_or_update' },
        recoverable: false
      });
    }
  }

  private applyResolvedData(
    row: StagingRemision, 
    resolved: any, 
    errors: ValidationError[]
  ): StagingRemision {
    const hasNonRecoverableErrors = errors.some(e => !e.recoverable);
    const status = hasNonRecoverableErrors ? 'error' : (errors.length > 0 ? 'warning' : 'valid');
    
    return {
      ...row,
      recipe_id: resolved.recipe_id,
      client_id: resolved.client_id,
      construction_site_id: resolved.construction_site_id,
      unit_price: resolved.unit_price,
      price_source: resolved.price_source,
      suggested_client_id: resolved.suggested_client_id,
      suggested_site_name: resolved.suggested_site_name,
      validation_status: status,
      validation_errors: errors
    };
  }

  private finalizeBadRow(
    row: StagingRemision, 
    errors: ValidationError[], 
    allErrors: ValidationError[]
  ): StagingRemision {
    allErrors.push(...errors);
    return {
      ...row,
      validation_status: 'error',
      validation_errors: errors
    };
  }

  // Helper methods
  // DEPRECATED: Use standardized functions from recipeCodeUtils instead
  // Kept for client/site name normalization only
  private normalizeString(str: string): string {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // REMOVED: Old fuzzy matching logic that caused recipe mismatches
  // The old isFuzzyRecipeMatch method has been replaced with standardized utilities

  private extractSiteId(price: any): string | null {
    // For quotes, we might not have the construction_sites object
    // We'll need to look it up later or handle it differently
    return null; // Will be resolved in the UI layer
  }

  private determinePriceSource(match: PriceMatch): 'client_site' | 'client' | 'plant' | 'quotes' {
    if (match.source === 'quotes') return 'quotes';
    if (match.clientScore > 0.7 && match.siteScore > 0.7) return 'client_site';
    if (match.clientScore > 0.7) return 'client';
    return 'plant';
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
}
