import { supabase } from './client';
import { handleError } from '@/utils/errorHandler';
import { addMonths, startOfMonthDate } from '@/lib/materialPricePeriod';

export const priceService = {
  // Precios de materiales
  async saveMaterialPrice(priceData: {
    // New standard
    material_id?: string;
    // Legacy compatibility (falls back if no material_id)
    materialType?: string;
    pricePerUnit: number;
    effectiveDate: string;
    plant_id?: string;
    created_by?: string;
  }) {
    const periodStart = startOfMonthDate(new Date(priceData.effectiveDate + 'T12:00:00'));

    // UUID + plant: monthly upsert (historical pricing)
    if (priceData.material_id && priceData.plant_id) {
      return priceService.saveMaterialPriceForPeriod({
        material_id: priceData.material_id,
        plant_id: priceData.plant_id,
        period_start: periodStart,
        price_per_unit: priceData.pricePerUnit,
        material_type: priceData.materialType || 'MATERIAL',
        effective_date: priceData.effectiveDate,
        created_by: priceData.created_by,
      });
    }

    // Legacy: material_type only — close open rows and insert
    const updateConditions: Record<string, unknown> = { end_date: null };
    if (priceData.materialType) {
      updateConditions.material_type = priceData.materialType;
    }
    if (priceData.plant_id) {
      updateConditions.plant_id = priceData.plant_id;
    }

    await supabase
      .from('material_prices')
      .update({ end_date: new Date().toISOString() })
      .match(updateConditions);

    const insertData: Record<string, unknown> = {
      price_per_unit: priceData.pricePerUnit,
      effective_date: priceData.effectiveDate,
      period_start: periodStart,
      material_type: priceData.materialType || 'MATERIAL',
    };
    if (priceData.plant_id) insertData.plant_id = priceData.plant_id;
    if (priceData.created_by) insertData.created_by = priceData.created_by;

    return await supabase.from('material_prices').insert(insertData).select();
  },

  /** Upsert one material price for a calendar month (plant + material). */
  async saveMaterialPriceForPeriod(data: {
    material_id: string;
    plant_id: string;
    period_start: string;
    price_per_unit: number;
    material_type: string;
    effective_date: string;
    created_by?: string;
    updated_by?: string;
  }) {
    const row: Record<string, unknown> = {
      material_id: data.material_id,
      plant_id: data.plant_id,
      period_start: data.period_start,
      price_per_unit: data.price_per_unit,
      material_type: data.material_type,
      effective_date: data.effective_date,
    };
    if (data.created_by) row.created_by = data.created_by;
    if (data.updated_by) row.updated_by = data.updated_by;

    return await supabase
      .from('material_prices')
      .upsert(row, { onConflict: 'material_id,plant_id,period_start' })
      .select();
  },

  async getMaterialPricesForPeriod(plantId: string, periodStart: string) {
    return await supabase
      .from('material_prices')
      .select('*')
      .eq('plant_id', plantId)
      .eq('period_start', periodStart)
      .order('material_id');
  },

  async getMaterialPriceHistory(materialId: string, plantId: string) {
    return await supabase
      .from('material_prices')
      .select('*')
      .eq('material_id', materialId)
      .eq('plant_id', plantId)
      .order('period_start', { ascending: true });
  },

  /** All dated prices for a plant (for admin grids / sparklines). */
  async getMaterialPricesForPlantAllPeriods(plantId: string) {
    return await supabase
      .from('material_prices')
      .select('*')
      .eq('plant_id', plantId)
      .not('material_id', 'is', null)
      .order('period_start', { ascending: true });
  },

  /** Copy all prices for a plant from one month to another (upsert target month). */
  async copyPricesForward(params: {
    plant_id: string;
    from_period_start: string;
    to_period_start: string;
    created_by?: string;
  }) {
    const { data: rows, error: fetchError } = await supabase
      .from('material_prices')
      .select('material_id, plant_id, price_per_unit, material_type')
      .eq('plant_id', params.plant_id)
      .eq('period_start', params.from_period_start)
      .not('material_id', 'is', null);

    if (fetchError) return { data: null, error: fetchError };

    const upserts = (rows || [])
      .filter((r) => r.material_id)
      .map((r) => ({
        material_id: r.material_id as string,
        plant_id: params.plant_id,
        period_start: params.to_period_start,
        price_per_unit: r.price_per_unit,
        material_type: r.material_type || 'MATERIAL',
        effective_date: params.to_period_start,
        ...(params.created_by ? { created_by: params.created_by } : {}),
      }));

    if (upserts.length === 0) {
      return { data: [] as unknown[], error: null };
    }

    return await supabase
      .from('material_prices')
      .upsert(upserts, { onConflict: 'material_id,plant_id,period_start' })
      .select();
  },

  /** Next month string yyyy-MM-01 after period_start. */
  nextPeriodStart(periodStart: string) {
    return addMonths(periodStart, 1);
  },

  /** Refresh vw_plant_financial_analysis (requires DB function; may take a while). */
  async refreshPlantFinancialAnalysisMv() {
    return await supabase.rpc('refresh_plant_financial_analysis_mv');
  },

  /** Refresh vw_plant_financial_analysis_fifo (FIFO / lot-based material costs). */
  async refreshPlantFinancialAnalysisMvFifo() {
    return await supabase.rpc('refresh_plant_financial_analysis_mv_fifo');
  },

  // Gastos administrativos
  async saveAdminCost(costData: {
    costType: string;
    description: string;
    amount: number;
    effectiveDate: string;
  }) {
    await supabase
      .from('administrative_costs')
      .update({ end_date: new Date().toISOString() })
      .match({ 
        cost_type: costData.costType,
        end_date: null 
      });

    return await supabase
      .from('administrative_costs')
      .insert({
        cost_type: costData.costType,
        description: costData.description,
        amount: costData.amount,
        effective_date: costData.effectiveDate
      });
  },

  async deleteAdminCost(costId: string) {
    // Soft delete by setting end_date
    return await supabase
      .from('administrative_costs')
      .update({ end_date: new Date().toISOString() })
      .eq('id', costId)
      .is('end_date', null); // Only update if not already deleted
  },

  // Precios de productos
  async saveProductPrice(productData: {
    code: string;
    description: string;
    fcMrValue: number;
    type: string;
    ageDays: number;
    placementType: string;
    maxAggregateSize: number;
    slump: number;
    basePrice: number;
    recipeId: string;
    constructionSite?: string;
    clientId?: string;
    effectiveDate: string;
  }) {
    return await supabase
      .from('product_prices')
      .insert({
        code: productData.code,
        description: productData.description,
        fc_mr_value: productData.fcMrValue,
        type: productData.type,
        age_days: productData.ageDays,
        placement_type: productData.placementType,
        max_aggregate_size: productData.maxAggregateSize,
        slump: productData.slump,
        base_price: productData.basePrice,
        recipe_id: productData.recipeId,
        construction_site: productData.constructionSite || null,
        client_id: productData.clientId || null,
        effective_date: productData.effectiveDate
      });
  },

  // Servicios adicionales
  async saveAdditionalService(serviceData: {
    code: string;
    description: string;
    price: number;
  }) {
    return await supabase
      .from('additional_services')
      .insert({
        code: serviceData.code,
        description: serviceData.description,
        price: serviceData.price
      });
  },

  // Consultas
  async getCurrentMaterialPrices() {
    return await supabase
      .from('material_prices')
      .select('*')
      .is('end_date', null)
      .order('material_type');
  },

  /**
   * Get material prices for a plant, UUID-only (material_id IS NOT NULL).
   * Returns Map<material_id, price_per_unit> with latest price per material (max effective_date).
   * Use this for QuoteBuilder base price calculation — no ambiguity.
   */
  async getMaterialPricesForPlant(plantId: string): Promise<{
    data: Map<string, number>;
    error: Error | null;
  }> {
    const todayMonth = startOfMonthDate(new Date());
    const { data: rows, error } = await supabase
      .from('material_prices')
      .select('material_id, price_per_unit, effective_date, period_start, plant_id')
      .eq('plant_id', plantId)
      .not('material_id', 'is', null)
      .lte('period_start', todayMonth)
      .order('period_start', { ascending: false });

    if (error) {
      return { data: new Map(), error };
    }

    const priceMap = new Map<string, number>();
    for (const row of rows || []) {
      if (row.material_id && !priceMap.has(row.material_id)) {
        priceMap.set(row.material_id, Number(row.price_per_unit) || 0);
      }
    }
    return { data: priceMap, error: null };
  },

  async getCurrentAdminCosts() {
    return await supabase
      .from('administrative_costs')
      .select('*')
      .is('end_date', null)
      .order('cost_type');
  },

  async getActiveProducts(filters?: { clientId?: string; constructionSite?: string; limit?: number }) {
    try {
      const limit = filters?.limit || 100; // Límite por defecto
      
      let query = supabase
        .from('product_prices')
        .select(`
          id,
          code,
          description,
          fc_mr_value,
          type,
          age_days,
          placement_type,
          max_aggregate_size,
          slump,
          base_price,
          recipe:recipes(
            id,
            recipe_code
          )
        `)
        .eq('is_active', true)
        .limit(limit);
      
      // Aplicar filtros solo si están presentes
      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      
      if (filters?.constructionSite) {
        query = query.eq('construction_site', filters.constructionSite);
      }
      
      const { data, error } = await query.order('code');
      
      if (error) {
        throw error;
      }
      
      return { data: data || [], error: null };
    } catch (error) {
      const errorMessage = handleError(error, 'getActiveProducts');
      console.error(errorMessage);
      return { data: [], error: errorMessage };
    }
  },

  async getActiveServices() {
    return await supabase
      .from('additional_services')
      .select('*')
      .eq('is_active', true)
      .order('code');
  },

  async getClientQuoteHistory(clientId: string) {
    try {
      const { data, error } = await supabase
        .from('order_history')
        .select(`
          id,
          order_number,
          concrete_type,
          volume,
          concrete_price,
          pump_price,
          total_amount,
          delivery_date,
          delivery_site,
          location
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Supabase error fetching client order history:', error);
        throw error;
      }

      // Transformar los datos para mantener consistencia con la interfaz anterior
      const processedHistory = data?.map(order => ({
        quote_details: [{
          product: {
            recipe_code: order.concrete_type
          },
          final_price: order.concrete_price,
          volume: order.volume
        }],
        order_number: order.order_number,
        delivery_date: order.delivery_date,
        delivery_site: order.delivery_site,
        location: order.location
      })) || [];

      return processedHistory;
    } catch (error) {
      console.error('Comprehensive error in getClientQuoteHistory:', error);
      return []; // Retorna un arreglo vacío en caso de error
    }
  }
}; 