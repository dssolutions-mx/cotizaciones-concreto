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
                if (metricas.eficiencia && metricas.eficiencia > 0 && !isNaN(metricas.eficiencia)) {
                  eficiencias.push(metricas.eficiencia);
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
