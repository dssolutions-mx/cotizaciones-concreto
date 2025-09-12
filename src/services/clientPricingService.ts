import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

interface PricingResult {
  price: number;
  source: 'active_quote' | 'client_average' | 'system_average' | 'default';
  description: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ClientPricing {
  clientId: string;
  averagePrice: number;
  totalVolume: number;
  lastPriceDate: string | null;
}

export class ClientPricingService {
  private static instance: ClientPricingService;
  private supabase: any;

  constructor(supabaseClient?: any) {
    this.supabase = supabaseClient;
  }

  static getInstance(supabaseClient?: any): ClientPricingService {
    if (!ClientPricingService.instance) {
      ClientPricingService.instance = new ClientPricingService(supabaseClient);
    }
    // Always update the supabase client if provided
    if (supabaseClient) {
      ClientPricingService.instance.supabase = supabaseClient;
    }
    return ClientPricingService.instance;
  }

  // Ensure we have a supabase client
  private ensureSupabaseClient() {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized. Call getInstance() with a supabase client first.');
    }
    return this.supabase;
  }

  /**
   * Get the best available price for a client using tiered fallback approach
   */
  async getClientConcretePrice(clientId: string): Promise<PricingResult> {
    try {
      const supabase = this.ensureSupabaseClient();
      
      // Tier 1: Try to get price from active quotes
      const activeQuotePrice = await this.getActiveQuotePrice(clientId);
      if (activeQuotePrice.price > 0) {
        return activeQuotePrice;
      }

      // Tier 2: Get client's historical average price
      const clientAveragePrice = await this.getClientAveragePrice(clientId);
      if (clientAveragePrice.price > 0) {
        return clientAveragePrice;
      }

      // Tier 3: Get system-wide average price
      const systemAveragePrice = await this.getSystemAveragePrice();
      if (systemAveragePrice.price > 0) {
        return systemAveragePrice;
      }

      // Tier 4: Default fallback price
      return {
        price: 2800,
        source: 'default',
        description: 'Precio base del sistema (sin datos históricos)',
        confidence: 'low'
      };
    } catch (error) {
      console.error('Error getting client concrete price:', error);
      return {
        price: 2800,
        source: 'default',
        description: 'Precio base (error en consulta)',
        confidence: 'low'
      };
    }
  }

  /**
   * Tier 1: Get price from active quotes for the client
   */
  private async getActiveQuotePrice(clientId: string): Promise<PricingResult> {
    try {
      const supabase = this.ensureSupabaseClient();
      const { data: activeQuotes, error } = await supabase
        .from('product_prices')
        .select(`
          base_price,
          effective_date,
          construction_site,
          quotes:quotes(quote_number, status)
        `)
        .eq('client_id', clientId)
        .eq('is_active', true)
        .eq('type', 'QUOTED')
        .not('quote_id', 'is', null)
        .order('effective_date', { ascending: false })
        .limit(5);

      if (error || !activeQuotes || activeQuotes.length === 0) {
        return { price: 0, source: 'active_quote', description: 'Sin cotizaciones activas', confidence: 'high' };
      }

      // Get the most recent active quote price
      const recentQuote = activeQuotes[0];
      const avgPrice = activeQuotes.reduce((sum, q) => sum + (q.base_price || 0), 0) / activeQuotes.length;

      return {
        price: avgPrice,
        source: 'active_quote',
        description: `Precio de cotización activa (${activeQuotes.length} productos)`,
        confidence: 'high'
      };
    } catch (error) {
      console.error('Error fetching active quote price:', error);
      return { price: 0, source: 'active_quote', description: 'Error en cotizaciones', confidence: 'high' };
    }
  }

