import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfWeek, format, isAfter, startOfDay, startOfWeek } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { ClientQualityData, ClientQualityRemisionData, ClientQualitySummary } from '@/types/clientQuality';

interface Options {
  newestFirst?: boolean;
}

interface UseProgressiveClientQualityArgs {
  clientId?: string;
  fromDate?: Date;
  toDate?: Date;
  options?: Options;
}

export function useProgressiveClientQuality({ clientId, fromDate, toDate, options }: UseProgressiveClientQualityArgs) {
  const [data, setData] = useState<ClientQualityData | null>(null);
  const [summary, setSummary] = useState<ClientQualitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ aborted: boolean; token: number }>({ aborted: false, token: 0 });

  const newestFirst = options?.newestFirst !== false;

  const slices = useMemo(() => {
    if (!fromDate || !toDate) return [] as { from: Date; to: Date }[];
    const start = startOfDay(fromDate);
    const end = startOfDay(toDate);
    const result: { from: Date; to: Date }[] = [];
    // Build week ranges [Mon..Sun]
    let cursorEnd = endOfWeek(end, { weekStartsOn: 1 });
    while (isAfter(cursorEnd, start) || cursorEnd.getTime() === start.getTime()) {
      const weekStart = startOfWeek(cursorEnd, { weekStartsOn: 1 });
      const from = weekStart < start ? start : weekStart;
      const to = cursorEnd > end ? end : cursorEnd;
      result.push({ from, to });
      cursorEnd = addDays(weekStart, -1);
    }
    return newestFirst ? result : [...result].reverse();
  }, [fromDate, toDate, newestFirst]);

  useEffect(() => {
    if (!clientId || !fromDate || !toDate) {
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
        // Fetch all order IDs for this client in the date range (once)
        const { data: orders, error: ordersErr } = await supabase
          .from('orders')
          .select('id')
          .eq('client_id', clientId)
          .gte('delivery_date', format(fromDate, 'yyyy-MM-dd'))
          .lte('delivery_date', format(toDate, 'yyyy-MM-dd'));
        if (ordersErr) throw ordersErr;
        const orderIds = (orders || []).map(o => o.id);

        // If no orders, finalize early
        if (orderIds.length === 0) {
          const emptyRems: ClientQualityRemisionData[] = [];
          const builtSummary = buildSummary({ clientId, fromDate, toDate, remisiones: emptyRems });
          if (abortRef.current.aborted || abortRef.current.token !== token) return;
          setData({
            clientInfo: builtSummary.clientInfo,
            summary: builtSummary,
            remisiones: emptyRems,
            monthlyStats: [],
            qualityByRecipe: [],
            qualityByConstructionSite: []
          } as ClientQualityData);
          setSummary(builtSummary);
          setProgress({ processed: slices.length, total: slices.length });
          setLoading(false);
          setStreaming(false);
          return;
        }

        // Accumulator for remisiones
        const accMap = new Map<string, ClientQualityRemisionData>();

        // Helper to chunk IDs for .in constraints
        const chunk = <T,>(arr: T[], size: number) => {
          const res: T[][] = [];
          for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
          return res;
        };

        let firstChunk = true;

        for (const slice of slices) {
          if (abortRef.current.aborted || abortRef.current.token !== token) return;

          // orderIds is guaranteed non-empty due to early return above

          // Fetch remisiones for this slice in chunks by order_ids to avoid payload limits
          const idChunks = chunk(orderIds, 500);
          let sliceRems: any[] = [];
          for (const ids of idChunks) {
            if (abortRef.current.aborted || abortRef.current.token !== token) return;
            const { data: remsPart, error: remErr } = await supabase
              .from('remisiones')
              .select(`
              id,
              order_id,
              remision_number,
              fecha,
              volumen_fabricado,
              recipe_id,
              recipes(
                id,
                recipe_code,
                strength_fc
              ),
              orders(
                id,
                construction_site,
                clients(
                  id,
                  business_name
                )
              ),
              muestreos(
                id,
                fecha_muestreo,
                numero_muestreo,
                concrete_specs,
                masa_unitaria,
                temperatura_ambiente,
                temperatura_concreto,
                revenimiento_sitio,
                muestras(
                  id,
                  tipo_muestra,
                  identificacion,
                  fecha_programada_ensayo,
                  ensayos(
                    id,
                    fecha_ensayo,
                    carga_kg,
                    resistencia_calculada,
                    porcentaje_cumplimiento,
                    is_edad_garantia,
                    is_ensayo_fuera_tiempo
                  )
                )
              ),
              remision_materiales(
                id,
                material_type,
                cantidad_real
              )
              `)
              .in('order_id', ids)
              .gte('fecha', format(slice.from, 'yyyy-MM-dd'))
              .lte('fecha', format(slice.to, 'yyyy-MM-dd'))
              .not('volumen_fabricado', 'is', null)
              .order('fecha', { ascending: false });
            if (remErr) {
              // Soft-fail a chunk but continue to next; log once in state
              console.error('[ProgressiveQuality] remisiones chunk error:', remErr);
              continue;
            }
            sliceRems = sliceRems.concat(remsPart || []);
          }

          (sliceRems || []).forEach((r: any) => {
            const muestreos = r.muestreos || [];
            const allEnsayos = muestreos.flatMap((muestreo: any) =>
              muestreo.muestras?.flatMap((muestra: any) => muestra.ensayos || []) || []
            );
            const validEnsayos = allEnsayos.filter((e: any) =>
              e.is_edad_garantia === true &&
              e.is_ensayo_fuera_tiempo === false &&
              e.resistencia_calculada > 0 &&
              e.porcentaje_cumplimiento !== null &&
              e.porcentaje_cumplimiento !== undefined
            );

            const mapped: ClientQualityRemisionData = {
              id: r.id,
              orderId: r.order_id || r.orders?.id,
              remisionNumber: r.remision_number,
              fecha: r.fecha,
              volume: r.volumen_fabricado || 0,
              recipeCode: r.recipes?.recipe_code || '',
              recipeFc: r.recipes?.strength_fc || 0,
              constructionSite: r.orders?.construction_site || '',
              rendimientoVolumetrico: (() => {
                const materials = (r.remision_materiales || []) as any[];
                if (materials.length === 0 || (r.volumen_fabricado || 0) <= 0) return 0;
                const totalMaterialQuantity = materials.reduce((s, m: any) => s + (m.cantidad_real || 0), 0);
                const avgMasaUnitaria = muestreos.length > 0
                  ? muestreos.reduce((s: number, m: any) => s + (m.masa_unitaria || 0), 0) / muestreos.length
                  : 0;
                if (totalMaterialQuantity > 0 && avgMasaUnitaria > 0) {
                  return ((totalMaterialQuantity / avgMasaUnitaria) / (r.volumen_fabricado || 1)) * 100;
                }
                return 0;
              })(),
              totalMaterialQuantity: (r.remision_materiales || []).reduce((s: number, m: any) => s + (m.cantidad_real || 0), 0),
              materiales: (r.remision_materiales || []).map((m: any) => ({
                id: m.id,
                materialType: m.material_type,
                cantidadReal: m.cantidad_real || 0
              })),
              muestreos: muestreos.map((muestreo: any) => ({
                id: muestreo.id,
                fechaMuestreo: muestreo.fecha_muestreo,
                numeroMuestreo: muestreo.numero_muestreo,
                concrete_specs: muestreo.concrete_specs,
                masaUnitaria: muestreo.masa_unitaria || 0,
                temperaturaAmbiente: muestreo.temperatura_ambiente || 0,
                temperaturaConcreto: muestreo.temperatura_concreto || 0,
                revenimientoSitio: muestreo.revenimiento_sitio || 0,
                muestras: (muestreo.muestras || []).map((muestra: any) => ({
                  id: muestra.id,
                  tipoMuestra: muestra.tipo_muestra,
                  identificacion: muestra.identificacion,
                  fechaProgramadaEnsayo: muestra.fecha_programada_ensayo,
                  ensayos: (muestra.ensayos || []).map((e: any) => ({
                    id: e.id,
                    fechaEnsayo: e.fecha_ensayo,
                    cargaKg: e.carga_kg,
                    resistenciaCalculada: e.resistencia_calculada || 0,
                    porcentajeCumplimiento: e.porcentaje_cumplimiento || 0,
                    isEdadGarantia: e.is_edad_garantia || false,
                    isEnsayoFueraTiempo: e.is_ensayo_fuera_tiempo || false
                  }))
                }))
              })),
              complianceStatus: validEnsayos.length > 0
                ? (avg(validEnsayos.map((x: any) => x.porcentaje_cumplimiento || 0)) >= 95 ? 'compliant' : (avg(validEnsayos.map((x: any) => x.porcentaje_cumplimiento || 0)) >= 80 ? 'pending' : 'non_compliant'))
                : 'pending',
              avgResistencia: validEnsayos.length > 0 ? avg(validEnsayos.map((x: any) => x.resistencia_calculada || 0)) : 0,
              minResistencia: validEnsayos.length > 0 ? Math.min(...validEnsayos.map((x: any) => x.resistencia_calculada || 0)) : 0,
              maxResistencia: validEnsayos.length > 0 ? Math.max(...validEnsayos.map((x: any) => x.resistencia_calculada || 0)) : 0
            };

            accMap.set(String(r.id), mapped);
          });

          // Build arrays and aggregates from accumulator
          const accRemisiones = Array.from(accMap.values()).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
          const builtSummary = buildSummary({ clientId, fromDate, toDate, remisiones: accRemisiones });
          const monthlyStats = buildMonthlyStats(accRemisiones);
          const qualityByRecipe = buildQualityByRecipe(accRemisiones);
          const qualityByConstructionSite = buildQualityByConstructionSite(accRemisiones);

          if (abortRef.current.aborted || abortRef.current.token !== token) return;
          setData({
            clientInfo: builtSummary.clientInfo,
            summary: builtSummary,
            remisiones: accRemisiones,
            monthlyStats,
            qualityByRecipe,
            qualityByConstructionSite
          } as ClientQualityData);
          setSummary(builtSummary);

          if (firstChunk) {
            setLoading(false);
            firstChunk = false;
          }
          setProgress(prev => ({ ...prev, processed: Math.min(prev.processed + 1, prev.total) }));
        }
      } catch (e: any) {
        if (!abortRef.current.aborted && abortRef.current.token === token) {
          setError(e?.message || 'Error al cargar análisis de calidad');
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
  }, [clientId, fromDate, toDate, slices]);

  return { data, summary, loading, streaming, progress, error };
}

function avg(arr: number[]) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }

