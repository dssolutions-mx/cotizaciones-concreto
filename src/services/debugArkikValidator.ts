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
  business_name: string;
  client_code?: string;
}

interface DebugMatch {
  pricing: DebugPricing;
  clientScore: number;
  siteScore: number;
  totalScore: number;
  reasoning: string;
}

export class DebugArkikValidator {
  private plantId: string;
  private debugLogs: string[] = [];

  constructor(plantId: string) {
    this.plantId = plantId;
  }

  private log(message: string) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logMessage = `[${timestamp}] ${message}`;
    this.debugLogs.push(logMessage);
    console.log(`[DebugValidator] ${logMessage}`);
  }

  async validateBatch(rows: StagingRemision[]): Promise<{ 
    validated: StagingRemision[]; 
    errors: ValidationError[];
    debugLogs: string[];
  }> {
    this.log(`Starting validation for ${rows.length} rows...`);
    
    const validated: StagingRemision[] = [];
    const allErrors: ValidationError[] = [];

    // Process each row individually
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        const result = await this.validateSingleRow(row);
        validated.push(result.row);
        if (result.errors.length > 0) {
          allErrors.push(...result.errors);
        }
      } catch (error: any) {
        this.log(`Error processing row ${i + 1}: ${error.message}`);
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

    this.log(`Validation complete: ${rows.length} processed, ${validated.length} validated, ${allErrors.length} errors`);

    return { validated, errors: allErrors, debugLogs: this.debugLogs };
  }

  private async validateSingleRow(row: StagingRemision): Promise<{
    row: StagingRemision;
    errors: ValidationError[];
  }> {
    const errors: ValidationError[] = [];
    
    this.log(`Processing row ${row.row_number}: Client "${row.cliente_name}", Site "${row.obra_name}"`);

    // STEP 1: Find Recipe
    const recipe = await this.findRecipe(row, errors);
    if (!recipe) {
      this.log(`Recipe not found - marking as error`);
      return {
        row: { ...row, validation_status: 'error', validation_errors: errors },
        errors
      };
    }
    this.log(`Recipe found: ${recipe.arkik_long_code || recipe.recipe_code} (${recipe.id})`);

    // STEP 2: Validate Materials
    await this.validateMaterials(row, errors);

    // STEP 3: Load Unified Pricing
    const pricingOptions = await this.loadUnifiedPricing(recipe.id);
    if (pricingOptions.length === 0) {
      this.log(`No pricing found for recipe ${recipe.id}`);
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
    this.log(`Found ${pricingOptions.length} pricing options`);

    // STEP 4: Smart Client/Site Matching
    const bestMatch = this.selectBestPricing(pricingOptions, row);
    this.log(`Best match selected: ${bestMatch.pricing.source.toUpperCase()} - "${bestMatch.pricing.business_name}" / "${bestMatch.pricing.construction_site}" (score: ${bestMatch.totalScore.toFixed(2)})`);

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
      // Denormalized display fields for UI table (reusing existing optional fields)
      prod_tecnico: (row.prod_tecnico || row.recipe_code) as any, // Keep original Excel code
      product_description: (row.product_description || row.recipe_code) as any, // Keep original Excel code
      suggested_client_id: bestMatch.pricing.client_id,
      suggested_site_name: bestMatch.pricing.construction_site,
      construction_site_id: (resolvedConstructionSiteId || row.construction_site_id || undefined) as any,
      validation_status: errors.length > 0 ? 'warning' : 'valid',
      validation_errors: errors
    };

    this.log(`Row validated successfully`);
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
    
    this.log(`Looking for recipe with primary: "${primaryCode}" and fallback: "${fallbackCode}"`);

    if (!primaryCode && !fallbackCode) {
      this.log(`❌ No recipe codes provided`);
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
      this.log(`❌ Database error loading recipes: ${error.message}`);
      return null;
    }

    if (!recipes || recipes.length === 0) {
      this.log(`❌ No recipes found for plant ${this.plantId}`);
      return null;
    }

    this.log(`Loaded ${recipes.length} recipes for plant ${this.plantId}`);

    // Try exact matches first
    let recipe = null;

    // 1. Exact match on arkik_long_code
    if (primaryCode) {
      recipe = recipes.find(r => 
        r.arkik_long_code && 
        this.normalizeString(r.arkik_long_code) === this.normalizeString(primaryCode)
      );
      if (recipe) {
        this.log(`Exact match on arkik_long_code: ${recipe.arkik_long_code}`);
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
        this.log(`Exact match on recipe_code: ${recipe.recipe_code}`);
        return recipe;
      }
    }

    // 3. Fuzzy matching
    this.log(`No exact matches found, trying fuzzy matching...`);
    const candidates = recipes.filter(r => {
      const codes = [r.arkik_long_code, r.recipe_code, r.arkik_short_code].filter(Boolean);
      return codes.some(code => 
        this.isFuzzyMatch(primaryCode || fallbackCode || '', code)
      );
    });

    if (candidates.length === 1) {
      recipe = candidates[0];
      this.log(`Single fuzzy match found: ${recipe.arkik_long_code || recipe.recipe_code}`);
      return recipe;
    } else if (candidates.length > 1) {
      this.log(`Multiple fuzzy matches found: ${candidates.map(r => r.arkik_long_code || r.recipe_code).join(', ')}`);
      recipe = candidates[0]; // Take first match
      this.log(`Using first match: ${recipe.arkik_long_code || recipe.recipe_code}`);
      return recipe;
    }

    // No matches found
    this.log(`❌ No recipe matches found`);
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
    this.log(`Loading unified pricing for recipe ${recipeId}...`);
    
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

    if (pricesError) {
      this.log(`Error loading product_prices: ${pricesError.message}`);
    } else {
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
      this.log(`Loaded ${prices?.length || 0} product_prices`);
    }

    // Load quotes
    const { data: allQuotes, error: allQuotesError } = await supabase
      .from('quote_details')
      .select('recipe_id, final_price')
      .eq('recipe_id', recipeId);
    
    if (allQuotesError) {
      this.log(`Error checking all quotes: ${allQuotesError.message}`);
    }
    
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
        this.log(`Found ${matchingQuotes.length} quotes with recipe ${recipeId}`);
        quotes = matchingQuotes;
      } else {
        this.log(`No quotes found with recipe ${recipeId}`);
        quotes = [];
      }
    } else {
      this.log(`No quotes loaded from database`);
    }

    if (quotesError) {
      this.log(`Error loading quotes: ${quotesError.message}`);
    } else {
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
      this.log(`Loaded ${quotes?.length || 0} approved quotes`);
    }

    return unifiedPricing;
  }

  private selectBestPricing(pricingOptions: DebugPricing[], row: StagingRemision): DebugMatch {
    // CRITICAL: Use cliente_name, NOT cliente_codigo (as per strategy)
    const clientName = this.normalizeString(row.cliente_name || '');
    const siteName = this.normalizeString(row.obra_name || '');
    
    this.log(`Matching against client: "${clientName}" and site: "${siteName}"`);

    // Single option - use directly
    if (pricingOptions.length === 1) {
      const pricing = pricingOptions[0];
      return {
        pricing,
        clientScore: 1,
        siteScore: 1,
        totalScore: 2,
        reasoning: 'Single pricing option available'
      };
    }

    // Score each option
    const scoredOptions = pricingOptions.map(pricing => {
      const clientScore = this.calculateClientSimilarity(clientName, pricing.business_name);
      const siteScore = this.calculateSiteSimilarity(siteName, pricing.construction_site);
      const totalScore = clientScore + siteScore;
      
      this.log(`Scoring "${pricing.business_name}" / "${pricing.construction_site}": Client ${clientScore.toFixed(2)}, Site ${siteScore.toFixed(2)}, Total ${totalScore.toFixed(2)}`);

      return {
        pricing,
        clientScore,
        siteScore,
        totalScore,
        reasoning: `Client: ${clientScore.toFixed(2)}, Site: ${siteScore.toFixed(2)}`
      };
    });

    // Sort by score and return best
    scoredOptions.sort((a, b) => b.totalScore - a.totalScore);
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
      this.log(`Error loading materials: ${directError.message}`);
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
      this.log(`Unmapped material codes: ${unmappedCodes.join(', ')}`);
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
      this.log(`Inactive materials found: ${inactiveMaterials.map(m => m.material_code).join(', ')}`);
      errors.push({
        row_number: row.row_number,
        error_type: ArkikErrorType.MATERIAL_NOT_FOUND,
        field_name: 'materials',
        field_value: inactiveMaterials.map(m => m.material_code).join(', '),
        message: `Inactive materials referenced: ${inactiveMaterials.map(m => m.material_code).join(', ')}`,
        recoverable: true
      });
    }

    this.log(`Material validation completed: ${mappedCodes.size} mapped, ${unmappedCodes.length} unmapped`);
  }
}
