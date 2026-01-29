import { supabase } from '@/lib/supabase/client';
import { normalizeRecipeCode } from '@/lib/utils/recipeCodeUtils';
import { StagingRemision, OrderSuggestion } from '@/types/arkik';
import { Order, OrderItem } from '@/types/orders';
import { hasStrictRecipeMatch } from './arkikMatchingUtils';

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
   * Parse a date-only value (YYYY-MM-DD or Date) as a local date (no TZ shift)
   */
  private parseLocalDate(dateInput: string | Date): Date {
    if (dateInput instanceof Date) {
      // Normalize to local midnight to avoid time components affecting diffs
      return new Date(
        dateInput.getFullYear(),
        dateInput.getMonth(),
        dateInput.getDate()
      );
    }
    if (!dateInput) return new Date();
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateInput);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const day = Number(m[3]);
      return new Date(year, month, day);
    }
    // Fallback – let JS parse, but this should rarely be hit
    return new Date(dateInput);
  }

  /**
   * Extract YYYY-MM-DD string from date input without timezone conversion
   */
  private extractYmdString(dateInput: string | Date): string {
    if (typeof dateInput === 'string') {
      // If it's already in YYYY-MM-DD format, return as-is
      const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(dateInput);
      if (m) return m[0];
    }
    if (dateInput instanceof Date) {
      return this.formatYmd(dateInput);
    }
    return '';
  }

  /**
   * Format a Date as YYYY-MM-DD using local components (no TZ conversion)
   */
  private formatYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
        delivery_date_range: {
          start: this.formatYmd(criteria.delivery_date_start),
          end: this.formatYmd(criteria.delivery_date_end)
        }
      });
      
      const existingOrders = await this.queryExistingOrders(criteria);
      
      console.log(`[ArkikOrderMatcher] Found ${existingOrders.length} candidate orders for matching`, {
        client_id: criteria.client_id,
        construction_site_id: criteria.construction_site_id,
        dateRange: {
          start: this.formatYmd(criteria.delivery_date_start),
          end: this.formatYmd(criteria.delivery_date_end)
        }
      });

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
    const date = this.formatYmd(this.parseLocalDate(remision.fecha as any));
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
    
    // Extract YYYY-MM-DD string directly to avoid timezone issues
    const remisionYmdString = this.extractYmdString(firstRemision.fecha as any);
    
    // For date range search (±1 day), we still need Date objects
    const baseDate = this.parseLocalDate(firstRemision.fecha as any);
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
    const startYmd = this.formatYmd(criteria.delivery_date_start);
    const endYmd = this.formatYmd(criteria.delivery_date_end);

    let query = supabase
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
        order_items (
          id,
          recipe_id,
          master_recipe_id,
          volume,
          unit_price,
          quote_detail_id,
          quote_details:quote_detail_id (
            id,
            recipe_id,
            master_recipe_id
          )
        )
      `)
      .gte('delivery_date', startYmd)
      .lte('delivery_date', endYmd)
      .in('order_status', ['created', 'validated', 'scheduled']) // Only orders that can be updated
      .eq('plant_id', this.plantId); // Scope to current plant to ensure visibility
    
    // Apply client filter if provided (required for matching)
    if (criteria.client_id) {
      query = query.eq('client_id', criteria.client_id);
    } else if (criteria.client_name) {
      // For flexible matching, we'll query broader and filter in the evaluation step
      // This allows us to use similarity matching
      console.log(`[ArkikOrderMatcher] Using flexible client matching for: "${criteria.client_name}"`);
    }

    // RELAXED: Don't filter by construction_site_id strictly - let scoring handle site matching
    // This allows orders with different construction site IDs but same client/date to be considered
    // The scoring logic will handle construction site matching more leniently
    if (criteria.construction_site_name && !criteria.construction_site_id) {
      // Only use name-based search if we don't have an ID (to avoid too many results)
      query = query.ilike('construction_site', `%${criteria.construction_site_name}%`);
    }
    // Note: We intentionally don't filter by construction_site_id to allow relaxed matching
    
    query = query.limit(50);

    const { data, error } = await query;

    if (error) {
      console.error('Error querying existing orders:', error);
      return [];
    }

    const orders = data || [];
    console.log('[ArkikOrderMatcher] Retrieved orders:', orders.map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      delivery_date: o.delivery_date,
      order_items_length: Array.isArray(o.order_items) ? o.order_items.length : 0
    })));

    return orders;
  }

  /**
   * Select the best matching order from candidates
   */
  private selectBestOrderMatch(
    remisiones: StagingRemision[],
    candidateOrders: Order[]
  ): ExistingOrderMatch | null {
    const firstRemision = remisiones[0];
    // Use direct string extraction to avoid timezone conversion issues
    const remisionYmd = this.extractYmdString(firstRemision.fecha as any);

    // Evaluate all candidates and mark if same-day
    // Filter out orders that do not strictly match recipes for ALL remisiones with recipe_id
    const strictlyCompatible = candidateOrders.filter(order => {
      const items = (order as any).order_items as any[] | undefined;
      return remisiones.every(r => !r.recipe_id || hasStrictRecipeMatch(items as any, r));
    });

    const evaluated = strictlyCompatible.map(order => {
      const match = this.evaluateOrderMatch(remisiones, order);
      // Use direct string extraction for order date too
      const orderYmd = this.extractYmdString((order as any).delivery_date);
      const isSameDay = orderYmd === remisionYmd;
      return { match, isSameDay };
    });

    // Separate same-day and different-day candidates
    const sameDayCandidates = evaluated.filter(e => e.isSameDay);
    const differentDayCandidates = evaluated.filter(e => !e.isSameDay);

    console.log(`[ArkikOrderMatcher] Candidate analysis:`, {
      totalCandidates: candidateOrders.length,
      sameDayCandidates: sameDayCandidates.length,
      differentDayCandidates: differentDayCandidates.length,
      remisionDate: remisionYmd
    });

    // If we have same-day candidates, be more strict with recipe matching
    if (sameDayCandidates.length > 0) {
      console.log(`[ArkikOrderMatcher] Same-day candidates found - applying strict recipe matching`);
      
      // Sort same-day candidates by score (highest first)
      sameDayCandidates.sort((a, b) => b.match.matchScore - a.match.matchScore);
      
      // For same-day matches, require higher threshold and better recipe matching
      const bestSameDay = sameDayCandidates[0];
      if (bestSameDay && bestSameDay.match.matchScore >= 0.7) {
        console.log(`[ArkikOrderMatcher] ✅ Best same-day match: ${bestSameDay.match.order.order_number} (score: ${(bestSameDay.match.matchScore * 100).toFixed(1)}%)`);
        return bestSameDay.match;
      } else {
        console.log(`[ArkikOrderMatcher] ❌ Same-day candidates below threshold (best: ${bestSameDay?.match.matchScore ? (bestSameDay.match.matchScore * 100).toFixed(1) : 'N/A'}%)`);
      }
    }

    // If no good same-day matches, consider different-day candidates
    if (differentDayCandidates.length > 0) {
      differentDayCandidates.sort((a, b) => b.match.matchScore - a.match.matchScore);
      const bestDifferentDay = differentDayCandidates[0];
      
      if (bestDifferentDay && bestDifferentDay.match.matchScore >= 0.6) {
        console.log(`[ArkikOrderMatcher] ✅ Best different-day match: ${bestDifferentDay.match.order.order_number} (score: ${(bestDifferentDay.match.matchScore * 100).toFixed(1)}%)`);
        return bestDifferentDay.match;
      } else {
        console.log(`[ArkikOrderMatcher] ❌ Different-day candidates below threshold (best: ${bestDifferentDay?.match.matchScore ? (bestDifferentDay.match.matchScore * 100).toFixed(1) : 'N/A'}%)`);
      }
    }

    console.log(`[ArkikOrderMatcher] ❌ No suitable match found (all candidates below threshold)`);
    return null;
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

    // Pre-calculate values used in multiple places
    const orderItems = (order as any).order_items || [];
    const orderYmd = this.extractYmdString((order as any).delivery_date);
    const remisionYmd = this.extractYmdString(firstRemision.fecha as any);
    const hasExactDateMatch = orderYmd === remisionYmd;
    
    // Calculate recipe match percentage (used for both recipe scoring and construction site relaxation)
    let recipeMatchScore = 0;
    for (const remision of remisiones) {
      if (hasStrictRecipeMatch(orderItems as any, remision)) {
        recipeMatchScore += 1;
      }
    }
    const recipeMatchPercentage = remisiones.length > 0 ? recipeMatchScore / remisiones.length : 0;
    const hasStrongRecipeMatch = recipeMatchPercentage >= 0.8;

    // Construction site matching (relaxed - give points even if names differ if client/date/recipe match)
    const siteSimilarity = this.calculateSiteSimilarity(
      firstRemision.obra_name || '',
      order.construction_site || ''
    );
    
    // Check if we have strong matches on critical criteria (client, date, recipe)
    const hasExactClientMatch = order.client_id === firstRemision.client_id;
    
    // If critical criteria match (client, date, recipe), be more lenient with construction site
    const hasStrongCriticalMatches = hasExactClientMatch && hasExactDateMatch && hasStrongRecipeMatch;
    
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
    } else if (hasStrongCriticalMatches) {
      // Relaxed: If client, date, and recipe match strongly, give points even if construction site name differs
      score += 1;
      matchReasons.push('Obra diferente (cliente/fecha/receta coinciden)');
    }

    // Date proximity (string-based equality preferred, no TZ conversion)
    if (hasExactDateMatch) {
      score += 3; // Strongly prefer exact same day
      matchReasons.push('Fecha exacta');
    } else {
      // Only calculate day difference if strings don't match exactly
      const orderDate = this.parseLocalDate((order as any).delivery_date);
      const remisionDate = this.parseLocalDate(firstRemision.fecha as any);
      const daysDiff = Math.abs((orderDate.getTime() - remisionDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 1) {
        score += 1.2;
        matchReasons.push('Fecha próxima');
      } else if (daysDiff <= 2) {
        score += 0.8;
        matchReasons.push('Fecha cercana');
      }
    }

    // Recipe/Product match (check order items with strict matching)
    let recipeMatchReason = '';
    
    if (recipeMatchPercentage === 1.0) {
      score += 3; // Perfect recipe match
      recipeMatchReason = 'Receta exacta (100%)';
    } else if (recipeMatchPercentage >= 0.8) {
      score += 2.5; // Very good recipe match
      recipeMatchReason = `Receta muy compatible (${(recipeMatchPercentage * 100).toFixed(0)}%)`;
    } else if (recipeMatchPercentage >= 0.6) {
      score += 2; // Good recipe match
      recipeMatchReason = `Receta compatible (${(recipeMatchPercentage * 100).toFixed(0)}%)`;
    } else if (recipeMatchPercentage > 0) {
      score += 1; // Partial recipe match
      recipeMatchReason = `Receta parcialmente compatible (${(recipeMatchPercentage * 100).toFixed(0)}%)`;
    } else {
      recipeMatchReason = 'Receta no compatible';
    }
    
    if (recipeMatchScore > 0) {
      matchReasons.push(recipeMatchReason);
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
      // daysDiff logged as 0.0 for exact date to reflect strict preference
      daysDiff: (orderYmd === remisionYmd ? 0 : Math.abs((this.parseLocalDate((order as any).delivery_date).getTime() - this.parseLocalDate(firstRemision.fecha as any).getTime()) / (1000 * 60 * 60 * 24))).toFixed(1),
      recipeMatchPercentage: (recipeMatchPercentage * 100).toFixed(1) + '%',
      recipeMatchReason,
      totalScore: score.toFixed(2),
      finalScore: (score / maxScore).toFixed(3),
      matchReasons,
      // Debug: Show recipe details for troubleshooting
      remisionRecipes: remisiones.map(r => ({
        remision_number: r.remision_number,
        recipe_id: r.recipe_id,
        product_description: r.product_description,
        recipe_code: r.recipe_code,
        normalized_arkik: this.normalizeRecipeCode(r.product_description || r.recipe_code || '')
      })),
      orderItemRecipes: orderItems.map((item: any) => ({
        recipe_id: item.recipe_id,
        product_type: item.product_type,
        arkik_long_code: item.recipes?.arkik_long_code,
        recipe_code: item.recipes?.recipe_code,
        normalized_arkik: this.normalizeRecipeCode(item.recipes?.arkik_long_code || item.recipes?.recipe_code || item.product_type || '')
      }))
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
   * Normalize string for comparison
   * For recipe codes: use standardized normalization
   * For client/site names: use simplified normalization
   */
  private normalizeString(str: string): string {
    return str
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  }
  
  /**
   * Normalize recipe code using standardized function
   */
  private normalizeRecipeCode(str: string): string {
    return normalizeRecipeCode(str);
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
   * OPTIMIZED: Uses bulk mode to prevent trigger storms during batch processing
   */
  async updateOrderWithRemisiones(
    orderId: string,
    remisiones: StagingRemision[],
    useBulkMode: boolean = false
  ): Promise<{
    success: boolean;
    updatedOrderItems?: OrderItem[];
    materialsCreated?: number;
    error?: string;
  }> {
    try {
      console.log(`[ArkikOrderMatcher] Adding ${remisiones.length} remisiones to existing order ${orderId} (bulk mode: ${useBulkMode})`);
      
      // Filter out excluded remisiones (materials-only duplicates, etc.)
      const remisionesToProcess = remisiones.filter(remision => {
        if (remision.is_excluded_from_import) {
          console.log(`[ArkikOrderMatcher] Skipping excluded remision ${remision.remision_number}`);
          return false;
        }
        if (remision.duplicate_strategy === 'materials_only') {
          console.log(`[ArkikOrderMatcher] Skipping materials-only duplicate ${remision.remision_number}`);
          return false;
        }
        return true;
      });

      if (remisionesToProcess.length === 0) {
        console.log(`[ArkikOrderMatcher] All remisiones were filtered out - nothing to process`);
        return { success: true, materialsCreated: 0 };
      }

      console.log(`[ArkikOrderMatcher] Processing ${remisionesToProcess.length} remisiones (${remisiones.length - remisionesToProcess.length} filtered out)`);
      
      // Fetch order items to enforce strict gate before inserting
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .select(`*, quote_details:quote_detail_id ( id, recipe_id )`)
        .eq('order_id', orderId);

      if (orderItemsError) {
        throw orderItemsError;
      }

      // Enforce strict recipe match for all remisiones with recipe_id
      const blocked = remisionesToProcess.filter(r => r.recipe_id && !hasStrictRecipeMatch(orderItems as any, r));
      if (blocked.length > 0) {
        const nums = blocked.map(b => b.remision_number).join(', ');
        return {
          success: false,
          error: `No hay items compatibles por receta para remisiones: ${nums}`
        };
      }

      // OPTIMIZATION: Enable bulk mode to skip triggers during batch insert
      if (useBulkMode) {
        console.log('[ArkikOrderMatcher] Enabling bulk mode to prevent trigger storms');
        await supabase.rpc('set_arkik_bulk_mode', { enabled: true });
      }
      
      try {
        // Step 1: Check which remisiones already exist (batch query to prevent duplicates)
        const remisionNumbers = remisionesToProcess.map(r => r.remision_number);
        const { data: existingRemisiones } = await supabase
          .from('remisiones')
          .select('id, remision_number')
          .in('remision_number', remisionNumbers);

        const existingRemisionNumbers = new Set(
          existingRemisiones?.map(r => r.remision_number) || []
        );

        // Only insert new remisiones
        const newRemisiones = remisionesToProcess.filter(
          r => !existingRemisionNumbers.has(r.remision_number)
        );

        if (existingRemisionNumbers.size > 0) {
          console.log(`[ArkikOrderMatcher] ${existingRemisionNumbers.size} remisiones already exist, ${newRemisiones.length} will be inserted`);
        }

        if (newRemisiones.length === 0) {
          console.log(`[ArkikOrderMatcher] All remisiones already exist - skipping insertion`);
          return {
            success: true,
            materialsCreated: 0
          };
        }

        // Step 2: Insert remisiones into the database using the same field mapping as dedicated mode
        const remisionesToInsert = newRemisiones.map(remision => {
          // Format hora_carga properly
          let horaCarga: string;
          if (remision.hora_carga instanceof Date) {
            horaCarga = remision.hora_carga.toTimeString().split(' ')[0]; // Extract HH:MM:SS
          } else if (typeof remision.hora_carga === 'string') {
            horaCarga = remision.hora_carga;
          } else {
            horaCarga = '08:00:00';
          }

          // Format fecha properly using local date components to avoid timezone issues
          let fecha: string;
          if (remision.fecha instanceof Date) {
            const year = remision.fecha.getFullYear();
            const month = String(remision.fecha.getMonth() + 1).padStart(2, '0');
            const day = String(remision.fecha.getDate()).padStart(2, '0');
            fecha = `${year}-${month}-${day}`;
          } else if (typeof remision.fecha === 'string') {
            fecha = remision.fecha;
          } else {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            fecha = `${year}-${month}-${day}`;
          }

          return {
            order_id: orderId, // Link to the existing order
            remision_number: remision.remision_number,
            fecha: fecha,
            hora_carga: horaCarga,
            volumen_fabricado: remision.volumen_fabricado,
            conductor: remision.conductor || undefined,
            unidad: remision.placas || undefined, // Map placas from Excel to unidad field (same as dedicated mode)
            tipo_remision: 'CONCRETO',
            recipe_id: remision.recipe_id!,
            master_recipe_id: remision.master_recipe_id,
            plant_id: this.plantId
          };
        });

        const { data: insertedRemisiones, error: remisionError } = await supabase
          .from('remisiones')
          .insert(remisionesToInsert)
          .select();

        if (remisionError) {
          throw remisionError;
        }

        console.log(`[ArkikOrderMatcher] Successfully inserted ${insertedRemisiones?.length} remisiones`);

        // Step 3: Batch check which remisiones already have materials (single query, not N queries)
        const remisionIds = insertedRemisiones.map(r => r.id);
        const { data: existingMaterials } = await supabase
          .from('remision_materiales')
          .select('remision_id')
          .in('remision_id', remisionIds);

        const remisionesWithMaterials = new Set(
          existingMaterials?.map(m => m.remision_id) || []
        );

        // Filter out remisiones that already have materials
        const remisionesNeedingMaterials = insertedRemisiones.filter(
          r => !remisionesWithMaterials.has(r.id)
        );

        console.log(`[ArkikOrderMatcher] ${remisionesWithMaterials.size} remisiones already have materials, ${remisionesNeedingMaterials.length} need materials`);

        // Step 4: Create materials for each remision that needs them (read from staging maps)
        let materialsCreated = 0;
        if (remisionesNeedingMaterials.length > 0) {
          console.log(`[ArkikOrderMatcher] Creating materials for ${remisionesNeedingMaterials.length} remisiones`);
          
          const allRemisionMaterials: any[] = [];
          
          // Prepare materials data for batch insertion
          for (const createdRemision of remisionesNeedingMaterials) {
            const stagingRemision = remisionesToProcess.find(r => r.remision_number === createdRemision.remision_number);
            
            if (stagingRemision && stagingRemision.materials_teorico) {
              const teoricos = stagingRemision.materials_teorico as Record<string, number>;
              const reales = (stagingRemision.materials_real || {}) as Record<string, number>;
              const retrabajo = (stagingRemision.materials_retrabajo || {}) as Record<string, number>;
              const manual = (stagingRemision.materials_manual || {}) as Record<string, number>;

              const materialCodes = new Set<string>([
                ...Object.keys(teoricos),
                ...Object.keys(reales),
                ...Object.keys(retrabajo),
                ...Object.keys(manual)
              ]);
              if (materialCodes.size > 0) {
                materialCodes.forEach(code => {
                  const cantidad_teorica = Number(teoricos[code] || 0);
                  const baseReal = Number(reales[code] || 0);
                  const retrabajoVal = Number(retrabajo[code] || 0);
                  const manualVal = Number(manual[code] || 0);
                  const ajuste = retrabajoVal + manualVal; // retrabajo + manual
                  const cantidad_real = baseReal + retrabajoVal + manualVal; // final real
                  // Only insert if at least one value is non-zero
                  if (cantidad_teorica > 0 || cantidad_real > 0 || ajuste !== 0) {
                    allRemisionMaterials.push({
                      remision_id: createdRemision.id,
                      material_type: code,
                      cantidad_teorica,
                      cantidad_real,
                      ajuste
                    });
                  }
                });
              }
            }
          }
          
          // Insert materials in batch if any exist
          if (allRemisionMaterials.length > 0) {
            const { error: materialsError } = await supabase
              .from('remision_materiales')
              .insert(allRemisionMaterials);
              
            if (materialsError) {
              console.error(`[ArkikOrderMatcher] Error creating materials:`, materialsError);
              // Don't fail the entire operation if materials creation fails
            } else {
              console.log(`[ArkikOrderMatcher] Successfully created ${allRemisionMaterials.length} material records`);
              materialsCreated += allRemisionMaterials.length;
            }
          } else {
            console.log(`[ArkikOrderMatcher] No materials to create for these remisiones`);
          }
        }

        // OPTIMIZATION: Skip individual recalculation when in bulk mode
        // The caller will batch recalculate all affected orders at the end
        if (!useBulkMode) {
          // Step 3: Trigger automatic order recalculation (only if not in bulk mode)
          try {
            const { recalculateOrderAmount } = await import('./orderService');
            const recalcResult = await recalculateOrderAmount(orderId);
            console.log(`[ArkikOrderMatcher] Successfully recalculated order ${orderId}:`, recalcResult.message);
          } catch (recalcError) {
            console.warn(`[ArkikOrderMatcher] Warning: Could not trigger automatic recalculation:`, recalcError);
            // Don't fail the entire operation if recalculation fails
          }
        } else {
          console.log(`[ArkikOrderMatcher] Skipping individual recalculation (bulk mode enabled - will batch recalculate at end)`);
        }

        // Step 4: Get the updated order items (optional, for return value)
        const { data: updatedOrderItems, error: fetchError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderId);

        if (fetchError) {
          console.warn(`[ArkikOrderMatcher] Warning: Could not fetch updated order items:`, fetchError);
        }

        return {
          success: true,
          updatedOrderItems: updatedOrderItems || [],
          materialsCreated
        };

      } finally {
        // CRITICAL: Always disable bulk mode in finally block to ensure cleanup
        if (useBulkMode) {
          console.log('[ArkikOrderMatcher] Disabling bulk mode');
          await supabase.rpc('set_arkik_bulk_mode', { enabled: false });
        }
      }

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
      .filter((price): price is number => {
        if (price == null) return false;
        if (price > 0) return true;
        const remision = remisiones.find(r => r.unit_price === price);
        return !!remision?.quote_detail_id;
      });

    if (validPrices.length === 0) return 0;

    return validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
  }
}
