import { supabase } from '@/lib/supabase';
import { handleError } from '@/utils/errorHandler';
import type {
  EnsayosData,
  MuestrasData,
  MuestreosData,
  RemisionesData,
  RecipeVersionsData,
  RemisionMaterialesData
} from '@/types/quality';

// Data fetching functions
export async function fetchClientsWithQualityData(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    const fromDate = fechaDesde ? (typeof fechaDesde === 'string' ? fechaDesde : fechaDesde.toISOString().split('T')[0]) : undefined;
    const toDate = fechaHasta ? (typeof fechaHasta === 'string' ? fechaHasta : fechaHasta.toISOString().split('T')[0]) : undefined;

    let query = supabase
      .from('clients')
      .select(`
        id,
        business_name,
        client_code,
        orders!inner (
          id,
          construction_site,
          remisiones!inner (
            id,
            muestreos!inner (
              id,
              fecha_muestreo,
              muestras!inner (
                id,
                ensayos!inner (
                  id,
                  resistencia_calculada
                )
              )
            )
          )
        )
      `)
      .not('orders.remisiones.muestreos.muestras.ensayos.resistencia_calculada', 'is', null)
      .gt('orders.remisiones.muestreos.muestras.ensayos.resistencia_calculada', 0);

    if (fromDate) {
      query = query.gte('orders.remisiones.muestreos.fecha_muestreo', fromDate);
    }
    if (toDate) {
      query = query.lte('orders.remisiones.muestreos.fecha_muestreo', toDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error in fetchClientsWithQualityData:', error);
      throw error;
    }

    return data;
  } catch (error) {
    handleError(error, 'fetchClientsWithQualityData');
    throw error;
  }
}

export async function fetchConstructionSitesWithQualityData(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    const fromDate = fechaDesde ? (typeof fechaDesde === 'string' ? fechaDesde : fechaDesde.toISOString().split('T')[0]) : undefined;
    const toDate = fechaHasta ? (typeof fechaHasta === 'string' ? fechaHasta : fechaHasta.toISOString().split('T')[0]) : undefined;

    let query = supabase
      .from('orders')
      .select(`
        id,
        construction_site,
        client_id,
        clients (
          id,
          business_name,
          client_code
        ),
        remisiones!inner (
          id,
          muestreos!inner (
            id,
            fecha_muestreo,
            muestras!inner (
              id,
              ensayos!inner (
                id,
                resistencia_calculada
              )
            )
          )
        )
      `)
      .not('remisiones.muestreos.muestras.ensayos.resistencia_calculada', 'is', null)
      .gt('remisiones.muestreos.muestras.ensayos.resistencia_calculada', 0)
      .not('order_status', 'eq', 'cancelled');

    if (fromDate) {
      query = query.gte('remisiones.muestreos.fecha_muestreo', fromDate);
    }
    if (toDate) {
      query = query.lte('remisiones.muestreos.fecha_muestreo', toDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error in fetchConstructionSitesWithQualityData:', error);
      throw error;
    }

    return data;
  } catch (error) {
    handleError(error, 'fetchConstructionSitesWithQualityData');
    throw error;
  }
}

export async function fetchRecipesWithQualityData(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    const fromDate = fechaDesde ? (typeof fechaDesde === 'string' ? fechaDesde : fechaDesde.toISOString().split('T')[0]) : undefined;
    const toDate = fechaHasta ? (typeof fechaHasta === 'string' ? fechaHasta : fechaHasta.toISOString().split('T')[0]) : undefined;

    let query = supabase
      .from('recipes')
      .select(`
        id,
        recipe_code,
        strength_fc,
        age_days,
        age_hours,
        remisiones!inner (
          id,
          muestreos!inner (
            id,
            fecha_muestreo,
            muestras!inner (
              id,
              ensayos!inner (
                id,
                resistencia_calculada
              )
            )
          )
        )
      `)
      .not('remisiones.muestreos.muestras.ensayos.resistencia_calculada', 'is', null)
      .gt('remisiones.muestreos.muestras.ensayos.resistencia_calculada', 0);

    if (fromDate) {
      query = query.gte('remisiones.muestreos.fecha_muestreo', fromDate);
    }
    if (toDate) {
      query = query.lte('remisiones.muestreos.fecha_muestreo', toDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error in fetchRecipesWithQualityData:', error);
      throw error;
    }

    return data;
  } catch (error) {
    handleError(error, 'fetchRecipesWithQualityData');
    throw error;
  }
}

