/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase/client';
import { ArkikErrorType, StagingRemision, ValidationError } from '@/types/arkik';

type UnifiedPricingData = {
  recipe_id: string;
  client_id: string;
  construction_site: string;
  price: number;
  source: 'price' | 'quote';
  date_ref: string;
  business_name: string;
  client_code?: string;
  quote_id?: string;
  price_id?: string;
};

type EnhancedMaps = {
  // Recipe lookup
  recipeByArkikCode: Map<string, any>;
  recipeByShortCode: Map<string, any>;
  
  // Unified pricing (prices + quotes)
  pricingByRecipeId: Map<string, UnifiedPricingData[]>;
  
  // Supporting data
  clientsById: Map<string, any>;
  sitesById: Map<string, any>;
  materialCodesMapped: Set<string>;
  duplicateRemisiones: Set<string>;
  
  // Performance optimization
  resolvedCombinations: Map<string, any>;
  fuzzyRecipeCache: Map<string, any>;
};

interface PricingMatch {
  pricing: UnifiedPricingData;
  clientScore: number;
  siteScore: number;
  sourceScore: number;
  recencyScore: number;
  totalScore: number;
  confidence: 'high' | 'medium' | 'low';
}

export class FinalEnhancedArkikValidator {
  private plantId: string;
  private cache: EnhancedMaps | null = null;
  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    dbQueries: 0,
    processedRows: 0,
    pricingMatches: {
      direct: 0,           // Single pricing option
      clientFiltered: 0,   // Multiple options, filtered by client
      siteFiltered: 0,     // Further filtered by site
      fallback: 0,         // Best guess used
      fromPrices: 0,       // Sourced from product_prices
      fromQuotes: 0        // Sourced from approved quotes
    },
    fuzzyMatches: {
      recipes: 0,
      clients: 0,
      sites: 0
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
    console.log(`[FinalValidator] Starting enhanced validation for ${rows.length} rows`);
    const startTime = Date.now();
    
    this.cache = await this.buildEnhancedMaps(rows);
    
    const allErrors: ValidationError[] = [];
    const validated: StagingRemision[] = [];
    
    for (const row of rows) {
      this.stats.processedRows++;
      const result = this.validateRowEnhanced(row, allErrors);
      validated.push(result);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[FinalValidator] Completed in ${duration}ms`, this.stats);
    
    return { validated, errors: allErrors, stats: this.stats };
  }

  private async buildEnhancedMaps(rows: StagingRemision[]): Promise<EnhancedMaps> {
    const maps: EnhancedMaps = {
      recipeByArkikCode: new Map(),
      recipeByShortCode: new Map(),
      pricingByRecipeId: new Map(),
      clientsById: new Map(),
      sitesById: new Map(),
      materialCodesMapped: new Set(),
      duplicateRemisiones: new Set(),
      resolvedCombinations: new Map(),
      fuzzyRecipeCache: new Map()
    };

    // Extract unique values
    const uniqueRecipeCodes = new Set<string>();
    const uniqueRemisionNumbers = new Set<string>();
    const uniqueMaterialCodes = new Set<string>();

    rows.forEach(r => {
      // PRIMARY: product_description (arkik_long_code)
      if (r.product_description?.trim()) {
        uniqueRecipeCodes.add(this.normalizeString(r.product_description));
      }
      // FALLBACK: recipe_code (prod_tecnico)  
      if (r.recipe_code?.trim()) {
        uniqueRecipeCodes.add(this.normalizeString(r.recipe_code));
      }
      if (r.remision_number?.trim()) {
        uniqueRemisionNumbers.add(r.remision_number);
      }
      Object.keys(r.materials_teorico || {}).forEach(code => uniqueMaterialCodes.add(code));
      Object.keys(r.materials_real || {}).forEach(code => uniqueMaterialCodes.add(code));
    });

    console.log(`[FinalValidator] Loading data for ${uniqueRecipeCodes.size} recipe codes`);

    // Load all data in parallel
    await Promise.all([
      this.loadRecipesEnhanced(maps, uniqueRecipeCodes),
      this.loadUnifiedPricing(maps),
      this.loadSupportingData(maps, uniqueRemisionNumbers, uniqueMaterialCodes)
    ]);

    return maps;
  }

  private async loadRecipesEnhanced(maps: EnhancedMaps, recipeCodes: Set<string>) {
    this.stats.dbQueries++;
    
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, recipe_code, arkik_long_code, arkik_short_code')
      .eq('plant_id', this.plantId);

    if (!recipes) return;

    // Index recipes with exact and fuzzy matching
    recipes.forEach(recipe => {
      // Exact matching
      if (recipe.arkik_long_code) {
        maps.recipeByArkikCode.set(this.normalizeString(recipe.arkik_long_code), recipe);
      }
      if (recipe.recipe_code) {
        maps.recipeByShortCode.set(this.normalizeString(recipe.recipe_code), recipe);
      }

      // Build fuzzy cache for input codes
      recipeCodes.forEach(inputCode => {
        if (this.isFuzzyRecipeMatch(inputCode, recipe)) {
          maps.fuzzyRecipeCache.set(this.normalizeString(inputCode), recipe);
          this.stats.fuzzyMatches.recipes++;
        }
      });
    });

    console.log(`[FinalValidator] Loaded ${recipes.length} recipes`);
  }

  private async loadUnifiedPricing(maps: EnhancedMaps) {
    const recipeIds = Array.from(maps.recipeByArkikCode.values())
      .concat(Array.from(maps.recipeByShortCode.values()))
      .map(r => r.id);
    
    if (recipeIds.length === 0) return;

    console.log(`[FinalValidator] Loading unified pricing for ${recipeIds.length} recipes`);

    // Load active product prices
    this.stats.dbQueries++;
    const { data: prices } = await supabase
      .from('product_prices')
      .select(`
        id, recipe_id, client_id, construction_site, 
        base_price, effective_date, updated_at,
        clients:client_id(id, business_name, client_code)
      `)
      .eq('plant_id', this.plantId)
      .eq('is_active', true)
      .in('recipe_id', recipeIds);

    // Load approved quotes (CRITICAL ADDITION)
    this.stats.dbQueries++;
    const { data: quotes } = await supabase
      .from('quote_details')
      .select(`
        id, recipe_id, final_price,
        quotes:quote_id(id, client_id, construction_site, approval_date, created_at,
          clients:client_id(id, business_name, client_code))
      `)
      .eq('quotes.plant_id', this.plantId)
      .eq('quotes.status', 'APPROVED')
      .in('recipe_id', recipeIds);

    // Convert to unified format
    const unifiedPricing: UnifiedPricingData[] = [];

    // Add prices
    (prices || []).forEach(price => {
      if (price.clients) {
        unifiedPricing.push({
          recipe_id: price.recipe_id,
          client_id: price.client_id,
          construction_site: price.construction_site || '',
          price: Number(price.base_price),
          source: 'price',
          date_ref: price.effective_date || price.updated_at,
          business_name: price.clients.business_name,
          client_code: price.clients.client_code,
          price_id: price.id
        });
        
        // Cache client info
        maps.clientsById.set(price.client_id, price.clients);
      }
    });

    // Add quotes (CRITICAL: This catches missing prices like 6-250-2-B-28-18-D-2-000)
    (quotes || []).forEach(quote => {
      const quoteData = quote.quotes as any;
      if (quoteData?.clients) {
        unifiedPricing.push({
          recipe_id: quote.recipe_id,
          client_id: quoteData.client_id,
          construction_site: quoteData.construction_site || '',
          price: Number(quote.final_price),
          source: 'quote',
          date_ref: quoteData.approval_date || quoteData.created_at,
          business_name: quoteData.clients.business_name,
          client_code: quoteData.clients.client_code,
          quote_id: quote.id
        });
        
        // Cache client info
        maps.clientsById.set(quoteData.client_id, quoteData.clients);
      }
    });

    // Group by recipe_id and sort by preference (prices > quotes > newest)
    const groupedPricing = new Map<string, UnifiedPricingData[]>();
    unifiedPricing.forEach(pricing => {
      if (!groupedPricing.has(pricing.recipe_id)) {
        groupedPricing.set(pricing.recipe_id, []);
      }
      groupedPricing.get(pricing.recipe_id)!.push(pricing);
    });

    // Sort within each recipe group
    groupedPricing.forEach((pricingList, recipeId) => {
      pricingList.sort((a, b) => {
        // 1. Prefer prices over quotes
        if (a.source !== b.source) {
          return a.source === 'price' ? -1 : 1;
        }
        // 2. Prefer newer entries
        return new Date(b.date_ref).getTime() - new Date(a.date_ref).getTime();
      });
      maps.pricingByRecipeId.set(recipeId, pricingList);
    });

    // Update stats
    this.stats.pricingMatches.fromPrices = (prices || []).length;
    this.stats.pricingMatches.fromQuotes = (quotes || []).length;

    console.log(`[FinalValidator] Loaded ${unifiedPricing.length} pricing entries (${prices?.length || 0} prices + ${quotes?.length || 0} quotes)`);
  }

  private async loadSupportingData(
    maps: EnhancedMaps, 
    remisionNumbers: Set<string>, 
    materialCodes: Set<string>
  ) {
    const promises = [];

    // Material mappings
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

    // Duplicate remisiones
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

  private validateRowEnhanced(row: StagingRemision, allErrors: ValidationError[]): StagingRemision {
    const errors: ValidationError[] = [...(row.validation_errors || [])];
    
    // Create cache key (IGNORING cliente_codigo as requested!)
    const cacheKey = `${this.normalizeString(row.product_description || row.recipe_code || '')}::${this.normalizeString(row.cliente_name || '')}::${this.normalizeString(row.obra_name || '')}`;
    
    // Check cache first
    if (this.cache!.resolvedCombinations.has(cacheKey)) {
      this.stats.cacheHits++;
      const cached = this.cache!.resolvedCombinations.get(cacheKey);
      return this.applyResolvedData(row, cached, errors, allErrors);
    }

    this.stats.cacheMisses++;

    // Step 1: Find recipe (prioritizing product_description)
    const recipe = this.findRecipeEnhanced(row, errors);
    if (!recipe) {
      return this.finalizeBadRow(row, errors, allErrors);
    }

    // Step 2: Get unified pricing (prices + quotes)
    const pricingOptions = this.cache!.pricingByRecipeId.get(recipe.id) || [];
    if (pricingOptions.length === 0) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.RECIPE_NO_PRICE,
        field_name: 'recipe_id',
        field_value: recipe.id,
        message: `No hay precios ni cotizaciones para la receta "${recipe.arkik_long_code || recipe.recipe_code}"`,
        recoverable: true
      });
      return this.finalizeBadRow(row, errors, allErrors);
    }

    // Step 3: Smart pricing selection (IGNORING cliente_codigo!)
    const bestMatch = this.selectBestPricingEnhanced(pricingOptions, row);
    
    // Step 4: Build resolved data
    const resolvedData = {
      recipe_id: recipe.id,
      client_id: bestMatch.pricing.client_id,
      construction_site_id: null, // Will be resolved if construction_sites exist
      unit_price: bestMatch.pricing.price,
      price_source: bestMatch.pricing.source,
      suggested_client_id: bestMatch.pricing.client_id,
      suggested_site_name: bestMatch.pricing.construction_site,
      confidence: bestMatch.confidence,
      match_scores: {
        client: bestMatch.clientScore,
        site: bestMatch.siteScore,
        total: bestMatch.totalScore
      }
    };

    // Cache the result
    this.cache!.resolvedCombinations.set(cacheKey, resolvedData);

    // Validate other aspects
    this.validateMaterials(row, errors);
    this.validateDuplicateRemision(row, errors);

    allErrors.push(...errors);
    return this.applyResolvedData(row, resolvedData, errors, allErrors);
  }

  private findRecipeEnhanced(row: StagingRemision, errors: ValidationError[]): any | null {
    const primaryCode = row.product_description?.trim();   // arkik_long_code (PRIMARY)
    const fallbackCode = row.recipe_code?.trim();          // prod_tecnico (FALLBACK)
    
    let recipe = null;
    
    // 1. Exact match on arkik_long_code
    if (primaryCode) {
      recipe = this.cache!.recipeByArkikCode.get(this.normalizeString(primaryCode));
    }
    
    // 2. Exact match on recipe_code
    if (!recipe && fallbackCode) {
      recipe = this.cache!.recipeByShortCode.get(this.normalizeString(fallbackCode));
    }
    
    // 3. Fuzzy match from cache
    if (!recipe && primaryCode) {
      recipe = this.cache!.fuzzyRecipeCache.get(this.normalizeString(primaryCode));
    }
    if (!recipe && fallbackCode) {
      recipe = this.cache!.fuzzyRecipeCache.get(this.normalizeString(fallbackCode));
    }
    
    if (!recipe) {
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.RECIPE_NOT_FOUND,
        field_name: 'product_description',
        field_value: primaryCode || fallbackCode,
        message: `Receta no encontrada: "${primaryCode || fallbackCode}"`,
        recoverable: true
      });
    }
    
    return recipe;
  }

  private selectBestPricingEnhanced(pricingOptions: UnifiedPricingData[], row: StagingRemision): PricingMatch {
    const clientName = this.normalizeString(row.cliente_name || ''); // ONLY cliente_name, NOT cliente_codigo!
    const siteName = this.normalizeString(row.obra_name || '');
    
    // Single option - use directly
    if (pricingOptions.length === 1) {
      this.stats.pricingMatches.direct++;
      const pricing = pricingOptions[0];
      return {
        pricing,
        clientScore: 1,
        siteScore: 1,
        sourceScore: pricing.source === 'price' ? 1 : 0.8,
        recencyScore: 1,
        totalScore: 3.8,
        confidence: 'high'
      };
    }

    // Score each pricing option
    const scoredOptions: PricingMatch[] = pricingOptions.map(pricing => {
      const clientScore = this.calculateClientSimilarity(clientName, pricing.business_name);
      const siteScore = this.calculateSiteSimilarity(siteName, pricing.construction_site);
      const sourceScore = pricing.source === 'price' ? 1.0 : 0.8; // Prefer prices over quotes
      const recencyScore = this.calculateRecencyScore(pricing.date_ref);
      
      const totalScore = (
        clientScore * 0.4 +    // 40% client match weight
        siteScore * 0.3 +      // 30% site match weight  
        sourceScore * 0.2 +    // 20% source preference weight
        recencyScore * 0.1     // 10% recency weight
      );

      const confidence: 'high' | 'medium' | 'low' = 
        totalScore > 0.8 ? 'high' : 
        totalScore > 0.6 ? 'medium' : 'low';

      return {
        pricing,
        clientScore,
        siteScore,
        sourceScore,
        recencyScore,
        totalScore,
        confidence
      };
    });

    // Sort by total score
    scoredOptions.sort((a, b) => b.totalScore - a.totalScore);
    
    // Update stats based on filtering strategy
    const bestMatch = scoredOptions[0];
    const hasGoodClientMatch = scoredOptions.some(p => p.clientScore > 0.7);
    const hasGoodSiteMatch = scoredOptions.some(p => p.siteScore > 0.7);
    
    if (hasGoodClientMatch && hasGoodSiteMatch) {
      this.stats.pricingMatches.siteFiltered++;
    } else if (hasGoodClientMatch) {
      this.stats.pricingMatches.clientFiltered++;
    } else {
      this.stats.pricingMatches.fallback++;
    }

    return bestMatch;
  }

  private calculateClientSimilarity(inputName: string, businessName: string): number {
    if (!inputName || !businessName) return 0;
    
    const input = this.normalizeString(inputName);      // "sedena"
    const business = this.normalizeString(businessName); // "fideicomiso de administracion y pago sedena 80778"
    
    // Exact match
    if (input === business) return 1.0;
    
    // Substring match (very common for abbreviated names)
    if (business.includes(input) || input.includes(business)) {
      return 0.9;
    }
    
    // Word overlap analysis
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
    if (!inputSite || !pricingSite) return 0.1; // Small base score
    
    const input = this.normalizeString(inputSite).trim();
    const pricing = this.normalizeString(pricingSite).trim();
    
    // Exact match
    if (input === pricing) return 1.0;
    
    // Handle common whitespace issues
    if (input.replace(/\s+/g, '') === pricing.replace(/\s+/g, '')) return 0.95;
    
    // Substring match
    if (pricing.includes(input) || input.includes(pricing)) {
      return 0.9;
    }
    
    // Levenshtein similarity for typos
    const similarity = this.levenshteinSimilarity(input, pricing);
    return similarity > 0.8 ? similarity * 0.8 : 0.1; // Scale down but keep some base score
  }

  private calculateRecencyScore(dateRef: string): number {
    const date = new Date(dateRef);
    const now = new Date();
    const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    
    // More recent = higher score
    if (daysDiff < 30) return 1.0;      // Very recent
    if (daysDiff < 90) return 0.8;      // Recent
    if (daysDiff < 365) return 0.6;     // Somewhat recent
    return 0.4;                         // Older
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
        recoverable: false
      });
    }
  }

  private applyResolvedData(
    row: StagingRemision, 
    resolved: any, 
    errors: ValidationError[],
    allErrors: ValidationError[]
  ): StagingRemision {
    const hasNonRecoverableErrors = errors.some(e => !e.recoverable);
    const status = hasNonRecoverableErrors ? 'error' : (errors.length > 0 ? 'warning' : 'valid');
    
    allErrors.push(...errors);
    
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
  private normalizeString(str: string): string {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private isFuzzyRecipeMatch(input: string, recipe: any): boolean {
    const normalizedInput = this.normalizeString(input);
    const codes = [recipe.arkik_long_code, recipe.recipe_code, recipe.arkik_short_code]
      .filter(Boolean)
      .map(c => this.normalizeString(c));
    
    return codes.some(code => {
      // Exact match
      if (code === normalizedInput) return true;
      
      // Substring match
      if (code.includes(normalizedInput) || normalizedInput.includes(code)) return true;
      
      // Levenshtein distance for typos
      return this.levenshteinDistance(normalizedInput, code) <= 2;
    });
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
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i] + 1,     // deletion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    return matrix[b.length][a.length];
  }

  private levenshteinSimilarity(a: string, b: string): number {
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1.0;
    
    const distance = this.levenshteinDistance(a, b);
    return (maxLength - distance) / maxLength;
  }
}