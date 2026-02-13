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

type BatchMaps = {
  clientByCode: Map<string, any>;
  clientByName: Map<string, any>;
  sitesByClientId: Map<string, Map<string, any>>; // client_id -> (lower(name) -> site)
  recipeByCode: Map<string, any>;
  recipeByArkikCode: Map<string, any>; // arkik_long_code -> recipe
  pricesByRecipeId: Map<string, any[]>; // recipe_id -> price rows
  quoteSitesByClientAndRecipe: Map<string, Set<string>>; // `${clientId}::${recipe_code}` -> site name set
  mappedMaterialCodes: Set<string>;
  duplicateRemisiones: Set<string>;
};

export class ArkikValidator {
  constructor(private plantId: string) {}

  async validateBatch(rows: StagingRemision[]): Promise<{ validated: StagingRemision[]; errors: ValidationError[] }>{
    const maps = await this.buildMaps(rows);
    console.log('[Arkik][Validator] buildMaps summary', {
      clientsByCode: maps.clientByCode.size,
      clientsByName: maps.clientByName.size,
      sitesByClient: maps.sitesByClientId.size,
      recipesByCode: maps.recipeByCode.size,
      recipesByArkikCode: maps.recipeByArkikCode.size,
      pricesForRecipes: Array.from(maps.pricesByRecipeId.keys()).length,
      materialCodesMapped: maps.mappedMaterialCodes.size,
      duplicateRemisiones: maps.duplicateRemisiones.size,
    });
    const allErrors: ValidationError[] = [];
    const validated = rows.map(r => this.validateRow(r, maps, allErrors));
    return { validated, errors: allErrors };
  }