// Fetch raw data relevant for quality metrics calculation based on SAMPLING date range
export async function fetchRawQualityData(fromDate: string, toDate: string): Promise<{
  ensayos: EnsayosData[],
  muestras: MuestrasData[],
  muestreos: MuestreosData[],
  remisiones: RemisionesData[],
  recipeVersions: RecipeVersionsData[],
  remisionMateriales: RemisionMaterialesData[]
}> {
  console.log(`[qualityDataService] Fetching raw data for sampling date range: ${fromDate} to ${toDate}`);

  try {
    // 1. Fetch Muestreos within the date range
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select('*')
      .gte('fecha_muestreo', fromDate)
      .lte('fecha_muestreo', toDate);

    if (muestreosError) throw new Error(`Error fetching muestreos: ${muestreosError.message}`);
    if (!muestreosData || muestreosData.length === 0) {
        console.warn('[qualityDataService] No muestreos found for the date range.');
        return { ensayos: [], muestras: [], muestreos: [], remisiones: [], recipeVersions: [], remisionMateriales: [] };
    }
    console.log(`[qualityDataService] Fetched ${muestreosData.length} muestreos.`);

    const muestreoIds = muestreosData.map(m => m.id);
    const remisionIds = muestreosData.map(m => m.remision_id).filter(Boolean); // Filter nulls/undefined

    // 2. Fetch Muestras related to these Muestreos
    const { data: muestrasData, error: muestrasError } = await supabase
      .from('muestras')
      .select('*')
      .in('muestreo_id', muestreoIds);

    if (muestrasError) throw new Error(`Error fetching muestras: ${muestrasError.message}`);
    console.log(`[qualityDataService] Fetched ${muestrasData?.length || 0} muestras.`);

    const muestraIds = muestrasData?.map(m => m.id) || [];

    // 3. Fetch Ensayos related to these Muestras
    console.log(`[qualityDataService] Fetching ensayos for muestraIds:`, muestraIds);
    const { data: ensayosData, error: ensayosError } = await supabase
      .from('ensayos')
      .select('*')
      .in('muestra_id', muestraIds);

    console.log('[qualityDataService] Raw ensayosData received from Supabase:', ensayosData);
    console.log('[qualityDataService] Ensayo fetch error (if any):', ensayosError);

    if (ensayosError) {
        console.error('[qualityDataService] Supabase error fetching ensayos:', ensayosError);
        throw new Error(`Error fetching ensayos: ${ensayosError.message}`);
    }
    console.log(`[qualityDataService] Fetched ${ensayosData?.length || 0} ensayos.`);

    // 4. Fetch Remisiones related to these Muestreos
    console.log('[qualityDataService] Extracted remisionIds:', remisionIds);
    const { data: remisionesData, error: remisionesError } = await supabase
        .from('remisiones')
        .select('*')
        .in('id', remisionIds);

    console.log('[qualityDataService] Raw remisionesData received from Supabase:', remisionesData);
    console.log('[qualityDataService] Remisiones fetch error (if any):', remisionesError);

    if (remisionesError) throw new Error(`Error fetching remisiones: ${remisionesError.message}`);
    console.log(`[qualityDataService] Fetched ${remisionesData?.length || 0} remisiones.`);

    const recipeIds = remisionesData?.map(r => r.recipe_id).filter(Boolean) || [];

    // 5. Fetch current Recipe Versions related to these Remisiones
    const { data: recipeVersionsData, error: recipeVersionsError } = await supabase
        .from('recipe_versions')
        .select('*')
        .in('recipe_id', recipeIds)
        .eq('is_current', true);

    if (recipeVersionsError) throw new Error(`Error fetching recipe versions: ${recipeVersionsError.message}`);
    console.log(`[qualityDataService] Fetched ${recipeVersionsData?.length || 0} recipe versions.`);

    // 6. Fetch Remision Materiales related to these Remisiones
    const { data: remisionMaterialesData, error: remisionMaterialesError } = await supabase
        .from('remision_materiales')
        .select('*')
        .in('remision_id', remisionIds);

    if (remisionMaterialesError) throw new Error(`Error fetching remision materiales: ${remisionMaterialesError.message}`);
    console.log(`[qualityDataService] Fetched ${remisionMaterialesData?.length || 0} remision materiales.`);

    // Return all fetched data, ensuring proper typing/defaults
    return {
      ensayos: (ensayosData || []) as EnsayosData[],
      muestras: (muestrasData || []) as MuestrasData[],
      muestreos: (muestreosData || []) as MuestreosData[],
      remisiones: (remisionesData || []) as RemisionesData[],
      recipeVersions: (recipeVersionsData || []) as RecipeVersionsData[],
      remisionMateriales: (remisionMaterialesData || []) as RemisionMaterialesData[]
    };

  } catch (error) {
    // Log the error properly
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[qualityDataService] Error in fetchRawQualityData:', message, error);
    // Return empty structure in case of error
    return { 
        ensayos: [], 
        muestras: [], 
        muestreos: [], 
        remisiones: [], 
        recipeVersions: [], 
        remisionMateriales: [] 
    };
  }
}