  /**
   * Tier 2: Get client's historical average price from delivered concrete
   */
  private async getClientAveragePrice(clientId: string): Promise<PricingResult> {
    try {
      const supabase = this.ensureSupabaseClient();
      // Get client's historical deliveries with prices from last 12 months
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const { data: deliveries, error } = await supabase
        .from('remisiones')
        .select(`
          volumen_fabricado,
          fecha,
          orders:orders!inner(
            id,
            client_id,
            order_items:order_items(unit_price, volume)
          )
        `)
        .eq('orders.client_id', clientId)
        .eq('tipo_remision', 'CONCRETO')
        .gte('fecha', twelveMonthsAgo.toISOString().split('T')[0])
        .order('fecha', { ascending: false })
        .limit(200);

      if (error || !deliveries || deliveries.length === 0) {
        return { price: 0, source: 'client_average', description: 'Sin historial de entregas', confidence: 'medium' };
      }

      // Calculate weighted average price
      let totalValue = 0;
      let totalVolume = 0;

      deliveries.forEach((delivery: any) => {
        const volume = delivery.volumen_fabricado || 0;
        if (volume <= 0) return;

        // Find matching order item
        const orderItems = delivery.orders?.order_items || [];
        const matchingItem = orderItems.find((item: any) => 
          Math.abs((item.volume || 0) - volume) < 0.1 // Allow small volume differences
        ) || orderItems[0]; // Fallback to first item

        if (matchingItem && matchingItem.unit_price) {
          const price = parseFloat(matchingItem.unit_price) || 0;
          totalValue += price * volume;
          totalVolume += volume;
        }
      });

      if (totalVolume === 0) {
        return { price: 0, source: 'client_average', description: 'Sin precios en historial', confidence: 'medium' };
      }

      const averagePrice = totalValue / totalVolume;

      return {
        price: averagePrice,
        source: 'client_average',
        description: `Promedio histórico (${totalVolume.toFixed(1)} m³ en ${deliveries.length} entregas)`,
        confidence: 'medium'
      };
    } catch (error) {
      console.error('Error calculating client average price:', error);
      return { price: 0, source: 'client_average', description: 'Error en cálculo histórico', confidence: 'medium' };
    }
  }

  /**
   * Tier 3: Get system-wide average price (similar to ventas page calculation)
   */
  private async getSystemAveragePrice(): Promise<PricingResult> {
    try {
      const supabase = this.ensureSupabaseClient();
      // Get system-wide concrete deliveries from last 6 months for current average
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: systemDeliveries, error } = await supabase
        .from('remisiones')
        .select(`
          volumen_fabricado,
          fecha,
          orders:orders!inner(
            order_items:order_items(unit_price, volume)
          )
        `)
        .eq('tipo_remision', 'CONCRETO')
        .gte('fecha', sixMonthsAgo.toISOString().split('T')[0])
        .order('fecha', { ascending: false })
        .limit(1000); // Reasonable sample size

      if (error || !systemDeliveries || systemDeliveries.length === 0) {
        return { price: 0, source: 'system_average', description: 'Sin datos del sistema', confidence: 'low' };
      }

      // Calculate system-wide weighted average
      let totalValue = 0;
      let totalVolume = 0;

      systemDeliveries.forEach((delivery: any) => {
        const volume = delivery.volumen_fabricado || 0;
        if (volume <= 0) return;

        const orderItems = delivery.orders?.order_items || [];
        const matchingItem = orderItems.find((item: any) => 
          Math.abs((item.volume || 0) - volume) < 0.1
        ) || orderItems[0];

        if (matchingItem && matchingItem.unit_price) {
          const price = parseFloat(matchingItem.unit_price) || 0;
          totalValue += price * volume;
          totalVolume += volume;
        }
      });

      if (totalVolume === 0) {
        return { price: 0, source: 'system_average', description: 'Sin precios del sistema', confidence: 'low' };
      }

      const systemAverage = totalValue / totalVolume;

      return {
        price: systemAverage,
        source: 'system_average',
        description: `Promedio del sistema (${totalVolume.toFixed(1)} m³ en 6 meses)`,
        confidence: 'low'
      };
    } catch (error) {
      console.error('Error calculating system average price:', error);
      return { price: 0, source: 'system_average', description: 'Error en promedio del sistema', confidence: 'low' };
    }
  }

  /**
   * Get pricing for multiple clients efficiently
   */
  async getBulkClientPricing(clientIds: string[]): Promise<Record<string, PricingResult>> {
    const results: Record<string, PricingResult> = {};
    
    try {
      // Process in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < clientIds.length; i += batchSize) {
        const batch = clientIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (clientId) => {
          const pricing = await this.getClientConcretePrice(clientId);
          return { clientId, pricing };
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(({ clientId, pricing }) => {
          results[clientId] = pricing;
        });

        // Small delay between batches to be gentle on the database
        if (i + batchSize < clientIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Error in bulk client pricing:', error);
      // Return default pricing for all clients if bulk processing fails
      clientIds.forEach(clientId => {
        results[clientId] = {
          price: 2800,
          source: 'default',
          description: 'Precio base (error en consulta)',
          confidence: 'low'
        };
      });
    }

    return results;
  }
}

export const clientPricingService = ClientPricingService.getInstance();
