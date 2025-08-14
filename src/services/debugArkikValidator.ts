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
    this.log(`Starting validation for ${rows.length} rows in plant ${this.plantId}`);
    
    const validated: StagingRemision[] = [];
    const allErrors: ValidationError[] = [];

    // Process each row individually for clear debugging
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      this.log(`\n=== Processing Row ${i + 1}/${rows.length}: Remisión ${row.remision_number} ===`);
      
      try {
        const result = await this.validateSingleRow(row);
        validated.push(result.row);
        if (result.errors.length > 0) {
          allErrors.push(...result.errors);
        }
      } catch (error: any) {
        this.log(`ERROR processing row ${i + 1}: ${error.message}`);
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

    this.log(`\n=== VALIDATION COMPLETE ===`);
    this.log(`Total processed: ${rows.length}`);
    this.log(`Successfully validated: ${validated.length}`);
    this.log(`Total errors: ${allErrors.length}`);

    return { validated, errors: allErrors, debugLogs: this.debugLogs };
  }

  private async validateSingleRow(row: StagingRemision): Promise<{
    row: StagingRemision;
    errors: ValidationError[];
  }> {
    const errors: ValidationError[] = [];
    
    // Log input data
    this.log(`Input data:`);
    this.log(`  - Product Description: "${row.product_description}"`);
    this.log(`  - Recipe Code: "${row.recipe_code}"`);
    this.log(`  - Client Name: "${row.cliente_name}"`);
    this.log(`  - Client Code: "${row.cliente_codigo}" (IGNORED per strategy)`);
    this.log(`  - Site Name: "${row.obra_name}"`);

    // STEP 1: Find Recipe
    this.log(`\nSTEP 1: Finding recipe...`);
    const recipe = await this.findRecipe(row, errors);
    if (!recipe) {
      this.log(`❌ Recipe not found - marking as error`);
      return {
        row: { ...row, validation_status: 'error', validation_errors: errors },
        errors
      };
    }
    this.log(`✅ Recipe found: ID=${recipe.id}, Code=${recipe.recipe_code}, Arkik=${recipe.arkik_long_code}`);

    // STEP 2: Load Unified Pricing
    this.log(`\nSTEP 2: Loading unified pricing...`);
    const pricingOptions = await this.loadUnifiedPricing(recipe.id);
    if (pricingOptions.length === 0) {
      this.log(`❌ No pricing found for recipe ${recipe.id}`);
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
      this.log(`✅ Found ${pricingOptions.length} pricing options`);
    pricingOptions.forEach((p, idx) => {
      this.log(`  ${idx + 1}. ${p.source.toUpperCase()}: Client="${p.business_name}", Site="${p.construction_site}", Price=$${p.price}`);
    });

    // STEP 3: Smart Client/Site Matching
    this.log(`\nSTEP 3: Smart matching...`);
    const bestMatch = this.selectBestPricing(pricingOptions, row);
    this.log(`✅ Best match selected:`);
    this.log(`  - Source: ${bestMatch.pricing.source.toUpperCase()}`);
    this.log(`  - Client: "${bestMatch.pricing.business_name}" (score: ${bestMatch.clientScore.toFixed(2)})`);
    this.log(`  - Site: "${bestMatch.pricing.construction_site}" (score: ${bestMatch.siteScore.toFixed(2)})`);
    this.log(`  - Total Score: ${bestMatch.totalScore.toFixed(2)}`);
    this.log(`  - Reasoning: ${bestMatch.reasoning}`);
    const resolvedSiteId = await this.resolveConstructionSiteId(bestMatch.pricing.client_id, bestMatch.pricing.construction_site);
    this.log(`  - Resolved construction_site_id: ${resolvedSiteId || 'null'}`);

    // STEP 4: Apply Results (resolve construction_site_id when possible)
    const resolvedConstructionSiteId = await this.resolveConstructionSiteId(
      bestMatch.pricing.client_id,
      bestMatch.pricing.construction_site
    );

    const validatedRow: StagingRemision = {
      ...row,
      recipe_id: recipe.id,
      client_id: bestMatch.pricing.client_id,
      unit_price: bestMatch.pricing.price,
      price_source: bestMatch.pricing.source,
      suggested_client_id: bestMatch.pricing.client_id,
      suggested_site_name: bestMatch.pricing.construction_site,
      construction_site_id: resolvedConstructionSiteId || row.construction_site_id || null,
      validation_status: errors.length > 0 ? 'warning' : 'valid',
      validation_errors: errors
    };

    this.log(`✅ Row validated successfully`);
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
    
    this.log(`Looking for recipe with:`);
    this.log(`  - Primary (product_description): "${primaryCode}"`);
    this.log(`  - Fallback (recipe_code): "${fallbackCode}"`);

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
        this.log(`✅ Exact match on arkik_long_code: ${recipe.arkik_long_code}`);
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
        this.log(`✅ Exact match on recipe_code: ${recipe.recipe_code}`);
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
      this.log(`✅ Single fuzzy match found: ${recipe.arkik_long_code || recipe.recipe_code}`);
      return recipe;
    } else if (candidates.length > 1) {
      this.log(`⚠️ Multiple fuzzy matches found: ${candidates.map(r => r.arkik_long_code || r.recipe_code).join(', ')}`);
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
    this.log(`Loading product_prices...`);
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
      this.log(`❌ Error loading product_prices: ${pricesError.message}`);
    } else {
      (prices || []).forEach(price => {
        if (price.clients) {
          const hasSite = Boolean(price.construction_site && String(price.construction_site).trim());
          const scope: string = hasSite ? 'client_site' : 'client';
          unifiedPricing.push({
            recipe_id: (price as any).recipeid,
            client_id: price.client_id,
            construction_site: price.construction_site || '',
            price: Number(price.base_price),
            source: scope as any,
            business_name: price.clients.business_name,
            client_code: price.clients.client_code
          });
        }
      });
      this.log(`✅ Loaded ${prices?.length || 0} product_prices`);
    }

    // Load quotes (CRITICAL ADDITION)
    this.log(`Loading approved quotes...`);
    const { data: quotes, error: quotesError } = await supabase
      .from('quote_details')
      .select(`
        recipe_id, final_price,
        quotes:quote_id(client_id, construction_site,
          clients:client_id(business_name, client_code))
      `)
      .eq('quotes.plant_id', this.plantId)
      .eq('quotes.status', 'APPROVED')
      .eq('recipe_id', recipeId);

    if (quotesError) {
      this.log(`❌ Error loading quotes: ${quotesError.message}`);
    } else {
      (quotes || []).forEach(quote => {
        const quoteData = quote.quotes as any;
        if (quoteData?.clients) {
          unifiedPricing.push({
            recipe_id: quote.recipe_id,
            client_id: quoteData.client_id,
            construction_site: quoteData.construction_site || '',
            price: Number(quote.final_price),
            source: 'quote',
            business_name: quoteData.clients.business_name,
            client_code: quoteData.clients.client_code
          });
        }
      });
      this.log(`✅ Loaded ${quotes?.length || 0} approved quotes`);
    }

    this.log(`Total unified pricing options: ${unifiedPricing.length}`);
    return unifiedPricing;
  }

  private selectBestPricing(pricingOptions: DebugPricing[], row: StagingRemision): DebugMatch {
    // CRITICAL: Use cliente_name, NOT cliente_codigo (as per strategy)
    const clientName = this.normalizeString(row.cliente_name || '');
    const siteName = this.normalizeString(row.obra_name || '');
    
    this.log(`Matching against input:`);
    this.log(`  - Client Name: "${clientName}"`);
    this.log(`  - Site Name: "${siteName}"`);

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
      
      this.log(`Scoring option: "${pricing.business_name}" / "${pricing.construction_site}"`);
      this.log(`  - Client similarity: ${clientScore.toFixed(2)}`);
      this.log(`  - Site similarity: ${siteScore.toFixed(2)}`);
      this.log(`  - Total score: ${totalScore.toFixed(2)}`);

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
}
