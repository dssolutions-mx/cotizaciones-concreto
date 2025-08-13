import { StagingRemision, OrderSuggestion, ValidationError } from '@/types/arkik';

export class ArkikOrderGrouper {
  groupRemisiones(remisiones: StagingRemision[]): OrderSuggestion[] {
    const groups = new Map<string, StagingRemision[]>();
    const withOrder = remisiones.filter(r => r.orden_original);
    const withoutOrder = remisiones.filter(r => !r.orden_original);

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