  private validateRow(r: StagingRemision, maps: BatchMaps, allErrors: ValidationError[]): StagingRemision {
    const errors: ValidationError[] = [];

    // Client
    let client = r.client_id ? { id: r.client_id } : maps.clientByCode.get((r.cliente_codigo || '').toLowerCase()) || maps.clientByName.get((r.cliente_name || '').toLowerCase());
    if (!client) {
      errors.push({
        row_number: r.row_number,
        error_type: ArkikErrorType.CLIENT_NOT_FOUND,
        field_name: 'cliente',
        field_value: r.cliente_name,
        message: 'Cliente no encontrado',
        suggestion: null,
        recoverable: true,
      });
    }

    // Construction site
    let site: any | null = null;
    if (client) {
      const byName = maps.sitesByClientId.get(client.id);
      const obraKey = String(r.obra_name || '').trim().toLowerCase();
      if (byName) site = byName.get(obraKey) || null;
    }
    if (client && !site) {
      errors.push({
        row_number: r.row_number,
        error_type: ArkikErrorType.CONSTRUCTION_SITE_NOT_FOUND,
        field_name: 'obra_name',
        field_value: r.obra_name,
        message: 'Obra no encontrada para el cliente',
        suggestion: null,
        recoverable: true,
      });
    }

    // Recipe matching with standardized logic
    const primaryCode = r.product_description?.trim(); // arkik_long_code (PRIMARY)
    const fallbackCode = r.recipe_code?.trim();        // prod_tecnico (FALLBACK)
    
    let recipe = null;
    const searchCode = primaryCode || fallbackCode || '';
    
    if (searchCode) {
      // Validate format
      if (!validateRecipeCodeFormat(searchCode)) {
        console.warn(`[ArkikValidator] Invalid recipe code format: "${searchCode}"`);
      }
      
      // Try exact match with standardized normalization
      const normalizedSearch = normalizeRecipeCode(searchCode);
      
      // Check arkik_long_code map first
      recipe = maps.recipeByArkikCode.get(normalizedSearch);
      
      // Then check recipe_code map
      if (!recipe) {
        recipe = maps.recipeByCode.get(normalizedSearch);
      }
    }
    if (!recipe) {
      // Get suggestions for manual review
      const allRecipes = Array.from(maps.recipeByArkikCode.values());
      const suggestions = getRecipeCodeSuggestions(searchCode, allRecipes, 3);
      
      let suggestionText = '';
      if (suggestions.length > 0) {
        suggestionText = ` Possible matches: [${suggestions.join(', ')}]`;
      }
      
      console.log(`[ArkikValidator] ❌ No exact match found for: "${searchCode}"${suggestionText}`);
      
      errors.push({
        row_number: r.row_number,
        error_type: ArkikErrorType.RECIPE_NOT_FOUND,
        field_name: 'product_description',
        field_value: searchCode,
        message: `Receta no encontrada en la planta para "${searchCode}"${suggestionText}`,
        suggestion: suggestions.length > 0 ? suggestions[0] : null,
        recoverable: true,
      });
    } else {
      // Price backward check: if price exists, associate client/site from price if missing
      const prices = maps.pricesByRecipeId.get(recipe.id) || [];
      if (prices.length === 0) {
        errors.push({
          row_number: r.row_number,
          error_type: ArkikErrorType.RECIPE_NO_PRICE,
          field_name: 'recipe_id',
          field_value: recipe.id,
          message: `La receta "${recipe.recipe_code || recipe.arkik_long_code}" no tiene precio configurado en esta planta. Necesita crear un precio en el catálogo.`,
          suggestion: { 
            action: 'create_price', 
            recipe_id: recipe.id, 
            recipe_code: recipe.recipe_code,
            arkik_long_code: recipe.arkik_long_code 
          },
          recoverable: true,
        });
      } else {
        // Prefer newest by effective_date/updated_at
        const sorted = [...prices].sort((a: any, b: any) => new Date(b.effective_date || b.updated_at || 0).getTime() - new Date(a.effective_date || a.updated_at || 0).getTime());
        const clientSitePrice = sorted.find(p => p.client_id && p.construction_site);
        const clientOnlyPrice = sorted.find(p => p.client_id && !p.construction_site);
        const anyPlantPrice = sorted[0];
        let unitPrice: number | null = null;
        let priceSource: 'client_site' | 'client' | 'plant' | 'none' = 'none';
        if (clientSitePrice) { unitPrice = Number(clientSitePrice.base_price ?? null); priceSource = 'client_site'; }
        else if (clientOnlyPrice) { unitPrice = Number(clientOnlyPrice.base_price ?? null); priceSource = 'client'; }
        else if (anyPlantPrice) { unitPrice = Number(anyPlantPrice.base_price ?? null); priceSource = 'plant'; }
        r.unit_price = unitPrice;
        r.price_source = priceSource;

        // Auto-assign client and site from prices if we found them and they're missing
        if (!client && (clientSitePrice || clientOnlyPrice)) {
          const priceWithClient = clientSitePrice || clientOnlyPrice;
          if (priceWithClient?.client_id) {
            // Find the actual client object from our maps
            for (const [, clientObj] of Array.from(maps.clientByCode.entries())) {
              if (clientObj.id === priceWithClient.client_id) {
                client = clientObj;
                console.log(`[Arkik][Validator] Auto-assigned client from price for row ${r.row_number}:`, client.business_name);
                break;
              }
            }
            if (!client) {
              for (const [, clientObj] of Array.from(maps.clientByName.entries())) {
                if (clientObj.id === priceWithClient.client_id) {
                  client = clientObj;
                  console.log(`[Arkik][Validator] Auto-assigned client from price for row ${r.row_number}:`, client.business_name);
                  break;
                }
              }
            }
          }
        }

        // Deterministic site inference: from price, quote narrowing, or unique site
        if (!site && client) {
          const siteMap = maps.sitesByClientId.get(client.id);
          const siteNameFromPrice = String(clientSitePrice?.construction_site || '').trim();
          if (siteMap && siteNameFromPrice) {
            site = siteMap.get(siteNameFromPrice.toLowerCase()) || null;
          }
          if (!site && siteMap) {
            const key = `${client.id}::${recipe.recipe_code}`;
            const quoteSites = maps.quoteSitesByClientAndRecipe.get(key);
            if (quoteSites && quoteSites.size === 1) {
              const only = Array.from(quoteSites.values())[0];
              site = siteMap.get(String(only).toLowerCase()) || null;
            }
          }
          if (!site && siteMap && siteMap.size === 1) {
            site = Array.from(siteMap.values())[0];
          }
        }

        // Fallback: Try infer client/site from prices if still missing and unique
        if (!client || !site) {
          const priceWithClient = prices.filter(p => p.client_id);
          const uniqueClientId = Array.from(new Set(priceWithClient.map(p => p.client_id))).filter(Boolean);
          if (!client && uniqueClientId.length === 1) {
            client = { id: uniqueClientId[0] };
          }
          if (!site && client) {
            const candidateSites = priceWithClient
              .filter(p => p.client_id === client.id && p.construction_site)
              .map(p => p.construction_site as string);
            const uniqueSite = Array.from(new Set(candidateSites));
            if (uniqueSite.length === 1) {
              const byName = maps.sitesByClientId.get(client.id);
              if (byName) site = byName.get(uniqueSite[0].toLowerCase()) || null;
            }
          }
        }

        // Set suggestions for UI (fallback for manual selection)
        if (clientSitePrice) {
          r.suggested_client_id = clientSitePrice.client_id || null;
          r.suggested_site_name = clientSitePrice.construction_site || null;
        } else if (clientOnlyPrice) {
          r.suggested_client_id = clientOnlyPrice.client_id || null;
        }

        // If site is inferred, assign to row
        if (site) {
          r.construction_site_id = site.id;
          r.obra_name = site.name; // keep UI consistent even if already filled with trailing spaces
        }
      }
    }

    // Materials
    const codes = new Set<string>([
      ...Object.keys(r.materials_teorico || {}),
      ...Object.keys(r.materials_real || {}),
    ]);
    for (const code of Array.from(codes)) {
      if (!maps.mappedMaterialCodes.has(code)) {
        errors.push({
          row_number: r.row_number,
          error_type: ArkikErrorType.MATERIAL_NOT_FOUND,
          field_name: 'material_code',
          field_value: code,
          message: `Material no mapeado para la planta: ${code}`,
          suggestion: { action: 'add_mapping', arkik_code: code },
          recoverable: true,
        });
      }
    }

    // Duplicate remision
    if (maps.duplicateRemisiones.has(r.remision_number)) {
      errors.push({
        row_number: r.row_number,
        error_type: ArkikErrorType.DUPLICATE_REMISION,
        field_name: 'remision_number',
        field_value: r.remision_number,
        message: 'Remisión duplicada en el sistema',
        suggestion: { action: 'skip_or_update' },
        recoverable: false,
      });
    }

    const finalErrors = [...r.validation_errors, ...errors];
    const status: StagingRemision['validation_status'] = finalErrors.some(e => !e.recoverable) ? 'error' : (finalErrors.length ? 'warning' : 'valid');

    return {
      ...r,
      client_id: client?.id || r.client_id,
      construction_site_id: site?.id || r.construction_site_id,
      recipe_id: recipe?.id || r.recipe_id,
      validation_errors: finalErrors,
      validation_status: status,
    };
  }

