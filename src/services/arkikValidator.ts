/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase/client';
import { ArkikErrorType, StagingRemision, ValidationError } from '@/types/arkik';

type BatchMaps = {
  clientByCode: Map<string, any>;
  clientByName: Map<string, any>;
  sitesByClientId: Map<string, Map<string, any>>; // client_id -> (lower(name) -> site)
  recipeByCode: Map<string, any>;
  pricesByRecipeId: Map<string, any[]>; // recipe_id -> price rows
  mappedMaterialCodes: Set<string>;
  duplicateRemisiones: Set<string>;
};

export class ArkikValidator {
  constructor(private plantId: string) {}

  async validateBatch(rows: StagingRemision[]): Promise<{ validated: StagingRemision[]; errors: ValidationError[] }>{
    const maps = await this.buildMaps(rows);
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
      if (byName) site = byName.get((r.obra_name || '').toLowerCase()) || null;
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

    // Recipe
    const recipe = maps.recipeByCode.get((r.recipe_code || r.prod_tecnico || '').toLowerCase());
    if (!recipe) {
      errors.push({
        row_number: r.row_number,
        error_type: ArkikErrorType.RECIPE_NOT_FOUND,
        field_name: 'recipe_code',
        field_value: r.recipe_code || r.prod_tecnico,
        message: 'Receta no encontrada en la planta',
        suggestion: null,
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
          message: 'La receta no tiene precio en esta planta',
          suggestion: null,
          recoverable: true,
        });
      } else if (!client || !site) {
        // Try infer client/site from prices if unique
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
    }

    // Materials
    const codes = new Set<string>([
      ...Object.keys(r.materials_teorico || {}),
      ...Object.keys(r.materials_real || {}),
    ]);
    for (const code of codes) {
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
    const recipeCodes = Array.from(new Set(rows.map(r => lower(r.recipe_code || r.prod_tecnico)).filter(Boolean)));
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
        map.set(String(s.name).toLowerCase(), s);
        sitesByClientId.set(s.client_id, map);
      });
    }

    // Recipes by code in plant
    const recipeByCode = new Map<string, any>();
    if (recipeCodes.length) {
      const { data: recipes } = await supabase
        .from('recipes')
        .select('id, recipe_code, plant_id')
        .eq('plant_id', this.plantId)
        .in('recipe_code', recipeCodes);
      (recipes || []).forEach(r => recipeByCode.set(String(r.recipe_code).toLowerCase(), r));
    }

    // Prices by recipe in plant
    const pricesByRecipeId = new Map<string, any[]>();
    const recipeIds = Array.from(new Set(Array.from(recipeByCode.values()).map((r: any) => r.id)));
    if (recipeIds.length) {
      const { data: prices } = await supabase
        .from('product_prices')
        .select('id, recipe_id, client_id, construction_site, plant_id, is_active')
        .eq('plant_id', this.plantId)
        .in('recipe_id', recipeIds)
        .eq('is_active', true);
      (prices || []).forEach(p => {
        const list = pricesByRecipeId.get(p.recipe_id) || [];
        list.push(p);
        pricesByRecipeId.set(p.recipe_id, list);
      });
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

    return { clientByCode, clientByName, sitesByClientId, recipeByCode, pricesByRecipeId, mappedMaterialCodes, duplicateRemisiones };
  }
}


