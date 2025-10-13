import { supabase } from '@/lib/supabase/client';
import type { StagingRemision } from '@/types/arkik';
import { hasStrictRecipeMatch } from './arkikMatchingUtils';

export interface CompatibleOrder {
  id: string;
  order_number: string;
  client_id: string;
  client_name: string;
  construction_site: string;
  construction_site_id: string;
  delivery_date: string;
  delivery_time?: string;
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
  volume: number;
  unit_price: number;
  quote_detail_id?: string;
}

export interface ManualAssignmentCandidate {
  remision: StagingRemision;
  compatibleOrders: CompatibleOrder[];
  isCurrentlyAssigned?: boolean;
  currentAssignment?: {
    orderId: string;
    orderNumber: string;
  };
}

export interface RemisionSearchFilters {
  searchTerm?: string;
  clientId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  includeAssigned?: boolean;
  plantId?: string;
}

export interface RemisionSearchResult {
  remision: StagingRemision;
  isAssigned: boolean;
  currentOrder?: {
    id: string;
    orderNumber: string;
  };
}

export class ArkikManualAssignmentService {
  private plantId: string;

  constructor(plantId: string) {
    this.plantId = plantId;
  }

  // Parse a date string like YYYY-MM-DD as a local date to avoid UTC shift
  private parseLocalDate(dateInput: string | Date): Date {
    if (dateInput instanceof Date) return dateInput;
    if (!dateInput) return new Date();
    // Expecting format YYYY-MM-DD; fall back to native Date if not
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateInput);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const day = Number(m[3]);
      return new Date(year, month, day);
    }
    return new Date(dateInput);
  }

  // Format a Date as YYYY-MM-DD without using toISOString (no TZ conversion)
  private formatYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Normalize recipe codes for robust comparisons
  private normalizeRecipeCode(value?: string | null): string {
    return (value || '')
      .toString()
      .normalize('NFKD')
      .replace(/\s+/g, '')
      .replace(/[-_/]/g, '')
      .toUpperCase();
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

    // Define strict search first (same day), then fallback ranges (±3 days, then ±14 days)
    const baseDateObj = this.parseLocalDate(remision.fecha as any);
    // Normalize to YYYY-MM-DD boundaries using local components only
    const sameDay = this.formatYmd(baseDateObj);
    const range3Start = new Date(baseDateObj);
    range3Start.setDate(range3Start.getDate() - 3);
    const range3End = new Date(baseDateObj);
    range3End.setDate(range3End.getDate() + 3);
    const range14Start = new Date(baseDateObj);
    range14Start.setDate(range14Start.getDate() - 14);
    const range14End = new Date(baseDateObj);
    range14End.setDate(range14End.getDate() + 14);

    try {
      console.log('[ManualAssignment] Searching orders for remision:', remision.remision_number, {
        client_id: remision.client_id,
        recipe_id: remision.recipe_id,
        same_day: sameDay,
        range_3_days: [this.formatYmd(range3Start), this.formatYmd(range3End)],
        range_14_days: [this.formatYmd(range14Start), this.formatYmd(range14End)]
      });

      // Strict search: same client, same delivery_date
      let { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          client_id,
          construction_site,
          construction_site_id,
          delivery_date,
          delivery_time,
          order_status,
          credit_status,
          total_amount,
          clients!inner (
            id,
            business_name
          ),
          order_items (
            id,
            recipe_id,
            volume,
            unit_price,
            quote_detail_id,
            quote_details:quote_detail_id (
              id,
              recipe_id
            ),
            recipes!inner (
              id,
              recipe_code,
              arkik_long_code
            )
          )
        `)
        .eq('client_id', remision.client_id)
        .eq('delivery_date', sameDay)
        .in('order_status', ['created', 'validated', 'scheduled']) // Only orders that can be updated
        .eq('plant_id', this.plantId)
        .limit(50); // Limit results for performance

      if (error) {
        console.error('[ManualAssignment] Error fetching orders (same client):', error);
      }

      // If no orders found for same client on same day, try broader search (±3 days), then plant-wide
      if (!orders || orders.length === 0) {
        console.log('[ManualAssignment] No orders found same-day, trying ±3 days for same client...');
        
        const { data: broadOrders, error: broadError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            client_id,
            construction_site,
            construction_site_id,
            delivery_date,
            delivery_time,
            order_status,
            credit_status,
            total_amount,
            clients!inner (
              id,
              business_name
            ),
            order_items (
              id,
              recipe_id,
              volume,
              unit_price,
              quote_detail_id,
              quote_details:quote_detail_id (
                id,
                recipe_id
              ),
              recipes!inner (
                id,
                recipe_code,
                arkik_long_code
              )
            )
          `)
          .gte('delivery_date', this.formatYmd(range3Start))
          .lte('delivery_date', this.formatYmd(range3End))
          .in('order_status', ['created', 'validated', 'scheduled'])
          .eq('plant_id', this.plantId)
          .limit(30); // Smaller limit for broader search

        if (broadError) {
          console.error('[ManualAssignment] Error fetching orders (broad search):', broadError);
          return [];
        }

        orders = broadOrders;
      }

      // Final fallback: plant-wide ±14 days regardless of client
      if (!orders || orders.length === 0) {
        console.log('[ManualAssignment] No orders found for same client ±3 days, trying plant-wide ±14 days');
        const { data: plantWideOrders, error: plantWideError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            client_id,
            construction_site,
            construction_site_id,
            delivery_date,
            delivery_time,
            order_status,
            credit_status,
            total_amount,
            clients!inner (
              id,
              business_name
            ),
            order_items (
              id,
              recipe_id,
              volume,
              unit_price,
              quote_detail_id,
              quote_details:quote_detail_id (
                id,
                recipe_id
              ),
              recipes!inner (
                id,
                recipe_code,
                arkik_long_code
              )
            )
          `)
          .gte('delivery_date', this.formatYmd(range14Start))
          .lte('delivery_date', this.formatYmd(range14End))
          .in('order_status', ['created', 'validated', 'scheduled'])
          .eq('plant_id', this.plantId)
          .limit(30);

        if (!plantWideError && plantWideOrders) {
          orders = plantWideOrders;
        }
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
            delivery_time: (order as any).delivery_time || undefined,
            order_status: order.order_status,
            credit_status: order.credit_status,
            total_amount: order.total_amount,
            compatibility_score: compatibility.score,
            compatibility_reasons: compatibility.reasons,
            order_items: (order.order_items as any[]).map(item => ({
              id: item.id,
              recipe_id: item.recipe_id,
              recipe_name: item.recipes?.arkik_long_code || item.recipes?.recipe_code || 'Unknown Recipe',
              volume: item.volume,
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
   * Search and filter remisiones for manual reassignment
   */
  async searchRemisiones(filters: RemisionSearchFilters): Promise<RemisionSearchResult[]> {
    console.log('[ManualAssignment] Searching remisiones with filters:', filters);

    try {
      let query = supabase
        .from('staging_remisiones')
        .select(`
          *,
          clients:business_name,
          construction_sites:obra_name,
          recipes:arkik_long_code
        `)
        .eq('plant_id', filters.plantId || this.plantId);

      // Apply filters
      if (filters.searchTerm) {
        query = query.or(`
          remision_number.ilike.%${filters.searchTerm}%,
          cliente_name.ilike.%${filters.searchTerm}%,
          obra_name.ilike.%${filters.searchTerm}%
        `);
      }

      if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters.dateFrom) {
        query = query.gte('fecha', filters.dateFrom.toISOString().split('T')[0]);
      }

      if (filters.dateTo) {
        query = query.lte('fecha', filters.dateTo.toISOString().split('T')[0]);
      }

      // Get remisiones
      const { data: remisiones, error: remisionesError } = await query
        .order('fecha', { ascending: false })
        .limit(100); // Limit for performance

      if (remisionesError) {
        console.error('[ManualAssignment] Error fetching remisiones:', remisionesError);
        return [];
      }

      if (!remisiones || remisiones.length === 0) {
        return [];
      }

      // Get current assignments if including assigned remisiones
      let assignments: any[] = [];
      if (filters.includeAssigned) {
        const remisionIds = remisiones.map(r => r.id);
        const { data: assignmentData } = await supabase
          .from('remisiones')
          .select(`
            staging_remision_id,
            order_id,
            orders:order_id (
              id,
              order_number
            )
          `)
          .in('staging_remision_id', remisionIds);

        assignments = assignmentData || [];
      }

      // Build results
      const results: RemisionSearchResult[] = remisiones.map(remision => {
        const assignment = assignments.find(a => a.staging_remision_id === remision.id);

        return {
          remision: remision as StagingRemision,
          isAssigned: !!assignment,
          currentOrder: assignment ? {
            id: assignment.orders?.id,
            orderNumber: assignment.orders?.order_number
          } : undefined
        };
      });

      return results;

    } catch (error) {
      console.error('[ManualAssignment] Error searching remisiones:', error);
      return [];
    }
  }

  /**
   * Get candidates for reassignment including already assigned remisiones
   */
  async findReassignmentCandidates(
    remisionIds: string[],
    includeAssigned: boolean = false
  ): Promise<ManualAssignmentCandidate[]> {
    console.log('[ManualAssignment] Finding reassignment candidates for', remisionIds.length, 'remisiones');

    const candidates: ManualAssignmentCandidate[] = [];

    for (const remisionId of remisionIds) {
      // Get remision details
      const { data: remision, error } = await supabase
        .from('staging_remisiones')
        .select('*')
        .eq('id', remisionId)
        .single();

      if (error || !remision) {
        console.warn('[ManualAssignment] Could not find remision:', remisionId);
        continue;
      }

      // Get current assignment if exists
      let currentAssignment = undefined;
      if (includeAssigned) {
        const { data: assignment } = await supabase
          .from('remisiones')
          .select(`
            order_id,
            orders:order_id (
              id,
              order_number
            )
          `)
          .eq('staging_remision_id', remisionId)
          .single();

        if (assignment) {
          currentAssignment = {
            orderId: assignment.orders?.id,
            orderNumber: assignment.orders?.order_number
          };
        }
      }

      // Find compatible orders
      const compatibleOrders = await this.findCompatibleOrdersForRemision(remision as StagingRemision);

      candidates.push({
        remision: remision as StagingRemision,
        compatibleOrders,
        isCurrentlyAssigned: !!currentAssignment,
        currentAssignment
      });
    }

    return candidates;
  }

  /**
   * Evaluate compatibility between a remision and an order
   */
  private evaluateOrderCompatibility(
    remision: StagingRemision,
    order: any
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 1; // Base score so all orders are at least considered
    const maxScore = 10;

    // Client match (high priority)
    if (order.client_id === remision.client_id) {
      score += 3;
      reasons.push('Cliente exacto');
    } else {
      reasons.push('Cliente diferente');
    }

    // Construction site match
    if (order.construction_site_id === remision.construction_site_id) {
      score += 2;
      reasons.push('Obra exacta');
    } else if (order.construction_site && remision.obra_name &&
               order.construction_site.toLowerCase().includes(remision.obra_name.toLowerCase())) {
      score += 1;
      reasons.push('Obra similar');
    } else {
      reasons.push('Obra diferente');
    }

    // Date proximity: prefer exact same YYYY-MM-DD without TZ effects
    const orderYmd = this.formatYmd(this.parseLocalDate(order.delivery_date));
    const remisionYmd = this.formatYmd(this.parseLocalDate(remision.fecha as any));
    if (orderYmd === remisionYmd) {
      score += 3; // stronger preference for exact same day
      reasons.push('Fecha exacta');
    } else {
      const orderDate = this.parseLocalDate(order.delivery_date);
      const remisionDate = this.parseLocalDate(remision.fecha as any);
      const daysDiff = Math.abs((orderDate.getTime() - remisionDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 1) {
        score += 1.5;
        reasons.push('Fecha próxima');
      } else if (daysDiff <= 7) {
        score += 1;
      reasons.push('Fecha cercana');
      } else if (daysDiff <= 30) {
        score += 0.5;
        reasons.push('Fecha en el mes');
      } else {
        reasons.push('Fecha distante');
      }
    }

    // Recipe/Product compatibility
    const orderItems = order.order_items || [];
    const strictRecipeOk = hasStrictRecipeMatch(orderItems as any, remision);
    if (!strictRecipeOk) {
      // Block manual assignment if strict match fails
      return { score: 0, reasons: [...reasons, 'Receta diferente (no coincide con items de la orden)'] };
    }
    score += 2;
    reasons.push('Receta compatible');

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

    // Order status bonus (prefer orders that are easier to modify)
    if (order.order_status === 'created') {
      score += 0.5;
      reasons.push('Orden nueva');
    }

    return {
      score: Math.min(score, maxScore),
      reasons
    };
  }
}