  private async buildMaps(rows: StagingRemision[]): Promise<BatchMaps> {
    const lower = (s: string | null | undefined) => (s || '').toLowerCase();
    const clientCodes = Array.from(new Set(rows.map(r => lower(r.cliente_codigo)).filter(Boolean)));
    const clientNames = Array.from(new Set(rows.map(r => lower(r.cliente_name)).filter(Boolean)));
    const obraNames = Array.from(new Set(rows.map(r => lower(r.obra_name)).filter(Boolean)));
    const recipeCodesLower = Array.from(new Set(rows.map(r => lower(r.product_description)).filter(Boolean)));
    const remisionNumbers = Array.from(new Set(rows.map(r => r.remision_number)));
    const materialCodes = Array.from(new Set(rows.flatMap(r => [
      ...Object.keys(r.materials_teorico || {}),
      ...Object.keys(r.materials_real || {}),
    ])));

    // Clients by code and name
    const clientByCode = new Map<string, any>();
    const clientByName = new Map<string, any>();
    if (clientCodes.length || clientNames.length) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, business_name, client_code');
      (clients || []).forEach(c => {
        if (c.client_code) clientByCode.set(String(c.client_code).toLowerCase(), c);
        if (c.business_name) clientByName.set(String(c.business_name).toLowerCase(), c);
      });
    }

    // Construction sites by client id and name
    const sitesByClientId = new Map<string, Map<string, any>>();
    const clientIds = Array.from(new Set(Array.from(clientByCode.values()).concat(Array.from(clientByName.values())).map((c: any) => c.id)));
    if (clientIds.length) {
      const { data: sites } = await supabase
        .from('construction_sites')
        .select('id, name, client_id')
        .in('client_id', clientIds);
      (sites || []).forEach(s => {
        const map = sitesByClientId.get(s.client_id) || new Map<string, any>();
        map.set(String(s.name).trim().toLowerCase(), s);
        sitesByClientId.set(s.client_id, map);
      });
    }

    // Recipes by code and arkik_long_code in plant
    const recipeByCode = new Map<string, any>();
    const recipeByArkikCode = new Map<string, any>();
    {
      // Fetch all recipes for this plant and index case-insensitively by both recipe_code and arkik_long_code
      const { data: recipes } = await supabase
        .from('recipes')
        .select('id, recipe_code, arkik_long_code, plant_id')
        .eq('plant_id', this.plantId);
      (recipes || []).forEach(r => {
        if (r.recipe_code) {
          recipeByCode.set(normalizeRecipeCode(r.recipe_code), r);
        }
        if (r.arkik_long_code) {
          recipeByArkikCode.set(normalizeRecipeCode(r.arkik_long_code), r);
        }
      });
      console.log(`[Arkik][Validator] Loaded ${recipes?.length || 0} recipes for plant ${this.plantId}: ${recipeByCode.size} by recipe_code, ${recipeByArkikCode.size} by arkik_long_code`);
    }

    // SIMPLIFIED Prices loading - handles data integrity issues efficiently
    const pricesByRecipeId = new Map<string, any[]>();
    const allRecipes = [...Array.from(recipeByCode.values()), ...Array.from(recipeByArkikCode.values())];
    const recipeCodes = Array.from(new Set(allRecipes.map((r: any) => r.recipe_code).filter(Boolean)));
    // Quotes-derived site hints per client and recipe
    const quoteSitesByClientAndRecipe = new Map<string, Set<string>>();
    
