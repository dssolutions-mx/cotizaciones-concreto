'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfWeek, format, isAfter, startOfDay, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';

// Use similar types as client analysis
export interface RecipeQualityRemisionData {
  id: string;
  remisionNumber: string;
  fecha: string;
  volume: number;
  recipeCode: string;
  recipeFc: number;
  recipeId: string;
  masterRecipeId?: string | null;
  arkikLongCode?: string | null;
  arkikShortCode?: string | null;
  variantSuffix?: string | null;
  constructionSite: string;
  orderId: string;
  complianceStatus: string;
  avgResistencia?: number;
  rendimientoVolumetrico?: number;
  totalMaterialQuantity?: number;
  costPerM3?: number;
  cementKgPerM3?: number;
  materiales: Array<{
    material_id: string;
    cantidad_real: number;
    materials: {
      category: string;
      material_name: string;
      density?: number;
    };
  }>;
  muestreos: Array<{
    id: string;
    fechaMuestreo: string;
    numeroMuestreo: string;
    masaUnitaria: number;
    temperaturaAmbiente: number;
    temperaturaConcreto: number;
    revenimientoSitio: number;
    concrete_specs?: any;
    muestras: Array<{
      id: string;
      tipoMuestra: string;
      identificacion: string;
      fechaProgramadaEnsayo: string;
      ensayos: Array<{
        id: string;
        fechaEnsayo: string;
        cargaKg: number;
        resistenciaCalculada: number;
        porcentajeCumplimiento: number;
        isEdadGarantia: boolean;
        isEnsayoFueraTiempo: boolean;
      }>;
    }>;
  }>;
}

export interface RecipeQualityData {
  remisiones: RecipeQualityRemisionData[];
}

export interface RecipeQualitySummary {
  recipeInfo: {
    recipe_code: string;
    strength_fc: number;
    age_days: number;
    master_recipe_id?: string | null;
    master_code?: string | null;
    arkik_long_code?: string | null;
    arkik_short_code?: string | null;
    variant_suffix?: string | null;
    is_master_analysis?: boolean; // true if analyzing all variants of a master
    variant_count?: number; // number of variants included in analysis
  };
  totals: {
    volume: number;
    remisiones: number;
    remisionesMuestreadas: number;
    muestreos: number;
    ensayos: number;
    ensayosEdadGarantia: number;
    porcentajeCoberturaMuestreo: number;
    porcentajeCoberturaCalidad: number;
  };
  averages: {
    complianceRate: number;
    resistencia: number;
    masaUnitaria: number;
    rendimientoVolumetrico: number;
    costPerM3: number;
    cementSharePct: number;
  };
  performance: {
    qualityTrend: string;
    onTimeTestingRate: number;
  };
  statistics?: {
    mean: number;
    stdDev: number;
    cv: number;
    qualityLevel: string;
    groupStats: Array<any>;
    groupsInTargetWeighted: number;
    processCapability?: {
      cp: number;
      cpk: number;
      sigma: number;
    } | null;
    controlLimits?: {
      ucl: number;
      lcl: number;
      usl: number;
      lsl: number;
      centerLine: number;
    } | null;
  };
  alerts: Array<{
    type: 'error' | 'warning' | 'info';
    metric: string;
    message: string;
  }>;
}

interface Options {
  newestFirst?: boolean;
  granularity?: 'week' | 'month';
}

interface UseProgressiveRecipeQualityArgs {
  recipeId?: string;
  recipeIds?: string[];
  masterRecipeId?: string; // Analyze all variants of this master
  plantId?: string;
  fromDate?: Date;
  toDate?: Date;
  options?: Options;
}

