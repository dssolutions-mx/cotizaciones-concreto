import { StagingRemision, OrderSuggestion, ValidationError } from '@/types/arkik';
import { ExistingOrderMatch } from './arkikOrderMatcher';
import { hasStrictRecipeMatch } from './arkikMatchingUtils';

export interface OrderGroupingOptions {
  processingMode: 'dedicated' | 'commercial' | 'hybrid';
  existingOrderMatches?: ExistingOrderMatch[];
  manualAssignments?: Map<string, string>; // remision_number -> order_id
}

export class ArkikOrderGrouper {
  groupRemisiones(
    remisiones: StagingRemision[], 
    options: OrderGroupingOptions = { processingMode: 'dedicated' }
  ): OrderSuggestion[] {
    // Filter out excluded remisiones before grouping (defensive check)
    const filteredRemisiones = remisiones.filter(remision => {
      if (remision.is_excluded_from_import) {
        console.log(`[ArkikOrderGrouper] Excluding remision ${remision.remision_number} from grouping (is_excluded_from_import)`);
        return false;
      }
      if (remision.duplicate_strategy === 'materials_only') {
        console.log(`[ArkikOrderGrouper] Excluding remision ${remision.remision_number} from grouping (materials_only duplicate)`);
        return false;
      }
      return true;
    });

    if (filteredRemisiones.length !== remisiones.length) {
      console.log(`[ArkikOrderGrouper] Filtered ${remisiones.length - filteredRemisiones.length} excluded remisiones before grouping`);
    }

    if (options.processingMode === 'commercial' || options.processingMode === 'hybrid') {
      return this.groupWithExistingOrders(
        filteredRemisiones, 
        options.existingOrderMatches || [], 
        options.manualAssignments
      );
    }
    
    return this.groupForNewOrders(filteredRemisiones);
  }

  private groupForNewOrders(remisiones: StagingRemision[]): OrderSuggestion[] {
    // Additional defensive filtering (should already be filtered, but double-check)
    const validRemisiones = remisiones.filter(r => 
      !r.is_excluded_from_import && r.duplicate_strategy !== 'materials_only'
    );
    
    const groups = new Map<string, StagingRemision[]>();
    const withOrder = validRemisiones.filter(r => r.orden_original);
    const withoutOrder = validRemisiones.filter(r => !r.orden_original);

    withOrder.forEach(remision => {
      const key = remision.orden_original!;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(remision);
    });

    withoutOrder.forEach(remision => {
      const key = this.generateGroupKey(remision);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(remision);
    });

    return Array.from(groups.entries()).map(([key, list]) => this.createOrderSuggestion(key, list));
  }

  /**
   * Group remisiones with existing order matches and manual assignments for commercial mode
   */
  private groupWithExistingOrders(
    remisiones: StagingRemision[], 
    existingMatches: ExistingOrderMatch[],
    manualAssignments?: Map<string, string>
  ): OrderSuggestion[] {
    const suggestions: OrderSuggestion[] = [];
    const processedRemisionIds = new Set<string>();

    // Process existing order matches first, but only keep remisiones that strictly match recipes
    // Also filter out excluded remisiones as defensive check
    existingMatches.forEach(match => {
      const items = (match.order as any).order_items as any[] | undefined;
      const strictlyCompatibleRemisiones = match.matchedRemisiones.filter(r => 
        !r.is_excluded_from_import && 
        r.duplicate_strategy !== 'materials_only' &&
        (!r.recipe_id || hasStrictRecipeMatch(items as any, r))
      );
      if (strictlyCompatibleRemisiones.length > 0) {
        const filteredMatch = { ...match, matchedRemisiones: strictlyCompatibleRemisiones } as any;
        const suggestion = this.createOrderSuggestionFromExistingOrder(filteredMatch);
        suggestions.push(suggestion);
        strictlyCompatibleRemisiones.forEach(remision => {
          processedRemisionIds.add(remision.id);
        });
      }
    });

    // Process manual assignments (also filter excluded remisiones)
    if (manualAssignments) {
      const manuallyAssignedRemisiones = remisiones.filter(r => 
        !r.is_excluded_from_import &&
        r.duplicate_strategy !== 'materials_only' &&
        !processedRemisionIds.has(r.id) && 
        manualAssignments.has(r.remision_number)
      );

      // Group manually assigned remisiones by target order ID
      const manualGroups = new Map<string, StagingRemision[]>();
      manuallyAssignedRemisiones.forEach(remision => {
        const orderId = manualAssignments.get(remision.remision_number)!;
        if (!manualGroups.has(orderId)) {
          manualGroups.set(orderId, []);
        }
        manualGroups.get(orderId)!.push(remision);
        processedRemisionIds.add(remision.id);
      });

      // Create suggestions for manual assignments (kept; strict gating occurs in the service)
      manualGroups.forEach((assignedRemisiones, orderId) => {
        const suggestion = this.createOrderSuggestionFromManualAssignment(assignedRemisiones, orderId);
        suggestions.push(suggestion);
      });
    }

    // Process remaining unmatched remisiones as new orders (filter excluded ones)
    const unmatchedRemisiones = remisiones.filter(r => 
      !r.is_excluded_from_import &&
      r.duplicate_strategy !== 'materials_only' &&
      !processedRemisionIds.has(r.id)
    );
    if (unmatchedRemisiones.length > 0) {
      const newOrderSuggestions = this.groupForNewOrders(unmatchedRemisiones);
      suggestions.push(...newOrderSuggestions);
    }

    return suggestions;
  }

