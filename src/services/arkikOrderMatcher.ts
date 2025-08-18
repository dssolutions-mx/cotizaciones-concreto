import { supabase } from '@/lib/supabase/client';
import { StagingRemision, OrderSuggestion } from '@/types/arkik';
import { Order, OrderItem } from '@/types/orders';

export interface ExistingOrderMatch {
  order: Order;
  orderItems: OrderItem[];
  matchedRemisiones: StagingRemision[];
  matchScore: number;
  matchReasons: string[];
}

export interface OrderMatchCriteria {
  client_id?: string; // May be undefined for flexible matching
  client_name?: string; // Used for similarity matching
  construction_site_id?: string;
  construction_site_name?: string;
  delivery_date_start: Date;
  delivery_date_end: Date;
  recipe_id?: string;
  product_description?: string;
}

export class ArkikOrderMatcher {
  private plantId: string;

  constructor(plantId: string) {
    this.plantId = plantId;
  }

  /**
   * Find existing orders that can accommodate remisiones
   */
  async findMatchingOrders(
    remisiones: StagingRemision[]
  ): Promise<{
    matchedOrders: ExistingOrderMatch[];
    unmatchedRemisiones: StagingRemision[];
  }> {
    const matchedOrders: ExistingOrderMatch[] = [];
    const unmatchedRemisiones: StagingRemision[] = [];

    // Group remisiones by potential order criteria
    const remisionGroups = this.groupRemisionesByOrderCriteria(remisiones);

    for (const group of remisionGroups) {
      const criteria = this.buildMatchCriteria(group);
      
      console.log(`[ArkikOrderMatcher] Processing group with ${group.length} remisiones:`, {
        firstRemision: group[0].remision_number,
        client_id: criteria.client_id,
        client_name: criteria.client_name,
        construction_site_name: criteria.construction_site_name,
        delivery_date: criteria.delivery_date_start.toISOString().split('T')[0]
      });
      
      const existingOrders = await this.queryExistingOrders(criteria);
      
      console.log(`[ArkikOrderMatcher] Found ${existingOrders.length} candidate orders for matching`);

      if (existingOrders.length > 0) {
        // Find the best matching order
        const bestMatch = this.selectBestOrderMatch(group, existingOrders);
        if (bestMatch) {
          console.log(`[ArkikOrderMatcher] ✅ Match found: Order ${bestMatch.order.order_number} with score ${(bestMatch.matchScore * 100).toFixed(1)}%`);
          matchedOrders.push(bestMatch);
        } else {
          console.log(`[ArkikOrderMatcher] ❌ No suitable match found (score below threshold)`);
          unmatchedRemisiones.push(...group);
        }
      } else {
        console.log(`[ArkikOrderMatcher] ❌ No candidate orders found for criteria`);
        unmatchedRemisiones.push(...group);
      }
    }

    return { matchedOrders, unmatchedRemisiones };
  }

  /**
   * Group remisiones that could potentially belong to the same order
   */
  private groupRemisionesByOrderCriteria(remisiones: StagingRemision[]): StagingRemision[][] {
    const groups = new Map<string, StagingRemision[]>();

    remisiones.forEach(remision => {
      // Create a key based on order-relevant criteria
      const groupKey = this.generateOrderGroupKey(remision);
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(remision);
    });

    return Array.from(groups.values());
  }

  /**
   * Generate a key for grouping remisiones by order criteria
   */
  private generateOrderGroupKey(remision: StagingRemision): string {
    // Prioritize client names for flexible matching (like validation does)
    const client = remision.cliente_name || remision.client_id || 'UNKNOWN_CLIENT';
    const site = remision.obra_name || remision.construction_site_id || 'UNKNOWN_SITE';
    const date = remision.fecha.toISOString().split('T')[0];
    const recipe = remision.product_description || remision.recipe_id || 'UNKNOWN_RECIPE';
    
    // Normalize the key for consistent grouping
    const normalizedClient = this.normalizeString(client.toString());
    const normalizedSite = this.normalizeString(site.toString());
    
    return `${normalizedClient}_${normalizedSite}_${date}_${recipe}`.replace(/\s+/g, '_').toUpperCase();
  }

  /**
   * Build search criteria from a group of remisiones
   */
  private buildMatchCriteria(remisiones: StagingRemision[]): OrderMatchCriteria {
    const firstRemision = remisiones[0];
    
    // Define date range (allow ±1 day flexibility)
    const baseDate = firstRemision.fecha;
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + 1);