function buildSummary(params: { clientId: string; fromDate: Date; toDate: Date; remisiones: ClientQualityRemisionData[] }): ClientQualitySummary {
  const { clientId, fromDate, toDate, remisiones } = params;
  const remisionesWithMuestreos = remisiones.filter(r => r.muestreos && r.muestreos.length > 0).length;
  const allEnsayos = remisiones.flatMap(r => r.muestreos.flatMap(m => m.muestras.flatMap(s => s.ensayos
    .filter(e => e.isEdadGarantia === true && !e.isEnsayoFueraTiempo && (e.resistenciaCalculada || 0) > 0 && e.porcentajeCumplimiento !== null && e.porcentajeCumplimiento !== undefined))));
  const remisionesConDatosCalidad = remisiones.filter(r => r.muestreos.some(m => m.muestras.some(s => s.ensayos.some(e => e.isEdadGarantia === true && !e.isEnsayoFueraTiempo && (e.resistenciaCalculada || 0) > 0 && e.porcentajeCumplimiento !== null && e.porcentajeCumplimiento !== undefined)))).length;

  const totals = {
    volume: remisiones.reduce((sum, r) => sum + (r.volume || 0), 0),
    remisiones: remisiones.length,
    remisionesMuestreadas: remisionesWithMuestreos,
    remisionesConDatosCalidad,
    porcentajeCoberturaMuestreo: remisiones.length > 0 ? (remisionesWithMuestreos / remisiones.length) * 100 : 0,
    porcentajeCoberturaCalidad: remisiones.length > 0 ? (remisionesConDatosCalidad / remisiones.length) * 100 : 0,
    muestreos: remisiones.reduce((sum, r) => sum + r.muestreos.length, 0),
    ensayos: remisiones.reduce((sum, r) => sum + r.muestreos.reduce((mSum, m) => mSum + m.muestras.reduce((sSum, s) => sSum + s.ensayos.length, 0), 0), 0),
    ensayosEdadGarantia: remisiones.reduce((sum, r) => sum + r.muestreos.reduce((mSum, m) => mSum + m.muestras.reduce((sSum, s) => sSum + s.ensayos.filter(e => e.isEdadGarantia === true && !e.isEnsayoFueraTiempo && (e.resistenciaCalculada || 0) > 0 && e.porcentajeCumplimiento !== null && e.porcentajeCumplimiento !== undefined).length, 0), 0), 0)
  };

  const averages = {
    resistencia: avg(allEnsayos.map(e => e.resistenciaCalculada || 0)),
    complianceRate: avg(allEnsayos.map(e => e.porcentajeCumplimiento || 0)),
    masaUnitaria: (() => {
      const totalMuestreos = remisiones.reduce((sum, r) => sum + r.muestreos.length, 0) || 0;
      if (!totalMuestreos) return 0;
      const total = remisiones.reduce((sum, r) => sum + r.muestreos.reduce((mSum, m) => mSum + (m.masaUnitaria || 0), 0), 0);
      return total / totalMuestreos;
    })(),
    rendimientoVolumetrico: (() => {
      const vals = remisiones.filter(r => (r.rendimientoVolumetrico || 0) > 0).map(r => r.rendimientoVolumetrico || 0);
      return vals.length ? avg(vals) : 0;
    })()
  };

  const performance = {
    complianceRate: averages.complianceRate,
    onTimeTestingRate: allEnsayos.length > 0 ? (allEnsayos.filter(e => !e.isEnsayoFueraTiempo).length / allEnsayos.length) * 100 : 0,
    volumeTrend: 'stable' as const,
    qualityTrend: 'stable' as const
  };

  return {
    clientInfo: { id: clientId, business_name: '', client_code: '' },
    period: { from: format(fromDate, 'yyyy-MM-dd'), to: format(toDate, 'yyyy-MM-dd') },
    totals,
    averages,
    performance,
    alerts: []
  };
}