    if (recipeCodes.length) {
      console.log(`[Arkik][Validator] Loading prices for ${recipeCodes.length} recipe codes`);
      // Step 1: Fetch ALL recipes (any plant) that match our recipe codes
      const { data: recipeRowsAllPlants } = await supabase
        .from('recipes')
        .select('id, recipe_code, arkik_long_code, plant_id')
        .in('recipe_code', recipeCodes);

      const allRecipeIdByCode = new Map<string, string[]>();
      (recipeRowsAllPlants || []).forEach((r: any) => {
        const arr = allRecipeIdByCode.get(r.recipe_code) || [];
        arr.push(r.id);
        allRecipeIdByCode.set(r.recipe_code, arr);
      });

      const allRecipeIds = Array.from(new Set((recipeRowsAllPlants || []).map((r: any) => r.id)));

      // Step 2: Fetch prices by those recipe_ids (fast, no join quirks)
      let allPrices: any[] = [];
      if (allRecipeIds.length) {
        const { data: priceRows } = await supabase
          .from('product_prices')
          .select('id, recipe_id, code, client_id, construction_site, plant_id, is_active, base_price, effective_date, updated_at')
          .eq('is_active', true)
          .in('recipe_id', allRecipeIds);
        allPrices = priceRows || [];
      }

      // Map prices to OUR plant's recipe IDs by recipe_code
      (allPrices || []).forEach(p => {
        // Find the recipe_code for this recipe_id
        const match = (recipeRowsAllPlants || []).find((r: any) => r.id === p.recipe_id);
        if (!match) return;
        const priceRecipeCode = match.recipe_code;
        if (!priceRecipeCode) return;

        const ourRecipe = allRecipes.find((r: any) => r.recipe_code === priceRecipeCode);
        if (ourRecipe) {
          const list = pricesByRecipeId.get(ourRecipe.id) || [];
          list.push({
            ...p,
            plant_mismatch: p.plant_id !== this.plantId,
            mapped_to_recipe_id: ourRecipe.id
          });
          pricesByRecipeId.set(ourRecipe.id, list);
        }
      });

      console.log(`[Arkik][Validator] Loaded prices for ${pricesByRecipeId.size}/${allRecipes.length} recipes`);
      const successfulRecipes = Array.from(pricesByRecipeId.keys()).slice(0, 5);
      if (successfulRecipes.length) {
        const sampleRecipe = allRecipes.find((r: any) => r.id === successfulRecipes[0]);
        console.log(`[Arkik][Validator] Sample successful recipe mapping: ${sampleRecipe?.recipe_code} -> ${pricesByRecipeId.get(successfulRecipes[0])?.length} prices`);
      }
    }

    // STEP: Aggressive quote-based narrowing (plant+recipe_code -> client/site)
    try {
      if (recipeCodes.length) {
        const { data: quoteRows } = await supabase
          .from('quotes')
          .select('id, client_id, construction_site, status, plant_id, quote_details(recipe_id, recipes:recipe_id(recipe_code))')
          .eq('plant_id', this.plantId)
          .eq('status', 'APPROVED')
          .eq('is_active', true);
        (quoteRows || []).forEach((q: any) => {
          const site = String(q.construction_site || '').trim();
          (q.quote_details || []).forEach((d: any) => {
            const rc = d.recipes?.recipe_code;
            if (!rc) return;
            const key = `${q.client_id}::${rc}`;
            const set = quoteSitesByClientAndRecipe.get(key) || new Set<string>();
            if (site) set.add(site);
            quoteSitesByClientAndRecipe.set(key, set);
          });
        });
      }
    } catch {
      // ignore quote fetch errors, not critical
    }

    // Material mapping per plant
    const mappedMaterialCodes = new Set<string>();
    if (materialCodes.length) {
      const { data: mappings } = await supabase
        .from('arkik_material_mapping')
        .select('arkik_code, material_id')
        .eq('plant_id', this.plantId)
        .in('arkik_code', materialCodes);
      (mappings || []).forEach(m => mappedMaterialCodes.add(String(m.arkik_code)));
    }

    // Duplicate remisiones in this plant
    const duplicateRemisiones = new Set<string>();
    if (remisionNumbers.length) {
      const { data: rems } = await supabase
        .from('remisiones')
        .select('remision_number')
        .eq('plant_id', this.plantId)
        .in('remision_number', remisionNumbers);
      (rems || []).forEach(r => duplicateRemisiones.add(String(r.remision_number)));
    }

    return { clientByCode, clientByName, sitesByClientId, recipeByCode, recipeByArkikCode, pricesByRecipeId, quoteSitesByClientAndRecipe, mappedMaterialCodes, duplicateRemisiones };
  }
}