  /**
   * Create order suggestion from manual assignment to existing order
   */
  private createOrderSuggestionFromManualAssignment(
    remisiones: StagingRemision[],
    orderId: string
  ): OrderSuggestion {
    remisiones.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const firstRemision = remisiones[0];

    return {
      id: `manual-${orderId}-${Date.now()}`,
      client_id: firstRemision.client_id!,
      construction_site_id: firstRemision.construction_site_id!,
      construction_site: firstRemision.obra_name || '',
      delivery_date: firstRemision.fecha.toISOString().split('T')[0],
      delivery_time: firstRemision.hora_carga.toTimeString().split(' ')[0],
      quote_id: firstRemision.quote_id,
      quote_detail_id: firstRemision.quote_detail_id,
      remisiones: remisiones,
      cliente_name: firstRemision.cliente_name || '',
      total_volume: remisiones.reduce((sum, r) => sum + r.volumen_fabricado, 0),
      total_amount: remisiones.reduce((sum, r) => sum + (r.unit_price * r.volumen_fabricado), 0),
      prod_comercial: firstRemision.prod_comercial,
      prod_tecnico: firstRemision.prod_tecnico,
      elementos: firstRemision.elementos,
      bombeable: firstRemision.bombeable,
      
      // Manual assignment specific fields
      existing_order_id: orderId,
      is_existing_order: true,
      match_score: 1.0, // Manual assignment gets perfect score
      match_reasons: ['Asignación manual']
    };
  }

  /**
   * Create order suggestion from an existing order match
   */
  private createOrderSuggestionFromExistingOrder(match: ExistingOrderMatch): OrderSuggestion {
    const remisiones = match.matchedRemisiones;
    remisiones.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    
    const comentarios = new Set<string>();
    const recipeCodes = new Set<string>();
    const validationIssues: ValidationError[] = [];

    remisiones.forEach(r => {
      if (r.comentarios_externos) comentarios.add(r.comentarios_externos);
      if (r.recipe_code) recipeCodes.add(r.recipe_code);
      validationIssues.push(...r.validation_errors);
    });

    return {
      group_key: `existing_order_${match.order.id}`,
      client_id: match.order.client_id,
      construction_site_id: match.order.construction_site_id,
      obra_name: match.order.construction_site,
      comentarios_externos: Array.from(comentarios),
      date_range: { 
        start: remisiones[0].fecha, 
        end: remisiones[remisiones.length - 1].fecha 
      },
      remisiones,
      total_volume: remisiones.reduce((sum, r) => sum + r.volumen_fabricado, 0),
      suggested_name: `${match.order.order_number} - Remisiones Arkik`,
      recipe_codes: recipeCodes,
      validation_issues: validationIssues,
      // Additional fields for existing order handling
      existing_order_id: match.order.id,
      existing_order_number: match.order.order_number,
      match_score: match.matchScore,
      match_reasons: match.matchReasons,
      is_existing_order: true
    };
  }

  private generateGroupKey(remision: StagingRemision): string {
    const client = (remision.cliente_name || '').replace(/\s+/g, '_').toUpperCase();
    const site = (remision.obra_name || '').replace(/\s+/g, '_').toUpperCase();
    const date = remision.fecha.toISOString().split('T')[0];
    const comentario = this.extractMainElement(remision.comentarios_externos || '');
    return `${client}_${site}_${date}_${comentario}`;
  }

  private extractMainElement(comentarios: string): string {
    if (!comentarios) return 'GENERAL';
    const parts = comentarios.split(',');
    const mainPart = parts[0].trim().toUpperCase();
    return mainPart.replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') || 'GENERAL';
  }

  private createOrderSuggestion(groupKey: string, remisiones: StagingRemision[]): OrderSuggestion {
    remisiones.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const comentarios = new Set<string>();
    const recipeCodes = new Set<string>();
    const validationIssues: ValidationError[] = [];

    remisiones.forEach(r => {
      if (r.comentarios_externos) comentarios.add(r.comentarios_externos);
      if (r.recipe_code) recipeCodes.add(r.recipe_code);
      validationIssues.push(...r.validation_errors);
    });

    const suggestedName = this.generateOrderName(remisiones[0], comentarios);
    return {
      group_key: groupKey,
      client_id: remisiones[0].client_id || '',
      construction_site_id: remisiones[0].construction_site_id,
      obra_name: remisiones[0].obra_name,
      comentarios_externos: Array.from(comentarios),
      date_range: { start: remisiones[0].fecha, end: remisiones[remisiones.length - 1].fecha },
      remisiones,
      total_volume: remisiones.reduce((sum, r) => sum + r.volumen_fabricado, 0),
      suggested_name: suggestedName,
      recipe_codes: recipeCodes,
      validation_issues: validationIssues
    };
  }

  private generateOrderName(firstRemision: StagingRemision, comentarios: Set<string>): string {
    const date = firstRemision.fecha.toISOString().split('T')[0];
    const obra = firstRemision.obra_name;
    if (comentarios.size === 1) {
      const element = Array.from(comentarios)[0].split(',')[0].trim();
      return `${obra} - ${element} - ${date}`;
    }
    return `${obra} - ${comentarios.size} elementos - ${date}`;
  }
}