function buildMonthlyStats(remisiones: ClientQualityRemisionData[]) {
  const monthlyData = new Map<string, any>();
  remisiones.forEach(rem => {
    const date = new Date(rem.fecha);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {
        month: date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
        year: date.getFullYear(),
        volume: 0,
        remisiones: 0,
        muestreos: 0,
        ensayos: 0,
        totalResistencia: 0,
        resistenciaCount: 0,
        compliantTests: 0,
        totalCompliance: 0,
        totalTests: 0
      } as any);
    }
    const data = monthlyData.get(monthKey);
    data.volume += rem.volume || 0;
    data.remisiones += 1;
    data.muestreos += rem.muestreos.length;
    rem.muestreos.forEach(m => {
      m.muestras.forEach(s => {
        const valid = s.ensayos.filter(e => e.isEdadGarantia && !e.isEnsayoFueraTiempo && (e.resistenciaCalculada || 0) > 0 && e.porcentajeCumplimiento !== null && e.porcentajeCumplimiento !== undefined);
        data.ensayos += valid.length;
        valid.forEach(e => {
          if (e.resistenciaCalculada > 0) {
            data.totalResistencia += e.resistenciaCalculada;
            data.resistenciaCount += 1;
          }
          if ((e.porcentajeCumplimiento || 0) >= 100) data.compliantTests += 1;
          // Sum DB-stored compliance percentages for average
          data.totalCompliance += e.porcentajeCumplimiento || 0;
          data.totalTests += 1;
        });
      });
    });
  });
  return Array.from(monthlyData.values()).map(d => ({
    ...d,
    avgResistencia: d.resistenciaCount > 0 ? d.totalResistencia / d.resistenciaCount : 0,
    // Average of DB-stored age-adjusted compliance percentages
    complianceRate: d.totalTests > 0 ? d.totalCompliance / d.totalTests : 0
  }));
}

