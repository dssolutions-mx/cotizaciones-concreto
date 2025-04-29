'use client';

import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export interface EnsayosData {
  id: string;
  muestra_id: string;
  fecha_ensayo: string; // ISO date string
  resistencia_calculada: number | null;
  porcentaje_cumplimiento: number | null;
  // Add other relevant fields from ensayos if needed
}

export interface MuestrasData {
  id: string;
  muestreo_id: string;
  fecha_programada_ensayo: string; // ISO date string
  estado: string;
  // Add other relevant fields from muestras if needed
}

export interface MuestreosData {
    id: string;
    remision_id: string;
    fecha_muestreo: string; // ISO date string
    masa_unitaria: number | null;
    // Add other relevant fields from muestreos if needed
}

export interface RemisionesData {
    id: string;
    recipe_id: string;
    volumen_fabricado: number | null;
    // Add other relevant fields from remisiones if needed
}

export interface RecipeVersionsData {
    recipe_id: string;
    is_current: boolean;
    notes: string | null;
    age_days: number | null; // Needed to calculate warranty date
    // Add other relevant fields from recipe_versions if needed
}

export interface RemisionMaterialesData {
    remision_id: string;
    material_type: string | null;
    cantidad_real: number | null;
    // Add other relevant fields from remision_materiales if needed
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
  console.log(`[qualityServiceBasic] Fetching raw data for sampling date range: ${fromDate} to ${toDate}`);

  try {
    // 1. Fetch Muestreos within the date range
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select('*')
      .gte('fecha_muestreo', fromDate)
      .lte('fecha_muestreo', toDate);

    if (muestreosError) throw new Error(`Error fetching muestreos: ${muestreosError.message}`);
    if (!muestreosData || muestreosData.length === 0) {
        console.warn('[qualityServiceBasic] No muestreos found for the date range.');
        return { ensayos: [], muestras: [], muestreos: [], remisiones: [], recipeVersions: [], remisionMateriales: [] };
    }
    console.log(`[qualityServiceBasic] Fetched ${muestreosData.length} muestreos.`);

    const muestreoIds = muestreosData.map(m => m.id);
    const remisionIds = muestreosData.map(m => m.remision_id).filter(Boolean); // Filter nulls/undefined

    // 2. Fetch Muestras related to these Muestreos
    const { data: muestrasData, error: muestrasError } = await supabase
      .from('muestras')
      .select('*')
      .in('muestreo_id', muestreoIds);

    if (muestrasError) throw new Error(`Error fetching muestras: ${muestrasError.message}`);
    console.log(`[qualityServiceBasic] Fetched ${muestrasData?.length || 0} muestras.`);

    const muestraIds = muestrasData?.map(m => m.id) || [];

    // 3. Fetch Ensayos related to these Muestras
    console.log(`[qualityServiceBasic] Fetching ensayos for muestraIds:`, muestraIds);
    const { data: ensayosData, error: ensayosError } = await supabase
      .from('ensayos')
      .select('*')
      .in('muestra_id', muestraIds);

    console.log('[qualityServiceBasic] Raw ensayosData received from Supabase:', ensayosData);
    console.log('[qualityServiceBasic] Ensayo fetch error (if any):', ensayosError);

    if (ensayosError) {
        console.error('[qualityServiceBasic] Supabase error fetching ensayos:', ensayosError);
        // Decide if you want to throw or return partial data
        // Throwing error for clarity:
        throw new Error(`Error fetching ensayos: ${ensayosError.message}`);
    }
    console.log(`[qualityServiceBasic] Fetched ${ensayosData?.length || 0} ensayos.`);

    // 4. Fetch Remisiones related to these Muestreos
    console.log('[qualityServiceBasic] Extracted remisionIds:', remisionIds);
    const { data: remisionesData, error: remisionesError } = await supabase
        .from('remisiones')
        .select('*')
        .in('id', remisionIds);

    console.log('[qualityServiceBasic] Raw remisionesData received from Supabase:', remisionesData);
    console.log('[qualityServiceBasic] Remisiones fetch error (if any):', remisionesError);

    if (remisionesError) throw new Error(`Error fetching remisiones: ${remisionesError.message}`);
    console.log(`[qualityServiceBasic] Fetched ${remisionesData?.length || 0} remisiones.`);

    const recipeIds = remisionesData?.map(r => r.recipe_id).filter(Boolean) || [];

    // 5. Fetch current Recipe Versions related to these Remisiones
    const { data: recipeVersionsData, error: recipeVersionsError } = await supabase
        .from('recipe_versions')
        .select('*')
        .in('recipe_id', recipeIds)
        .eq('is_current', true);

    if (recipeVersionsError) throw new Error(`Error fetching recipe versions: ${recipeVersionsError.message}`);
    console.log(`[qualityServiceBasic] Fetched ${recipeVersionsData?.length || 0} recipe versions.`);

    // 6. Fetch Remision Materiales related to these Remisiones
    const { data: remisionMaterialesData, error: remisionMaterialesError } = await supabase
        .from('remision_materiales')
        .select('*')
        .in('remision_id', remisionIds);

    if (remisionMaterialesError) throw new Error(`Error fetching remision materiales: ${remisionMaterialesError.message}`);
    console.log(`[qualityServiceBasic] Fetched ${remisionMaterialesData?.length || 0} remision materiales.`);

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
    console.error('[qualityServiceBasic] Error in fetchRawQualityData:', message, error);
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

// Example of a simple function to just count records in a date range
export async function countEnsayosInDateRange(fromDate: string, toDate: string): Promise<number> {
    console.log(`[qualityServiceBasic] Counting ensayos for date range: ${fromDate} to ${toDate}`);
    try {
        const { count, error } = await supabase
            .from('ensayos')
            .select('*', { count: 'exact', head: true })
            .gte('fecha_ensayo', fromDate) // Filter by ensayo date here
            .lte('fecha_ensayo', toDate);

        if (error) {
            console.error('[qualityServiceBasic] Supabase error counting ensayos:', error);
            throw new Error(`Error counting ensayos: ${error.message}`);
        }
        console.log(`[qualityServiceBasic] Found ${count} ensayos.`);
        return count || 0;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[qualityServiceBasic] Error in countEnsayosInDateRange:', message, error);
        throw error; // Re-throw to be handled by the calling component
    }
}