import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { calcularMediaSinCeros } from '@/lib/qualityMetricsUtils';
import type { DatoGraficoResistencia } from '@/types/quality';

interface AdvancedMetrics {
  eficiencia: number;
  rendimientoVolumetrico: number;
}

export function useAdvancedMetrics(datosGrafico: DatoGraficoResistencia[]) {
  const [advancedMetrics, setAdvancedMetrics] = useState<AdvancedMetrics>({
    eficiencia: 0,
    rendimientoVolumetrico: 0
  });
  const [calculating, setCalculating] = useState(false);

  // Calculate filtered advanced metrics when data changes
  useEffect(() => {
    const calculateFilteredAdvancedMetrics = async () => {
      if (datosGrafico.length === 0) {
        setAdvancedMetrics({ eficiencia: 0, rendimientoVolumetrico: 0 });
        return;
      }

      setCalculating(true);
      try {
        // Build quick lookup map: muestreo_id -> { resistencia, clasificacion }
        const muestreoToStats = new Map<string, { resistencia: number; isMR: boolean }>();
        datosGrafico.forEach(d => {
          const muestreoId = d.muestra?.muestreo?.id as string | undefined;
          if (muestreoId) {
            const resistencia = typeof d.resistencia_calculada === 'number' ? d.resistencia_calculada : 0;
            const isMR = d.clasificacion === 'MR';
            // Prefer latest occurrence; values are averages per muestreo already
            muestreoToStats.set(muestreoId, { resistencia, isMR });
          }
        });

        // Extract unique muestreos from filtered data
        const uniqueMuestreos = new Map();
        datosGrafico.forEach(d => {
          if (d.muestra?.muestreo?.id) {
            uniqueMuestreos.set(d.muestra.muestreo.id, d.muestra.muestreo);
          }
        });

        // Calculate efficiency and rendimiento for each muestreo
        const eficiencias: number[] = [];
        const rendimientos: number[] = [];

        // Use Array.from to avoid TypeScript iteration issues
        const muestreosArray = Array.from(uniqueMuestreos.entries());

        // Preload remision materiales and muestreo masa_unitaria for client-side fallback
        const muestreoIds: string[] = Array.from(uniqueMuestreos.keys());
        const muestreoMaterialsMap = new Map<string, { masaUnitaria: number; totalMateriales: number; cementKg: number }>();
        if (muestreoIds.length > 0) {
          try {
            const { data: muestreoMatData } = await supabase
              .from('muestreos')
              .select(`
                id,
                masa_unitaria,
                remision:remision_id (
                  id,
                  volumen_fabricado,
                  remision_materiales (
                    material_type,
                    cantidad_real
                  )
                )
              `)
              .in('id', muestreoIds);

            (muestreoMatData || []).forEach((row: any) => {
              const totalMateriales = (row?.remision?.remision_materiales || [])
                .reduce((s: number, m: any) => s + (Number(m.cantidad_real) || 0), 0);
              const cementKg = (row?.remision?.remision_materiales || [])
                .filter((m: any) => {
                  const t = (m.material_type || '').toString().toUpperCase();
                  return t.includes('CEMENTO') || t.includes('CEM');
                })
                .reduce((s: number, m: any) => s + (Number(m.cantidad_real) || 0), 0);

              muestreoMaterialsMap.set(row.id, {
                masaUnitaria: Number(row.masa_unitaria) || 0,
                totalMateriales,
                cementKg
              });
            });
          } catch (e) {
            console.warn('Could not preload muestreo materiales for efficiency fallback', e);
          }
        }

        // Process muestreos in batches to avoid overwhelming the server
        const batchSize = 5;
        for (let i = 0; i < muestreosArray.length; i += batchSize) {
          const batch = muestreosArray.slice(i, i + batchSize);

          for (const [muestreoId, muestreo] of batch) {
            try {
              const { data: metricasRPC, error } = await supabase
                .rpc('calcular_metricas_muestreo', {
                  p_muestreo_id: muestreoId
                });

              if (error) {
                console.warn(`RPC error for muestreo ${muestreoId}:`, error);
                continue;
              }

              if (metricasRPC && metricasRPC.length > 0) {
                const metricas = metricasRPC[0];

                // Add efficiency if available and non-zero
                const rpcEficienciaRaw = metricas.eficiencia;
                if (rpcEficienciaRaw !== null && rpcEficienciaRaw !== undefined) {
                  const rpcEficiencia = typeof rpcEficienciaRaw === 'string' ? parseFloat(rpcEficienciaRaw) : rpcEficienciaRaw;
                  if (rpcEficiencia > 0 && !isNaN(rpcEficiencia)) {
                    eficiencias.push(rpcEficiencia);
                  }
                }

                // Fallback A: compute efficiency from resistencia and real cement if RPC efficiency is missing/zero (using RPC consumo)
                if (metricas && (!metricas.eficiencia || metricas.eficiencia === 0)) {
                  const consumoRealRaw = (metricas.consumo_cemento_real ?? metricas.consumo_cemento ?? null);
                  const consumoReal = typeof consumoRealRaw === 'string' ? parseFloat(consumoRealRaw) : consumoRealRaw;

                  const stats = muestreoToStats.get(muestreoId);
                  const resistenciaProm = stats?.resistencia || 0;
                  const isMR = !!stats?.isMR;

                  if (consumoReal && consumoReal > 0 && resistenciaProm > 0) {
                    const resistenciaAjustada = isMR ? (resistenciaProm / 0.13) : resistenciaProm;
                    const eficienciaCalc = resistenciaAjustada / consumoReal;
                    if (isFinite(eficienciaCalc) && eficienciaCalc > 0) {
                      eficiencias.push(eficienciaCalc);
                    }
                  }
                }

                // Fallback B: fully client-side using materiales + masa_unitaria (volumen real)
                if ((!metricas || !metricas.eficiencia || metricas.eficiencia === 0)) {
                  const mat = muestreoMaterialsMap.get(muestreoId);
                  const stats = muestreoToStats.get(muestreoId);
                  const resistenciaProm = stats?.resistencia || 0;
                  const isMR = !!stats?.isMR;

                  if (mat && mat.masaUnitaria > 0 && mat.totalMateriales > 0 && mat.cementKg > 0 && resistenciaProm > 0) {
                    const volumenReal = mat.totalMateriales / mat.masaUnitaria;
                    if (volumenReal > 0) {
                      const consumoReal = mat.cementKg / volumenReal;
                      if (consumoReal > 0) {
                        const resistenciaAjustada = isMR ? (resistenciaProm / 0.13) : resistenciaProm;
                        const eficienciaCalc = resistenciaAjustada / consumoReal;
                        if (isFinite(eficienciaCalc) && eficienciaCalc > 0) {
                          eficiencias.push(eficienciaCalc);
                        }
                      }
                    }
                  }
                }

                // Add rendimiento volumétrico if available and non-zero
                if (metricas.rendimiento_volumetrico && metricas.rendimiento_volumetrico > 0 && !isNaN(metricas.rendimiento_volumetrico)) {
                  rendimientos.push(metricas.rendimiento_volumetrico);
                }
              }
            } catch (err) {
              // Log connection errors more prominently
              console.error(`Connection error for muestreo ${muestreoId}:`, err);
              // Add a small delay to avoid overwhelming the server
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          // Add a delay between batches
          if (i + batchSize < muestreosArray.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // Calculate averages using the utility function
        const eficiencia = eficiencias.length > 0 ? calcularMediaSinCeros(eficiencias) : 0;
        const rendimientoVolumetrico = rendimientos.length > 0 ? calcularMediaSinCeros(rendimientos) : 0;

        console.log('🔍 Filtered Advanced Metrics calculated:', {
          eficiencia,
          rendimientoVolumetrico,
          totalMuestreos: uniqueMuestreos.size,
          eficienciasFound: eficiencias.length,
          rendimientosFound: rendimientos.length
        });

        setAdvancedMetrics({ eficiencia, rendimientoVolumetrico });
      } catch (err) {
        console.error('Error calculating filtered advanced metrics:', err);
        setAdvancedMetrics({ eficiencia: 0, rendimientoVolumetrico: 0 });
      } finally {
        setCalculating(false);
      }
    };

    calculateFilteredAdvancedMetrics();
  }, [datosGrafico]);

  return {
    advancedMetrics,
    calculating
  };
}