function buildQualityByRecipe(remisiones: ClientQualityRemisionData[]) {
  const map = new Map<string, any>();
  remisiones.forEach(r => {
    const key = r.recipeCode || 'N/A';
    if (!map.has(key)) map.set(key, { 
      recipeCode: key, 
      recipeFc: r.recipeFc, 
      totalVolume: 0, 
      totalTests: 0, 
      totalResistencia: 0, 
      resistenciaCount: 0, 
      compliantTests: 0,
      totalCompliance: 0,
      count: 0 
    });
    const d = map.get(key);
    d.totalVolume += r.volume || 0;
    d.count += 1;
    r.muestreos.forEach(m => m.muestras.forEach(s => {
      const valid = s.ensayos.filter(e => e.isEdadGarantia && !e.isEnsayoFueraTiempo && (e.resistenciaCalculada || 0) > 0 && e.porcentajeCumplimiento !== null && e.porcentajeCumplimiento !== undefined);
      d.totalTests += valid.length;
      valid.forEach(e => {
        if (e.resistenciaCalculada > 0) { d.totalResistencia += e.resistenciaCalculada; d.resistenciaCount += 1; }
        if ((e.porcentajeCumplimiento || 0) >= 100) d.compliantTests += 1;
        // Sum DB-stored compliance percentages for average
        d.totalCompliance += e.porcentajeCumplimiento || 0;
      });
    }));
  });
  return Array.from(map.values()).map(d => ({
    recipeCode: d.recipeCode,
    recipeFc: d.recipeFc,
    totalVolume: d.totalVolume,
    totalTests: d.totalTests,
    avgResistencia: d.resistenciaCount > 0 ? d.totalResistencia / d.resistenciaCount : 0,
    // Average of DB-stored age-adjusted compliance percentages
    complianceRate: d.totalTests > 0 ? d.totalCompliance / d.totalTests : 0,
    count: d.count
  }));
}

