import { supabase } from '@/lib/supabase';
import { handleError } from '@/utils/errorHandler';
import {
  Muestreo,
  Muestra,
  Ensayo,
  Evidencia,
  MuestreoWithRelations,
  MuestraWithRelations,
  EnsayoWithRelations,
  FiltrosCalidad,
  MetricasCalidad,
  DatoGraficoResistencia
} from '@/types/quality';
import { format, subMonths } from 'date-fns';

// Utility functions
export async function checkDatabaseContent() {
  try {
    // Check if ensayos table has data
    const { data: ensayosData, error: ensayosError } = await supabase
      .from('ensayos')
      .select('id, fecha_ensayo')
      .limit(1);

    if (ensayosError) {
      console.error('Error checking ensayos:', ensayosError);
    }

    // Get date range from ensayos
    const { data: dateRangeData, error: dateRangeError } = await supabase
      .from('ensayos')
      .select('fecha_ensayo')
      .order('fecha_ensayo', { ascending: false })
      .limit(1);

    const latest = dateRangeData?.[0]?.fecha_ensayo;

    const { data: earliestData, error: earliestError } = await supabase
      .from('ensayos')
      .select('fecha_ensayo')
      .order('fecha_ensayo', { ascending: true })
      .limit(1);

    const earliest = earliestData?.[0]?.fecha_ensayo;

    return {
      hasData: (ensayosData && ensayosData.length > 0) || false,
      dateRange: {
        earliest,
        latest
      }
    };
  } catch (error) {
    console.error('Error checking database content:', error);
    return {
      hasData: false,
      dateRange: {
        earliest: null,
        latest: null
      }
    };
  }
}

export function createUTCDate(dateString: string): Date {
  try {
    // Parse DD/MM/YYYY format
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/').map(Number);
      return new Date(year, month - 1, day);
    }
    // Parse YYYY-MM-DD format
    return new Date(dateString);
  } catch (error) {
    console.error('Error creating UTC date:', error);
    return new Date();
  }
}

export function formatUTCDate(date: Date): string {
  try {
    return format(date, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Error formatting UTC date:', error);
    return new Date().toISOString().split('T')[0];
  }
}

export async function fetchClientsWithQualityData(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    let query = supabase
      .from('ensayos')
      .select(`
        muestra:muestra_id (
          muestreo:muestreo_id (
            remision:remision_id (
              order:order_id (
                client_id,
                clients(business_name)
              )
            )
          )
        )
      `)
      .not('muestra.muestreo.remision.order.client_id', 'is', null);

    // Apply date filters if provided
    if (fechaDesde) {
      const fechaDesdeStr = typeof fechaDesde === 'string' ? fechaDesde : format(fechaDesde, 'yyyy-MM-dd');
      query = query.gte('fecha_ensayo', fechaDesdeStr);
    }
    if (fechaHasta) {
      const fechaHastaStr = typeof fechaHasta === 'string' ? fechaHasta : format(fechaHasta, 'yyyy-MM-dd');
      query = query.lte('fecha_ensayo', fechaHastaStr);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching clients with quality data:', error);
      return [];
    }

    // Extract unique clients
    const clientMap = new Map();
    data?.forEach((item: any) => {
      const client = item.muestra?.muestreo?.remision?.order?.clients;
      const clientId = item.muestra?.muestreo?.remision?.order?.client_id;

      if (client && clientId && !clientMap.has(clientId)) {
        clientMap.set(clientId, {
          id: clientId,
          business_name: client.business_name
        });
      }
    });

    return Array.from(clientMap.values());
  } catch (error) {
    console.error('Error in fetchClientsWithQualityData:', error);
    return [];
  }
}

export async function fetchConstructionSitesWithQualityData(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    let query = supabase
      .from('ensayos')
      .select(`
        muestra:muestra_id (
          muestreo:muestreo_id (
            remision:remision_id (
              order:order_id (
                construction_site,
                client_id
              )
            )
          )
        )
      `)
      .not('muestra.muestreo.remision.order.construction_site', 'is', null);

    // Apply date filters if provided
    if (fechaDesde) {
      const fechaDesdeStr = typeof fechaDesde === 'string' ? fechaDesde : format(fechaDesde, 'yyyy-MM-dd');
      query = query.gte('fecha_ensayo', fechaDesdeStr);
    }
    if (fechaHasta) {
      const fechaHastaStr = typeof fechaHasta === 'string' ? fechaHasta : format(fechaHasta, 'yyyy-MM-dd');
      query = query.lte('fecha_ensayo', fechaHastaStr);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching construction sites with quality data:', error);
      return [];
    }

    // Extract unique construction sites
    const siteMap = new Map();
    data?.forEach((item: any) => {
      const order = item.muestra?.muestreo?.remision?.order;
      if (order?.construction_site && order?.client_id) {
        const key = `${order.client_id}-${order.construction_site}`;
        if (!siteMap.has(key)) {
          siteMap.set(key, {
            id: key,
            name: order.construction_site,
            client_id: order.client_id
          });
        }
      }
    });

    return Array.from(siteMap.values());
  } catch (error) {
    console.error('Error in fetchConstructionSitesWithQualityData:', error);
    return [];
  }
}

export async function fetchRecipesWithQualityData(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    let query = supabase
      .from('ensayos')
      .select(`
        muestra:muestra_id (
          muestreo:muestreo_id (
            remision:remision_id (
              recipe:recipe_id (
                id,
                recipe_code
              )
            )
          )
        )
      `)
      .not('muestra.muestreo.remision.recipe.recipe_code', 'is', null);

    // Apply date filters if provided
    if (fechaDesde) {
      const fechaDesdeStr = typeof fechaDesde === 'string' ? fechaDesde : format(fechaDesde, 'yyyy-MM-dd');
      query = query.gte('fecha_ensayo', fechaDesdeStr);
    }
    if (fechaHasta) {
      const fechaHastaStr = typeof fechaHasta === 'string' ? fechaHasta : format(fechaHasta, 'yyyy-MM-dd');
      query = query.lte('fecha_ensayo', fechaHastaStr);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching recipes with quality data:', error);
      return [];
    }

    // Extract unique recipes
    const recipeMap = new Map();
    data?.forEach((item: any) => {
      const recipe = item.muestra?.muestreo?.remision?.recipe;
      if (recipe?.id && recipe?.recipe_code && !recipeMap.has(recipe.id)) {
        recipeMap.set(recipe.id, {
          id: recipe.id,
          recipe_code: recipe.recipe_code
        });
      }
    });

    return Array.from(recipeMap.values());
  } catch (error) {
    console.error('Error in fetchRecipesWithQualityData:', error);
    return [];
  }
}