export function useProgressiveRecipeQuality({
  recipeId,
  recipeIds,
  masterRecipeId,
  plantId,
  fromDate,
  toDate,
  options
}: UseProgressiveRecipeQualityArgs) {
  const [data, setData] = useState<RecipeQualityData | null>(null);
  const [summary, setSummary] = useState<RecipeQualitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ aborted: boolean; token: number }>({ aborted: false, token: 0 });

  const newestFirst = options?.newestFirst !== false;
  const granularity = options?.granularity || 'week';

  // Generate time slices similar to client analysis
  const slices = useMemo(() => {
    if (!fromDate || !toDate) return [] as { from: Date; to: Date; label: string }[];
    const start = startOfDay(fromDate);
    const end = startOfDay(toDate);
    const result: { from: Date; to: Date; label: string }[] = [];

    let cursorEnd = end;
    if (granularity === 'week') {
      cursorEnd = endOfWeek(end, { weekStartsOn: 1 });
    } else {
      cursorEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    }

    while (isAfter(cursorEnd, start) || cursorEnd.getTime() === start.getTime()) {
      let sliceStart: Date;
      let sliceEnd: Date;

      if (granularity === 'week') {
        sliceStart = startOfWeek(cursorEnd, { weekStartsOn: 1 });
        sliceEnd = endOfWeek(cursorEnd, { weekStartsOn: 1 });
      } else {
        sliceStart = new Date(cursorEnd.getFullYear(), cursorEnd.getMonth(), 1);
        sliceEnd = new Date(cursorEnd.getFullYear(), cursorEnd.getMonth() + 1, 0);
      }

      const from = sliceStart < start ? start : sliceStart;
      const to = sliceEnd > end ? end : sliceEnd;
      
      const label = granularity === 'week' 
        ? `${format(from, 'dd MMM', { locale: es })} - ${format(to, 'dd MMM yyyy', { locale: es })}`
        : format(from, 'MMM yyyy', { locale: es });

      result.push({ from, to, label });

      if (granularity === 'week') {
        cursorEnd = addDays(sliceStart, -1);
      } else {
        cursorEnd = new Date(sliceStart.getFullYear(), sliceStart.getMonth(), 0);
      }
    }
    return newestFirst ? result : [...result].reverse();
  }, [fromDate, toDate, newestFirst, granularity]);

  useEffect(() => {
    if (!plantId || (!recipeId && (!recipeIds || recipeIds.length === 0) && !masterRecipeId) || !fromDate || !toDate) {
      setData(null);
      setSummary(null);
      setLoading(false);
      setStreaming(false);
      setProgress({ processed: 0, total: 0 });
      setError(null);
      return;
    }

    abortRef.current.aborted = false;
    abortRef.current.token += 1;
    const token = abortRef.current.token;
    setLoading(true);
    setStreaming(true);
    setProgress({ processed: 0, total: slices.length });
    setError(null);

    const load = async () => {
      try {
        let targetRecipeIds: string[] = [];
        let masterRecipeInfo: any = null;

        // If analyzing by master recipe, fetch all its variants
        if (masterRecipeId) {
          const { data: masterData, error: masterErr } = await supabase
            .from('master_recipes')
            .select('*')
            .eq('id', masterRecipeId)
            .single();

          if (masterErr) {
            setError('Error fetching master recipe: ' + masterErr.message);
            setLoading(false);
            setStreaming(false);
            return;
          }

          masterRecipeInfo = masterData;

          // Get all variant recipe IDs for this master
          const { data: variants, error: variantsErr } = await supabase
            .from('recipes')
            .select('id')
            .eq('master_recipe_id', masterRecipeId)
            .eq('plant_id', plantId);

          if (variantsErr) {
            setError('Error fetching recipe variants: ' + variantsErr.message);
            setLoading(false);
            setStreaming(false);
            return;
          }

          targetRecipeIds = (variants || []).map((v: any) => v.id);

          if (targetRecipeIds.length === 0) {
            setError('No variants found for this master recipe.');
            setLoading(false);
            setStreaming(false);
            return;
          }
        } else {
          // Use provided recipe IDs
          targetRecipeIds = recipeId ? [recipeId] : recipeIds || [];
        }

        if (!targetRecipeIds || targetRecipeIds.length === 0) {
          setError('No recipe selected for analysis.');
          setLoading(false);
          setStreaming(false);
          return;
        }

        let accRemisiones: RecipeQualityRemisionData[] = [];
        let recipeInfo: any = null;
        let firstChunk = true;

        for (const slice of slices) {
          if (abortRef.current.aborted || abortRef.current.token !== token) return;

          // Fetch remisiones with full quality data structure (like client analysis)
          const { data: sliceRems, error: remErr } = await supabase
            .from('remisiones')
            .select(`
              id,
              remision_number,
              fecha,
              volumen_fabricado,
              tipo_remision,
              recipe_id,
              plant_id,
              order_id,
              recipes!inner (
                id,
                recipe_code,
                strength_fc,
                age_days,
                age_hours,
                master_recipe_id,
                arkik_long_code,
                arkik_short_code,
                variant_suffix
              ),
              orders!inner (
                id,
                client_id,
                construction_site,
                clients (
                  id,
                  business_name
                )
              ),
              remision_materiales (
                id,
                material_id,
                cantidad_real,
                materials (
                  id,
                  material_name,
                  category,
                  density
                )
              ),
              muestreos (
                id,
                fecha_muestreo,
                numero_muestreo,
                masa_unitaria,
                temperatura_ambiente,
                temperatura_concreto,
                revenimiento_sitio,
                concrete_specs,
                muestras (
                  id,
                  tipo_muestra,
                  identificacion,
                  fecha_programada_ensayo,
                  ensayos (
                    id,
                    fecha_ensayo,
                    carga_kg,
                    resistencia_calculada,
                    porcentaje_cumplimiento,
                    is_edad_garantia,
                    is_ensayo_fuera_tiempo
                  )
                )
              )
            `)
            .eq('plant_id', plantId)
            .in('recipe_id', targetRecipeIds)
            .gte('fecha', format(slice.from, 'yyyy-MM-dd'))
            .lte('fecha', format(slice.to, 'yyyy-MM-dd'))
            .not('volumen_fabricado', 'is', null)
            .order('fecha', { ascending: false });

          if (remErr) {
            console.error('[ProgressiveRecipeQuality] remisiones slice error:', remErr);
            setError(remErr.message || 'Error fetching recipe quality data.');
            continue;
          }

          if (!sliceRems || sliceRems.length === 0) {
            setProgress(prev => ({ ...prev, processed: Math.min(prev.processed + 1, prev.total) }));
            if (firstChunk) {
              setLoading(false);
              firstChunk = false;
            }
            continue;
          }

          // Get recipe info from first remision or master
          if (!recipeInfo && sliceRems.length > 0) {
            const firstRem = sliceRems[0];
            recipeInfo = {
              recipe_code: firstRem.recipes?.recipe_code || '',
              strength_fc: firstRem.recipes?.strength_fc || 0,
              age_days: firstRem.recipes?.age_days || 28,
              master_recipe_id: firstRem.recipes?.master_recipe_id || null,
              arkik_long_code: firstRem.recipes?.arkik_long_code || null,
              arkik_short_code: firstRem.recipes?.arkik_short_code || null,
              variant_suffix: firstRem.recipes?.variant_suffix || null
            };
          }

          // Override with master info if analyzing by master
          if (masterRecipeInfo && !recipeInfo) {
            recipeInfo = {
              recipe_code: masterRecipeInfo.master_code,
              strength_fc: masterRecipeInfo.strength_fc || 0,
              age_days: masterRecipeInfo.age_days || 28,
              master_recipe_id: masterRecipeInfo.id,
              master_code: masterRecipeInfo.master_code,
              is_master_analysis: true,
              variant_count: targetRecipeIds.length
            };
          } else if (masterRecipeInfo && recipeInfo) {
            // Enrich with master info
            recipeInfo.master_code = masterRecipeInfo.master_code;
            recipeInfo.is_master_analysis = true;
            recipeInfo.variant_count = targetRecipeIds.length;
          }

          // Get current material prices for cost calculations
          const materialIds = Array.from(new Set(
            sliceRems.flatMap((r: any) => 
              (r.remision_materiales || []).map((m: any) => m.material_id)
            ).filter(Boolean)
          ));

          const materialPriceMap = new Map<string, number>();
          if (materialIds.length > 0) {
            const { data: prices } = await supabase
              .from('material_prices')
              .select('material_id, price_per_unit, plant_id')
              .in('material_id', materialIds)
              .eq('plant_id', plantId)
              .lte('effective_date', new Date().toISOString())
              .is('end_date', null)
              .order('material_id');

            (prices || []).forEach((p: any) => {
              if (!materialPriceMap.has(p.material_id)) {
                materialPriceMap.set(p.material_id, Number(p.price_per_unit) || 0);
              }
            });
          }

          // Transform remisiones to match client analysis structure
          const transformedRemisiones: RecipeQualityRemisionData[] = sliceRems.map((r: any) => {
            // Calculate costs
            let totalCost = 0;
            let cementCost = 0;
            let totalMaterialQuantity = 0;
            let cementQuantity = 0;

            const materiales = (r.remision_materiales || []).map((m: any) => {
              const price = materialPriceMap.get(m.material_id) || 0;
              const quantity = Number(m.cantidad_real) || 0;
              const cost = quantity * price;
              totalCost += cost;
              totalMaterialQuantity += quantity;

              if (m.materials?.category === 'CEMENTO') {
                cementCost += cost;
                cementQuantity += quantity;
              }

              return {
                material_id: m.material_id,
                cantidad_real: quantity,
                materials: {
                  category: m.materials?.category || '',
                  material_name: m.materials?.material_name || '',
                  density: m.materials?.density
                }
              };
            });

            const volume = Number(r.volumen_fabricado) || 0;
            const costPerM3 = volume > 0 ? totalCost / volume : 0;
            const cementKgPerM3 = volume > 0 ? cementQuantity / volume : 0;
            const cementSharePct = totalCost > 0 ? (cementCost / totalCost) * 100 : 0;

            // Transform muestreos first
            const muestreos = (r.muestreos || []).map((m: any) => ({
              id: String(m.id),
              fechaMuestreo: m.fecha_muestreo,
              numeroMuestreo: m.numero_muestreo || '',
              masaUnitaria: Number(m.masa_unitaria) || 0,
              temperaturaAmbiente: Number(m.temperatura_ambiente) || 0,
              temperaturaConcreto: Number(m.temperatura_concreto) || 0,
              revenimientoSitio: Number(m.revenimiento_sitio) || 0,
              concrete_specs: m.concrete_specs,
              muestras: (m.muestras || []).map((s: any) => ({
                id: String(s.id),
                tipoMuestra: s.tipo_muestra || '',
                identificacion: s.identificacion || '',
                fechaProgramadaEnsayo: s.fecha_programada_ensayo,
                ensayos: (s.ensayos || []).map((e: any) => ({
                  id: String(e.id),
                  fechaEnsayo: e.fecha_ensayo,
                  cargaKg: Number(e.carga_kg) || 0,
                  resistenciaCalculada: Number(e.resistencia_calculada) || 0,
                  porcentajeCumplimiento: Number(e.porcentaje_cumplimiento) || 0,
                  isEdadGarantia: Boolean(e.is_edad_garantia),
                  isEnsayoFueraTiempo: Boolean(e.is_ensayo_fuera_tiempo)
                }))
              }))
            }));

            // Calculate rendimiento volumétrico (using client analysis method)
            let rendimientoVolumetrico: number | undefined;
            if (materiales.length > 0 && volume > 0) {
              const totalMaterialQuantity = materiales.reduce((sum, m) => sum + m.cantidad_real, 0);
              const avgMasaUnitaria = muestreos.length > 0
                ? muestreos.reduce((sum, m) => sum + m.masaUnitaria, 0) / muestreos.length
                : 0;
              
              if (totalMaterialQuantity > 0 && avgMasaUnitaria > 0) {
                rendimientoVolumetrico = ((totalMaterialQuantity / avgMasaUnitaria) / volume) * 100;
              }
            }

            // Calculate average resistance and compliance status
            const validEnsayos = muestreos.flatMap(m => 
              m.muestras.flatMap(s => 
                s.ensayos.filter(e => e.isEdadGarantia && !e.isEnsayoFueraTiempo && e.resistenciaCalculada > 0)
              )
            );

            const avgResistencia = validEnsayos.length > 0 
              ? validEnsayos.reduce((sum, e) => sum + e.resistenciaCalculada, 0) / validEnsayos.length
              : undefined;

            const avgCompliance = validEnsayos.length > 0
              ? validEnsayos.reduce((sum, e) => sum + e.porcentajeCumplimiento, 0) / validEnsayos.length
              : 0;

            const complianceStatus = avgCompliance >= 100 ? 'compliant' : 
                                   avgCompliance >= 95 ? 'pending' : 'non_compliant';

            return {
              id: String(r.id),
              remisionNumber: r.remision_number,
              fecha: r.fecha,
              volume,
              recipeCode: r.recipes?.recipe_code || '',
              recipeFc: r.recipes?.strength_fc || 0,
              recipeId: String(r.recipe_id || r.recipes?.id || ''),
              masterRecipeId: r.recipes?.master_recipe_id || null,
              arkikLongCode: r.recipes?.arkik_long_code || null,
              arkikShortCode: r.recipes?.arkik_short_code || null,
              variantSuffix: r.recipes?.variant_suffix || null,
              constructionSite: r.orders?.construction_site || '',
              orderId: String(r.order_id || r.orders?.id || ''),
              complianceStatus,
              avgResistencia,
              rendimientoVolumetrico,
              totalMaterialQuantity,
              costPerM3,
              cementKgPerM3,
              materiales,
              muestreos
            };
          });

          accRemisiones = [...accRemisiones, ...transformedRemisiones];

          // Update state progressively
          if (abortRef.current.aborted || abortRef.current.token !== token) return;
          
          const currentData: RecipeQualityData = {
            remisiones: accRemisiones
          };

          const currentSummary = calculateSummary(currentData, recipeInfo);
          
          // Debug: Log the data being set
          console.log('useProgressiveRecipeQuality - currentData:', currentData);
          console.log('useProgressiveRecipeQuality - remisiones count:', accRemisiones.length);
          console.log('useProgressiveRecipeQuality - currentSummary:', currentSummary);
          
          setData(currentData);
          setSummary(currentSummary);

          if (firstChunk) {
            setLoading(false);
            firstChunk = false;
          }
          setProgress(prev => ({ ...prev, processed: Math.min(prev.processed + 1, prev.total) }));
        }

      } catch (e: any) {
        if (!abortRef.current.aborted && abortRef.current.token === token) {
          setError(e?.message || 'Error al cargar análisis de receta');
        }
      } finally {
        if (!abortRef.current.aborted && abortRef.current.token === token) {
          setLoading(false);
          setStreaming(false);
        }
      }
    };

    load();
    return () => { abortRef.current.aborted = true; };
  }, [plantId, recipeId, recipeIds, masterRecipeId, fromDate, toDate, slices, granularity]);

  return { data, summary, loading, streaming, progress, error };
}

