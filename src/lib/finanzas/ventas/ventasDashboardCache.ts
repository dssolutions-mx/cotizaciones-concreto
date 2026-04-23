/** LocalStorage helpers for Finanzas → Ventas filter persistence */

export const VENTAS_FILTER_CACHE_KEY = 'ventas_dashboard_filters';

export function loadVentasDashboardFilters(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(VENTAS_FILTER_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as Record<string, unknown>;

    if (parsed && typeof parsed.tipoFilter === 'string') {
      if (parsed.tipoFilter === 'all' || !parsed.tipoFilter) {
        parsed.tipoFilter = [];
      } else {
        parsed.tipoFilter = [parsed.tipoFilter];
      }
    }

    if (parsed && !Array.isArray(parsed.tipoFilter)) {
      parsed.tipoFilter = [];
    }

    if (parsed && !Array.isArray(parsed.codigoProductoFilter)) {
      parsed.codigoProductoFilter = [];
    }

    if (parsed && parsed.selectedPlantId && !parsed.selectedPlantIds) {
      parsed.selectedPlantIds = [parsed.selectedPlantId];
      delete parsed.selectedPlantId;
    }

    if (parsed && !Array.isArray(parsed.selectedPlantIds)) {
      parsed.selectedPlantIds = [];
    }

    if (parsed && parsed.clientFilter) {
      if (typeof parsed.clientFilter === 'string') {
        if (parsed.clientFilter === 'all' || !parsed.clientFilter) {
          parsed.clientFilter = [];
        } else {
          parsed.clientFilter = [parsed.clientFilter];
        }
      } else if (!Array.isArray(parsed.clientFilter)) {
        parsed.clientFilter = [];
      }
    } else if (parsed) {
      parsed.clientFilter = [];
    }

    return parsed;
  } catch (e) {
    console.error('Failed to load cached ventas filters:', e);
    return null;
  }
}

export function saveVentasDashboardFilters(filters: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VENTAS_FILTER_CACHE_KEY, JSON.stringify(filters));
  } catch (e) {
    console.error('Failed to save ventas filters:', e);
  }
}

export const SHOW_VENTAS_DEBUG_TOOL =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_SHOW_VENTAS_DEBUG === 'true';

export type DebugPricingViewRow = {
  remision_id: string;
  tipo_remision?: string | null;
  unit_price_resolved?: number | null;
  subtotal_amount?: number | null;
  pricing_method?: string | null;
  order_has_pump_service?: boolean | null;
};
