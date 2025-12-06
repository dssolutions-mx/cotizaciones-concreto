import { useState, useEffect, useRef } from 'react';
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
  const calculationIdRef = useRef(0);

  // Calculate filtered advanced metrics when data changes
  // PERFORMANCE FIX: Replaced N+1 RPC calls with client-side calculation
  // using already-fetched data. This avoids calling calcular_metricas_muestreo
  // for each individual muestreo (which caused 400+ RPC calls per load).
  useEffect(() => {
    const calculateFilteredAdvancedMetrics = async () => {
      if (datosGrafico.length === 0) {
        setAdvancedMetrics({ eficiencia: 0, rendimientoVolumetrico: 0 });
        return;
      }

      const currentCalculationId = ++calculationIdRef.current;
      setCalculating(true);

      try {
        // Build quick lookup map: muestreo_id -> { resistencia, clasificacion }
        const muestreoToStats = new Map<string, { resistencia: number; isMR: boolean }>();
        datosGrafico.forEach(d => {
          const muestreoId = d.muestra?.muestreo?.id as string | undefined;
          if (muestreoId) {
            const resistencia = typeof d.resistencia_calculada === 'number' ? d.resistencia_calculada : 0;
            const isMR = d.clasificacion === 'MR';
            muestreoToStats.set(muestreoId, { resistencia, isMR });
          }
        });

        // Extract unique muestreo IDs from chart data
        const muestreoIds: string[] = Array.from(muestreoToStats.keys());

        if (muestreoIds.length === 0) {
          setAdvancedMetrics({ eficiencia: 0, rendimientoVolumetrico: 0 });
          setCalculating(false);
          return;
        }

        // PERFORMANCE: Single batch query for all materials data instead of N+1 RPC calls
        // Limit to prevent huge queries
        const limitedIds = muestreoIds.slice(0, 100);
        
        const { data: muestreoMatData, error: matError } = await supabase
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
          .in('id', limitedIds);

        // Check if this calculation is still current
        if (currentCalculationId !== calculationIdRef.current) {
          return;
        }

        if (matError) {
          console.warn('Error fetching materials data:', matError);
          setAdvancedMetrics({ eficiencia: 0, rendimientoVolumetrico: 0 });
          setCalculating(false);
          return;
        }

        // Calculate efficiency and rendimiento from fetched data
        const eficiencias: number[] = [];
        const rendimientos: number[] = [];

        (muestreoMatData || []).forEach((row: any) => {
          const muestreoId = row.id;
          const stats = muestreoToStats.get(muestreoId);
          if (!stats) return;

          const resistenciaProm = stats.resistencia || 0;
          const isMR = stats.isMR;
          const masaUnitaria = Number(row.masa_unitaria) || 0;
          const volumenFabricado = Number(row.remision?.volumen_fabricado) || 0;

          const materiales = row.remision?.remision_materiales || [];
          const totalMateriales = materiales.reduce(
            (s: number, m: any) => s + (Number(m.cantidad_real) || 0), 0
          );
          const cementKg = materiales
            .filter((m: any) => {
              const t = (m.material_type || '').toString().toUpperCase();
              return t.includes('CEMENTO') || t.includes('CEM');
            })
            .reduce((s: number, m: any) => s + (Number(m.cantidad_real) || 0), 0);

          // Calculate rendimiento volumétrico
          if (masaUnitaria > 0 && totalMateriales > 0 && volumenFabricado > 0) {
            const volumenReal = totalMateriales / masaUnitaria;
            const rendimiento = (volumenReal / volumenFabricado) * 100;
            if (rendimiento > 0 && rendimiento < 200 && isFinite(rendimiento)) {
              rendimientos.push(rendimiento);
            }
          }

          // Calculate efficiency: resistencia / consumo_cemento_real
          if (masaUnitaria > 0 && totalMateriales > 0 && cementKg > 0 && resistenciaProm > 0) {
            const volumenReal = totalMateriales / masaUnitaria;
            if (volumenReal > 0) {
              const consumoReal = cementKg / volumenReal;
              if (consumoReal > 0) {
                const resistenciaAjustada = isMR ? (resistenciaProm / 0.13) : resistenciaProm;
                const eficienciaCalc = resistenciaAjustada / consumoReal;
                if (isFinite(eficienciaCalc) && eficienciaCalc > 0 && eficienciaCalc < 10) {
                  eficiencias.push(eficienciaCalc);
                }
              }
            }
          }
        });

        // Calculate averages
        const eficiencia = eficiencias.length > 0 ? calcularMediaSinCeros(eficiencias) : 0;
        const rendimientoVolumetrico = rendimientos.length > 0 ? calcularMediaSinCeros(rendimientos) : 0;

        console.log('🔍 Advanced Metrics (optimized):', {
          eficiencia,
          rendimientoVolumetrico,
          muestreosProcessed: muestreoMatData?.length || 0,
          eficienciasFound: eficiencias.length,
          rendimientosFound: rendimientos.length
        });

        setAdvancedMetrics({ eficiencia, rendimientoVolumetrico });
      } catch (err) {
        console.error('Error calculating advanced metrics:', err);
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