// Calculate summary statistics (similar to client analysis)
function calculateSummary(data: RecipeQualityData, recipeInfo: any): RecipeQualitySummary {
  const remisiones = data.remisiones;
  
  // Totals
  const totalVolume = remisiones.reduce((sum, r) => sum + r.volume, 0);
  const totalRemisiones = remisiones.length;
  const remisionesMuestreadas = remisiones.filter(r => r.muestreos.length > 0).length;
  const totalMuestreos = remisiones.reduce((sum, r) => sum + r.muestreos.length, 0);
  
  const allEnsayos = remisiones.flatMap(r => 
    r.muestreos.flatMap(m => 
      m.muestras.flatMap(s => s.ensayos)
    )
  );
  
  const ensayosEdadGarantia = allEnsayos.filter(e => 
    e.isEdadGarantia && !e.isEnsayoFueraTiempo && e.resistenciaCalculada > 0
  );

  const remisionesConDatosCalidad = remisiones.filter(r => 
    r.muestreos.some(m => 
      m.muestras.some(s => 
        s.ensayos.some(e => e.isEdadGarantia && !e.isEnsayoFueraTiempo && e.resistenciaCalculada > 0)
      )
    )
  ).length;

  // Averages
  const avgCompliance = ensayosEdadGarantia.length > 0
    ? ensayosEdadGarantia.reduce((sum, e) => sum + e.porcentajeCumplimiento, 0) / ensayosEdadGarantia.length
    : 0;

  const avgResistencia = ensayosEdadGarantia.length > 0
    ? ensayosEdadGarantia.reduce((sum, e) => sum + e.resistenciaCalculada, 0) / ensayosEdadGarantia.length
    : 0;

  const avgMasaUnitaria = remisiones.reduce((sum, r) => {
    const masas = r.muestreos.map(m => m.masaUnitaria).filter(m => m > 0);
    return sum + (masas.length > 0 ? masas.reduce((s, m) => s + m, 0) / masas.length : 0);
  }, 0) / Math.max(remisionesMuestreadas, 1);

  const rendimientos = remisiones.map(r => r.rendimientoVolumetrico).filter(r => r !== undefined) as number[];
  const avgRendimiento = rendimientos.length > 0
    ? rendimientos.reduce((sum, r) => sum + r, 0) / rendimientos.length
    : 0;

  // Calculate volume-weighted average cost per m³ (matches production report methodology)
  let totalCostWeighted = 0;
  let totalVolumeForCost = 0;
  remisiones.forEach(r => {
    if (r.costPerM3 !== undefined && r.costPerM3 > 0 && r.volume > 0) {
      totalCostWeighted += r.costPerM3 * r.volume;
      totalVolumeForCost += r.volume;
    }
  });
  const avgCostPerM3 = totalVolumeForCost > 0 ? totalCostWeighted / totalVolumeForCost : 0;

  // Calculate cement share
  let totalCementCost = 0;
  let totalMaterialCost = 0;
  remisiones.forEach(r => {
    r.materiales.forEach(m => {
      // This would need material prices - simplified for now
      const quantity = m.cantidad_real;
      if (m.materials.category === 'CEMENTO') {
        totalCementCost += quantity * 0.5; // placeholder price
      }
      totalMaterialCost += quantity * 0.3; // placeholder price
    });
  });
  const cementSharePct = totalMaterialCost > 0 ? (totalCementCost / totalMaterialCost) * 100 : 0;

  // Performance metrics
  const onTimeEnsayos = allEnsayos.filter(e => !e.isEnsayoFueraTiempo).length;
  const onTimeTestingRate = allEnsayos.length > 0 ? (onTimeEnsayos / allEnsayos.length) * 100 : 0;

  // Alerts
  const alerts: any[] = [];
  if (avgCompliance < 95) {
    alerts.push({
      type: 'warning',
      metric: 'Cumplimiento',
      message: `Cumplimiento promedio (${avgCompliance.toFixed(1)}%) por debajo del objetivo (95%)`
    });
  }
  if (remisionesMuestreadas / totalRemisiones < 0.1) {
    alerts.push({
      type: 'info',
      metric: 'Cobertura',
      message: 'Baja cobertura de muestreo. Considere aumentar la frecuencia de ensayos.'
    });
  }

  // Calculate statistical analysis (Enhanced with client portal metrics)
  const calculateStatistics = () => {
    if (ensayosEdadGarantia.length === 0) {
      return {
        mean: 0,
        stdDev: 0,
        cv: 0,
        qualityLevel: 'Sin datos',
        groupStats: [],
        groupsInTargetWeighted: 0,
        processCapability: null,
        controlLimits: null
      };
    }

    // Group by strength and age (like client analysis)
    const groups: Record<string, { values: number[]; compliances: number[] }> = {};
    remisiones.forEach(remision => {
      remision.muestreos.forEach(muestreo => {
        const specs = muestreo.concrete_specs || {};
        const strength = specs.strength_fc ?? remision.recipeFc ?? 'NA';
        const ageLabel = getAgeLabel(specs);
        const key = `${strength}-${ageLabel}`;

        const validEnsayosDelMuestreo: Array<{ resistencia: number; cumplimiento: number }> = [];
        muestreo.muestras.forEach(muestra => {
          const ensayos = (muestra.ensayos || []).filter(ensayo =>
            ensayo.isEdadGarantia &&
            !ensayo.isEnsayoFueraTiempo &&
            (ensayo.resistenciaCalculada || 0) > 0
          );
          ensayos.forEach(ensayo => {
            validEnsayosDelMuestreo.push({
              resistencia: ensayo.resistenciaCalculada,
              cumplimiento: ensayo.porcentajeCumplimiento || 0
            });
          });
        });

        if (validEnsayosDelMuestreo.length > 0) {
          const nE = validEnsayosDelMuestreo.length;
          const avgResMuestreo = validEnsayosDelMuestreo.reduce((s, x) => s + x.resistencia, 0) / nE;
          const avgCumplMuestreo = validEnsayosDelMuestreo.reduce((s, x) => s + x.cumplimiento, 0) / nE;
          if (!groups[key]) groups[key] = { values: [], compliances: [] };
          groups[key].values.push(avgResMuestreo);
          groups[key].compliances.push(avgCumplMuestreo);
        }
      });
    });

    // Compute per-group stats and weighted CV
    const groupStatsRaw = Object.entries(groups).map(([key, g]) => {
      const n = g.values.length || 1;
      const meanG = g.values.reduce((s, v) => s + v, 0) / n;
      // Use n-1 for sample variance (Bessel's correction)
      const varG = n > 1 ? g.values.reduce((s, v) => s + Math.pow(v - meanG, 2), 0) / (n - 1) : 0;
      const stdG = Math.sqrt(varG);
      const cvG = meanG > 0 ? (stdG / meanG) * 100 : 0;
      const avgCompliance = g.compliances.length > 0
        ? g.compliances.reduce((s, v) => s + v, 0) / g.compliances.length
        : 0;
      const [strengthStr, ageStr] = key.split('-');
      return { key, strength: strengthStr, age: ageStr, count: n, mean: meanG, std: stdG, cv: cvG, compliance: avgCompliance };
    });

    // Exclude groups with insufficient muestreos (<3)
    const groupStats = groupStatsRaw.filter(g => g.count >= 3);
    const totalCount = groupStats.reduce((s, g) => s + g.count, 0) || 1;
    const cvWeighted = groupStats.length > 0 ? groupStats.reduce((s, g) => s + g.cv * (g.count / totalCount), 0) : 0;

    // % groups in target (CV <= 10%) weighted by sample count
    const groupsInTargetWeighted = totalCount > 0 ? (groupStats.reduce((s, g) => s + (g.cv <= 10 ? g.count : 0), 0) / totalCount * 100) : 0;

    // Global statistics (all ensayos) for display
    const resistencias = ensayosEdadGarantia.map(e => e.resistenciaCalculada);
    const mean = resistencias.reduce((sum, val) => sum + val, 0) / resistencias.length;
    // Use sample variance (n-1)
    const variance = resistencias.length > 1
      ? resistencias.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (resistencias.length - 1)
      : 0;
    const stdDev = Math.sqrt(variance);
    const cv = cvWeighted; // use grouped, weighted CV as consistency metric

    // Calculate control limits (3-sigma)
    const controlLimits = {
      ucl: mean + (3 * stdDev), // Upper Control Limit
      lcl: Math.max(0, mean - (3 * stdDev)), // Lower Control Limit
      usl: recipeInfo.strength_fc * 1.2, // Upper Spec Limit
      lsl: recipeInfo.strength_fc * 0.85, // Lower Spec Limit
      centerLine: mean
    };

    // Calculate process capability indices
    const processCapability = {
      cp: (controlLimits.usl - controlLimits.lsl) / (6 * stdDev), // Process Capability
      cpk: Math.min(
        (controlLimits.usl - mean) / (3 * stdDev),
        (mean - controlLimits.lsl) / (3 * stdDev)
      ), // Process Capability Index
      sigma: stdDev
    };

    // Quality level (recipe-centric): compliance, low variation, yield near 100%
    let qualityLevel = 'Aceptable';
    if (avgCompliance >= 97 && cv <= 8 && avgRendimiento >= 99) qualityLevel = 'Excelente';
    else if (avgCompliance >= 95 && cv <= 10 && avgRendimiento >= 98) qualityLevel = 'Muy Bueno';
    else if (avgCompliance >= 92 && cv <= 12 && avgRendimiento >= 97.5) qualityLevel = 'Aceptable';
    else qualityLevel = 'Mejorable';

    return {
      mean,
      stdDev,
      cv,
      qualityLevel,
      groupStats,
      groupsInTargetWeighted,
      processCapability,
      controlLimits
    };
  };

  return {
    recipeInfo: recipeInfo || { recipe_code: '', strength_fc: 0, age_days: 28 },
    totals: {
      volume: totalVolume,
      remisiones: totalRemisiones,
      remisionesMuestreadas,
      muestreos: totalMuestreos,
      ensayos: allEnsayos.length,
      ensayosEdadGarantia: ensayosEdadGarantia.length,
      porcentajeCoberturaMuestreo: totalRemisiones > 0 ? (remisionesMuestreadas / totalRemisiones) * 100 : 0,
      porcentajeCoberturaCalidad: totalRemisiones > 0 ? (remisionesConDatosCalidad / totalRemisiones) * 100 : 0
    },
    averages: {
      complianceRate: avgCompliance,
      resistencia: avgResistencia,
      masaUnitaria: avgMasaUnitaria,
      rendimientoVolumetrico: avgRendimiento,
      costPerM3: avgCostPerM3,
      cementSharePct
    },
    performance: {
      qualityTrend: 'stable', // Would need historical comparison
      onTimeTestingRate
    },
    statistics: calculateStatistics(),
    alerts
  };
}

