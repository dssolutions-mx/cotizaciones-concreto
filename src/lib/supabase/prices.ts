import { supabase } from './client';
import { handleError } from '@/utils/errorHandler';

export const priceService = {
  // Precios de materiales
  async saveMaterialPrice(priceData: {
    materialType: string;
    pricePerUnit: number;
    effectiveDate: string;
  }) {
    // Cerrar precio actual
    await supabase
      .from('material_prices')
      .update({ end_date: new Date().toISOString() })
      .match({ 
        material_type: priceData.materialType,
        end_date: null 
      });

    // Insertar nuevo precio
    return await supabase
      .from('material_prices')
      .insert({
        material_type: priceData.materialType,
        price_per_unit: priceData.pricePerUnit,
        effective_date: priceData.effectiveDate
      });
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