import { supabase } from '@/lib/supabase/client';
import type { StagingRemision } from '@/types/arkik';

export interface CompatibleOrder {
  id: string;
  order_number: string;
  client_id: string;
  client_name: string;
  construction_site: string;
  construction_site_id: string;
  delivery_date: string;
  order_status: string;
  credit_status: string;
  total_amount: number;
  compatibility_score: number;
  compatibility_reasons: string[];
  order_items: OrderItem[];
}

export interface OrderItem {
  id: string;
  recipe_id: string;
  recipe_name: string;
  quantity: number;
  unit_price: number;
  quote_detail_id?: string;
}

export interface ManualAssignmentCandidate {
  remision: StagingRemision;
  compatibleOrders: CompatibleOrder[];
}

export class ArkikManualAssignmentService {
  private plantId: string;

  constructor(plantId: string) {
    this.plantId = plantId;
  }

  /**
   * Find compatible orders for manual assignment of unmatched remisiones
   */
  async findCompatibleOrdersForRemisiones(
    unmatchedRemisiones: StagingRemision[]
  ): Promise<ManualAssignmentCandidate[]> {
    console.log('[ManualAssignment] Finding compatible orders for', unmatchedRemisiones.length, 'remisiones');
    
    const candidates: ManualAssignmentCandidate[] = [];

    for (const remision of unmatchedRemisiones) {
      const compatibleOrders = await this.findCompatibleOrdersForRemision(remision);
      candidates.push({
        remision,
        compatibleOrders
      });
    }

    return candidates;
  }

  /**
   * Find compatible orders for a single remision
   */
  private async findCompatibleOrdersForRemision(remision: StagingRemision): Promise<CompatibleOrder[]> {
    if (!remision.client_id || !remision.recipe_id) {
      console.warn('[ManualAssignment] Remision missing required data:', remision.remision_number);
      return [];
    }

    // Define date range (±2 days flexibility for manual assignment)
    const baseDate = remision.fecha;
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() - 2);
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + 2);

    try {
      console.log('[ManualAssignment] Searching orders for remision:', remision.remision_number, {
        client_id: remision.client_id,
        recipe_id: remision.recipe_id,
        date_range: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
      });

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          client_id,
          construction_site,
          construction_site_id,
          delivery_date,
          order_status,
          credit_status,
          total_amount,
          clients!inner (
            id,
            business_name
          ),
          order_items!inner (
            id,
            recipe_id,
            quantity,
            unit_price,
            quote_detail_id,
            recipes!inner (
              id,
              recipe_code,
              arkik_long_code
            )
          )
        `)
        .eq('client_id', remision.client_id)
        .gte('delivery_date', startDate.toISOString().split('T')[0])
        .lte('delivery_date', endDate.toISOString().split('T')[0])
        .in('order_status', ['created', 'validated', 'scheduled']) // Only orders that can be updated
        .eq('credit_status', 'approved') // Only approved orders
        .eq('plant_id', this.plantId);

      if (error) {
        console.error('[ManualAssignment] Error fetching orders:', error);
        return [];
      }

      if (!orders || orders.length === 0) {
        console.log('[ManualAssignment] No orders found for remision:', remision.remision_number);
        return [];
      }

      console.log('[ManualAssignment] Found', orders.length, 'candidate orders');

      // Evaluate compatibility for each order
      const compatibleOrders: CompatibleOrder[] = [];

      for (const order of orders) {
        const compatibility = this.evaluateOrderCompatibility(remision, order as any);
        if (compatibility.score > 0) { // Accept any positive compatibility
          compatibleOrders.push({
            id: order.id,
            order_number: order.order_number,
            client_id: order.client_id,
            client_name: (order.clients as any)?.business_name || 'Unknown',
            construction_site: order.construction_site,
            construction_site_id: order.construction_site_id,
            delivery_date: order.delivery_date,
            order_status: order.order_status,
            credit_status: order.credit_status,
            total_amount: order.total_amount,
            compatibility_score: compatibility.score,
            compatibility_reasons: compatibility.reasons,
            order_items: (order.order_items as any[]).map(item => ({
              id: item.id,
              recipe_id: item.recipe_id,
              recipe_name: item.recipes?.arkik_long_code || item.recipes?.recipe_code || 'Unknown Recipe',
              quantity: item.quantity,
              unit_price: item.unit_price,
              quote_detail_id: item.quote_detail_id
            }))
          });
        }
      }

      // Sort by compatibility score (highest first)
      compatibleOrders.sort((a, b) => b.compatibility_score - a.compatibility_score);

      console.log('[ManualAssignment] Found', compatibleOrders.length, 'compatible orders for remision:', remision.remision_number);

      return compatibleOrders;

    } catch (error) {
      console.error('[ManualAssignment] Error finding compatible orders:', error);
      return [];
    }
  }

  /**
   * Evaluate compatibility between a remision and an order
   */
  private evaluateOrderCompatibility(
    remision: StagingRemision,
    order: any
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    const maxScore = 10;

    // Client match (mandatory - already filtered in query)
    if (order.client_id === remision.client_id) {
      score += 3;
      reasons.push('Cliente exacto');
    }

    // Construction site match
    if (order.construction_site_id === remision.construction_site_id) {
      score += 2;
      reasons.push('Obra exacta');
    } else if (order.construction_site && remision.obra_name &&
               order.construction_site.toLowerCase().includes(remision.obra_name.toLowerCase())) {
      score += 1;
      reasons.push('Obra similar');
    }

    // Date proximity
    const orderDate = new Date(order.delivery_date);
    const remisionDate = remision.fecha;
    const daysDiff = Math.abs((orderDate.getTime() - remisionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      score += 2;
      reasons.push('Fecha exacta');
    } else if (daysDiff <= 1) {
      score += 1.5;
      reasons.push('Fecha próxima');
    } else if (daysDiff <= 2) {
      score += 1;
      reasons.push('Fecha cercana');
    }

    // Recipe/Product compatibility
    const orderItems = order.order_items || [];
    const hasMatchingRecipe = orderItems.some((item: any) => 
      item.recipe_id === remision.recipe_id
    );

    if (hasMatchingRecipe) {
      score += 2;
      reasons.push('Receta compatible');
    }

    // Quote compatibility (bonus points)
    if (remision.quote_detail_id) {
      const hasMatchingQuote = orderItems.some((item: any) => 
        item.quote_detail_id === remision.quote_detail_id
      );
      
      if (hasMatchingQuote) {
        score += 1;
        reasons.push('Cotización exacta');
      }
    }

    return {
      score: Math.min(score, maxScore),
      reasons
    };
  }
}