// Helper function to get age label (from client analysis)
const getAgeLabel = (specs: any): string => {
  if (!specs) return 'NA';

  const parsedSpecs = (() => {
    if (typeof specs === 'string') {
      const trimmed = specs.trim();
      try {
        const obj = JSON.parse(trimmed);
        if (obj && typeof obj === 'object') return obj;
      } catch (_e) {
        const lower = trimmed.toLowerCase();
        if (/^\d+\s*h$/.test(lower)) {
          const hours = parseInt(lower);
          return { valor_edad: hours, unidad_edad: 'HORA' };
        }
        if (/^\d+\s*d$/.test(lower)) {
          const days = parseInt(lower);
          return { valor_edad: days, unidad_edad: 'DÍA' };
        }
        if (/^\d+$/.test(lower)) {
          const days = parseInt(lower);
          return { valor_edad: days, unidad_edad: 'DÍA' };
        }
      }
    }
    return specs;
  })();

  const valorEdad = parsedSpecs?.valor_edad ?? parsedSpecs?.valorEdad;
  const unidadEdadRaw = parsedSpecs?.unidad_edad ?? parsedSpecs?.unidadEdad;
  if (typeof valorEdad === 'number' && valorEdad > 0 && unidadEdadRaw) {
    const unidad = unidadEdadRaw.toString().toLowerCase();
    const unidadNorm = unidad
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (unidadNorm.includes('hora')) return `${valorEdad}h`;
    if (unidadNorm.includes('dia')) return `${valorEdad}d`;
  }

  const ageHours = parsedSpecs?.age_hours ?? parsedSpecs?.hours ?? parsedSpecs?.guarantee_age_hours ?? undefined;
  const ageDays = parsedSpecs?.age_days ?? parsedSpecs?.days ?? parsedSpecs?.guarantee_age_days ?? undefined;
  if (typeof ageHours === 'number' && ageHours > 0) return `${ageHours}h`;
  if (typeof ageDays === 'number' && ageDays > 0) return `${ageDays}d`;

  const ageObj = parsedSpecs?.guarantee_age ?? parsedSpecs?.age ?? parsedSpecs?.edad_garantia ?? undefined;
  if (ageObj && typeof ageObj === 'object') {
    const v = ageObj.value ?? ageObj.valor ?? ageObj.amount ?? undefined;
    const unitRaw = (ageObj.unit ?? ageObj.unidad ?? '').toString();
    const unitLc = unitRaw.toLowerCase();
    const unitNorm = unitLc
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const days = ageObj.days ?? ageObj.dias ?? undefined;
    const hours = ageObj.hours ?? ageObj.horas ?? undefined;
    if (typeof hours === 'number' && hours > 0) return `${hours}h`;
    if (typeof days === 'number' && days > 0) return `${days}d`;
    if (typeof v === 'number' && v > 0) {
      if (unitNorm.includes('hour') || unitNorm.includes('hora')) return `${v}h`;
      if (unitNorm.includes('day') || unitNorm.includes('dia')) return `${v}d`;
    }
  }

  const genericAge = parsedSpecs?.age ?? parsedSpecs?.edad ?? undefined;
  if (typeof genericAge === 'string') {
    const trimmed = genericAge.trim().toLowerCase();
    if (/^\d+\s*h$/.test(trimmed)) return trimmed.replace(/\s+/g, '');
    if (/^\d+\s*d$/.test(trimmed)) return trimmed.replace(/\s+/g, '');
    if (/^\d+$/.test(trimmed)) return `${trimmed}d`;
  }
  if (typeof genericAge === 'number' && genericAge > 0) return `${genericAge}d`;
  return 'NA';
};