function buildQualityByConstructionSite(remisiones: ClientQualityRemisionData[]) {
  const map = new Map<string, any>();
  remisiones.forEach(r => {
    const key = r.constructionSite || 'N/A';
    if (!map.has(key)) map.set(key, { 
      constructionSite: key, 
      totalVolume: 0, 
      totalTests: 0, 
      totalResistencia: 0, 
      resistenciaCount: 0, 
      compliantTests: 0, 
      totalCompliance: 0,
      count: 0 
    });
    const d = map.get(key);
    d.totalVolume += r.volume || 0;
    d.count += 1;
    r.muestreos.forEach(m => m.muestras.forEach(s => {
      const valid = s.ensayos.filter(e => e.isEdadGarantia && !e.isEnsayoFueraTiempo && (e.resistenciaCalculada || 0) > 0 && e.porcentajeCumplimiento !== null && e.porcentajeCumplimiento !== undefined);
      d.totalTests += valid.length;
      valid.forEach(e => {
        if (e.resistenciaCalculada > 0) { d.totalResistencia += e.resistenciaCalculada; d.resistenciaCount += 1; }
        if ((e.porcentajeCumplimiento || 0) >= 100) d.compliantTests += 1;
        // Sum DB-stored compliance percentages for average
        d.totalCompliance += e.porcentajeCumplimiento || 0;
      });
    }));
  });
  return Array.from(map.values()).map(d => ({
    constructionSite: d.constructionSite,
    totalVolume: d.totalVolume,
    totalTests: d.totalTests,
    avgResistencia: d.resistenciaCount > 0 ? d.totalResistencia / d.resistenciaCount : 0,
    // Average of DB-stored age-adjusted compliance percentages
    complianceRate: d.totalTests > 0 ? d.totalCompliance / d.totalTests : 0,
    count: d.count
  }));
}


