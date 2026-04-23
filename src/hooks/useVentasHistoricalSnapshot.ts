import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useHistoricalSalesData } from '@/hooks/useSalesData';
import {
  buildMonthlyActiveClientSeries,
  buildMonthlyVentasTrendFromRemisiones,
} from '@/lib/finanzas/ventas/buildVentasMonthlyTrendFromRemisiones';

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

function isUuidLikeRemisionId(id: unknown): id is string {
  if (id == null) return false;
  const s = String(id);
  if (s.startsWith('vacio-')) return false;
  return s.length >= 32;
}

/**
 * Historical remisiones + orders for the **same fecha window as the ventas report** (when
 * `startDate` / `endDate` are passed), pricing for those remisiones, monthly active clients,
 * and remision-based trend series (same economics as the report).
 */
export function useVentasHistoricalSnapshot(
  plantIds: string[],
  includeVAT: boolean,
  startDate?: Date | null,
  endDate?: Date | null
) {
  const { historicalData, historicalRemisiones, loading: histLoading, error: histError } =
    useHistoricalSalesData({
      plantIdsForQuery: plantIds,
      startDate,
      endDate,
    });

  const [histPricingMap, setHistPricingMap] = useState<
    Map<string, { subtotal_amount: number; volumen_fabricado: number }>
  >(new Map());
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  useEffect(() => {
    if (!historicalRemisiones.length) {
      setHistPricingMap(new Map());
      setPricingLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setPricingLoading(true);
      setPricingError(null);
      try {
        const ids = Array.from(
          new Set(
            historicalRemisiones.map((r: any) => r.id).filter(isUuidLikeRemisionId).map(String)
          )
        );
        const map = new Map<string, { subtotal_amount: number; volumen_fabricado: number }>();
        for (const chunk of chunkIds(ids, 400)) {
          if (!chunk.length) continue;
          const { data, error } = await supabase
            .from('remisiones_with_pricing')
            .select('remision_id, subtotal_amount, volumen_fabricado')
            .in('remision_id', chunk);
          if (error) throw error;
          (data || []).forEach((row: any) => {
            map.set(String(row.remision_id), {
              subtotal_amount: Number(row.subtotal_amount) || 0,
              volumen_fabricado: Number(row.volumen_fabricado) || 0,
            });
          });
        }
        if (!cancelled) setHistPricingMap(map);
      } catch (e) {
        if (!cancelled) {
          setPricingError(e instanceof Error ? e.message : 'Error al cargar precios históricos');
          setHistPricingMap(new Map());
        }
      } finally {
        if (!cancelled) setPricingLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [historicalRemisiones]);

  const monthlyActiveClients = useMemo(
    () => buildMonthlyActiveClientSeries(historicalRemisiones),
    [historicalRemisiones]
  );

  const remisionTrendPoints = useMemo(
    () =>
      buildMonthlyVentasTrendFromRemisiones(
        historicalRemisiones,
        historicalData,
        histPricingMap,
        includeVAT
      ),
    [historicalRemisiones, historicalData, histPricingMap, includeVAT]
  );

  const loading = histLoading || pricingLoading;
  const error = histError || pricingError;

  return {
    historicalRemisiones,
    historicalData,
    monthlyActiveClients,
    remisionTrendPoints,
    histPricingMap,
    loading,
    error,
  };
}