    return {
      client_id: firstRemision.client_id || undefined, // May be undefined, we'll use flexible matching
      client_name: firstRemision.cliente_name, // Used for similarity matching
      construction_site_id: firstRemision.construction_site_id,
      construction_site_name: firstRemision.obra_name,
      delivery_date_start: startDate,
      delivery_date_end: endDate,
      recipe_id: firstRemision.recipe_id,
      product_description: firstRemision.product_description
    };
  }

  /**
   * Query existing orders based on criteria
   */
  private async queryExistingOrders(criteria: OrderMatchCriteria): Promise<Order[]> {
    // Use broader query criteria for flexible matching
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        clients!inner (
          id,
          business_name,
          client_code
        )
      `)
      .gte('delivery_date', criteria.delivery_date_start.toISOString().split('T')[0])
      .lte('delivery_date', criteria.delivery_date_end.toISOString().split('T')[0])
      .in('order_status', ['created', 'validated', 'scheduled']) // Only orders that can be updated
      .eq('credit_status', 'approved'); // Only approved orders

    // Apply client filter if we have a specific client_id
    if (criteria.client_id) {
      query = query.eq('client_id', criteria.client_id);
    } else if (criteria.client_name) {
      // For flexible matching, we'll query broader and filter in the evaluation step
      // This allows us to use similarity matching
      console.log(`[ArkikOrderMatcher] Using flexible client matching for: "${criteria.client_name}"`);
    }

    // Apply construction site filter if we have specific criteria
    if (criteria.construction_site_id) {
      query = query.eq('construction_site_id', criteria.construction_site_id);
    } else if (criteria.construction_site_name) {
      // Use broader search for flexible matching
      query = query.ilike('construction_site', `%${criteria.construction_site_name}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error querying existing orders:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Select the best matching order from candidates
   */
  private selectBestOrderMatch(
    remisiones: StagingRemision[],
    candidateOrders: Order[]
  ): ExistingOrderMatch | null {
    let bestMatch: ExistingOrderMatch | null = null;
    let bestScore = 0;

    for (const order of candidateOrders) {
      const match = this.evaluateOrderMatch(remisiones, order);
      
      if (match.matchScore > bestScore) {
        bestScore = match.matchScore;
        bestMatch = match;
      }
    }

    // Only return matches with a minimum score threshold
    // Lower threshold for more flexible matching with similarity scoring
    return bestScore >= 0.5 ? bestMatch : null;
  }

  /**
   * Evaluate how well remisiones match an existing order
   */
  private evaluateOrderMatch(
    remisiones: StagingRemision[],
    order: Order
  ): ExistingOrderMatch {
    const matchReasons: string[] = [];
    let score = 0;
    const maxScore = 10;
    const firstRemision = remisiones[0];

    // Client matching (using similarity like validation does)
    const clientSimilarity = this.calculateClientSimilarity(
      firstRemision.cliente_name || '',
      (order as any).clients?.business_name || ''
    );
    
    if (order.client_id === firstRemision.client_id) {
      score += 3;
      matchReasons.push('Cliente exacto');
    } else if (clientSimilarity > 0.8) {
      score += 2.5;
      matchReasons.push('Cliente muy similar');
    } else if (clientSimilarity > 0.6) {
      score += 2;
      matchReasons.push('Cliente similar');
    } else if (clientSimilarity > 0.4) {
      score += 1;
      matchReasons.push('Cliente parcialmente similar');
    }

    // Construction site matching (using similarity like validation does)
    const siteSimilarity = this.calculateSiteSimilarity(
      firstRemision.obra_name || '',
      order.construction_site || ''
    );
    
    if (order.construction_site_id === firstRemision.construction_site_id) {
      score += 2;
      matchReasons.push('Obra exacta');
    } else if (siteSimilarity > 0.8) {
      score += 1.8;
      matchReasons.push('Obra muy similar');
    } else if (siteSimilarity > 0.6) {
      score += 1.5;
      matchReasons.push('Obra similar');
    } else if (siteSimilarity > 0.4) {
      score += 1;
      matchReasons.push('Obra parcialmente similar');
    }

    // Date proximity
    const orderDate = new Date(order.delivery_date);
    const remisionDate = firstRemision.fecha;
    const daysDiff = Math.abs((orderDate.getTime() - remisionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      score += 2;
      matchReasons.push('Fecha exacta');
    } else if (daysDiff <= 1) {
      score += 1.5;
      matchReasons.push('Fecha próxima');
    } else if (daysDiff <= 2) {
      score += 1;
      matchReasons.push('Fecha cercana');
    }

    // Recipe/Product match (check order items)
    const orderItems = (order as any).order_items || [];
    const hasMatchingProduct = orderItems.some((item: OrderItem) => {
      return remisiones.some(remision => 
        item.quote_detail_id === remision.quote_detail_id ||
        (item as any).recipe_id === remision.recipe_id
      );
    });

    if (hasMatchingProduct) {
      score += 2;
      matchReasons.push('Producto/receta compatible');
    }

    // Volume capacity check
    const totalRemisionVolume = remisiones.reduce((sum, r) => sum + r.volumen_fabricado, 0);
    const orderCapacity = this.estimateOrderCapacity(orderItems);
    
    if (orderCapacity >= totalRemisionVolume) {
      score += 1;
      matchReasons.push('Capacidad suficiente');
    }

    console.log(`[ArkikOrderMatcher] Evaluating match for order ${order.order_number}:`, {
      clientSimilarity: clientSimilarity.toFixed(3),
      siteSimilarity: siteSimilarity.toFixed(3),
      daysDiff: daysDiff.toFixed(1),
      totalScore: score.toFixed(2),
      finalScore: (score / maxScore).toFixed(3),
      matchReasons
    });

    return {
      order,
      orderItems,
      matchedRemisiones: remisiones,
      matchScore: score / maxScore,
      matchReasons
    };
  }

  /**
   * Calculate client name similarity (using same logic as validation)
   */
  private calculateClientSimilarity(arkikClientName: string, dbClientName: string): number {
    if (!arkikClientName || !dbClientName) return 0;
    
    const normalized1 = this.normalizeString(arkikClientName);
    const normalized2 = this.normalizeString(dbClientName);
    
    // Exact match
    if (normalized1 === normalized2) return 1.0;
    
    // Substring match
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.8;
    }
    
    // Word-based similarity
    const words1 = normalized1.split(/\s+/);
    const words2 = normalized2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word)).length;
    const totalWords = Math.max(words1.length, words2.length);
    
    return commonWords / totalWords;
  }

  /**
   * Calculate construction site similarity (using same logic as validation)
   */
  private calculateSiteSimilarity(arkikSiteName: string, dbSiteName: string): number {
    if (!arkikSiteName || !dbSiteName) return 0;
    
    const normalized1 = this.normalizeString(arkikSiteName);
    const normalized2 = this.normalizeString(dbSiteName);
    
    // Exact match
    if (normalized1 === normalized2) return 1.0;
    
    // Substring match
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.9;
    }
    
    // Word-based similarity for sites
    const words1 = normalized1.split(/\s+/);
    const words2 = normalized2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word)).length;
    const totalWords = Math.max(words1.length, words2.length);
    
    return commonWords / totalWords;
  }

  /**
   * Normalize string for comparison (using same logic as validation)
   */
  private normalizeString(str: string): string {
    return str
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Estimate remaining capacity of an order
   */
  private estimateOrderCapacity(orderItems: OrderItem[]): number {
    // For now, assume orders can accommodate additional volume
    // In the future, you might want to check against existing remisiones
    return orderItems.reduce((sum, item) => sum + (item.volume || 0), 0);
  }

  /**
   * Update an existing order with new remisiones
   */
  async updateOrderWithRemisiones(
    orderId: string,
    remisiones: StagingRemision[]
  ): Promise<{
    success: boolean;
    updatedOrderItems?: OrderItem[];
    error?: string;
  }> {
    try {
      // Group remisiones by product/recipe to create or update order items
      const remisionsByProduct = this.groupRemisionesByProduct(remisiones);
      const updatedOrderItems: OrderItem[] = [];

      for (const [productKey, productRemisiones] of remisionsByProduct.entries()) {
        const totalVolume = productRemisiones.reduce((sum, r) => sum + r.volumen_fabricado, 0);
        const avgPrice = this.calculateAveragePrice(productRemisiones);
        const firstRemision = productRemisiones[0];

        // Create new order item for this product group
        const orderItemData = {
          order_id: orderId,
          product_type: 'CONCRETO',
          volume: totalVolume,
          unit_price: avgPrice,
          total_price: totalVolume * avgPrice,
          quote_detail_id: firstRemision.quote_detail_id,
          recipe_id: firstRemision.recipe_id,
          has_pump_service: false,
          pump_price: 0,
          pump_volume: 0,
          has_empty_truck_charge: false,
          empty_truck_volume: 0,
          empty_truck_price: 0
        };

        const { data: orderItem, error } = await supabase
          .from('order_items')
          .insert(orderItemData)
          .select()
          .single();

        if (error) {
          throw error;
        }

        updatedOrderItems.push(orderItem);
      }

      // Update order total amount
      const newTotalAmount = updatedOrderItems.reduce((sum, item) => sum + item.total_price, 0);
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          total_amount: newTotalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        updatedOrderItems
      };

    } catch (error) {
      console.error('Error updating order with remisiones:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Group remisiones by product characteristics
   */
  private groupRemisionesByProduct(remisiones: StagingRemision[]): Map<string, StagingRemision[]> {
    const groups = new Map<string, StagingRemision[]>();

    remisiones.forEach(remision => {
      const productKey = `${remision.recipe_id}_${remision.unit_price}`;
      
      if (!groups.has(productKey)) {
        groups.set(productKey, []);
      }
      groups.get(productKey)!.push(remision);
    });

    return groups;
  }

  /**
   * Calculate average price for a group of remisiones
   */
  private calculateAveragePrice(remisiones: StagingRemision[]): number {
    const validPrices = remisiones
      .map(r => r.unit_price)
      .filter((price): price is number => price != null && price > 0);

    if (validPrices.length === 0) return 0;

    return validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
  }
}
