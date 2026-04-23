import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { findProductPrice } from '@/utils/salesDataProcessor';
import type { DebugPricingViewRow } from '@/lib/finanzas/ventas/ventasDashboardCache';

export function useVentasPricingDebug() {
  const [showDebugTool, setShowDebugTool] = useState(false);
  const [debugData, setDebugData] = useState<any[]>([]);
  const [debugLoading, setDebugLoading] = useState(false);

  const runDebugComparison = useCallback(
    async (params: {
      startDate: Date | undefined;
      endDate: Date | undefined;
      effectivePlantIds: string[];
      filteredRemisionesWithVacioDeOlla: any[];
      orderItems: any[] | undefined;
      pricingMap: Map<string, { subtotal_amount: number; volumen_fabricado: number }>;
    }) => {
      const {
        startDate,
        endDate,
        effectivePlantIds,
        filteredRemisionesWithVacioDeOlla,
        orderItems,
        pricingMap,
      } = params;

      if (!startDate || !endDate) return;
      if (effectivePlantIds.length === 0) return;

      setDebugLoading(true);
      try {
        const from = format(startDate, 'yyyy-MM-dd');
        const to = format(endDate, 'yyyy-MM-dd');

        const { data: viewDataRaw, error: viewError } = await supabase
          .from('remisiones_with_pricing')
          .select('*')
          .in('plant_id', effectivePlantIds)
          .gte('fecha', from)
          .lte('fecha', to)
          .order('fecha', { ascending: false });

        if (viewError) throw viewError;
        const viewData = (viewDataRaw ?? []) as DebugPricingViewRow[];

        const comparisonData = filteredRemisionesWithVacioDeOlla
          .map((remision) => {
            const viewItem = viewData.find(
              (v) =>
                v.remision_id === remision.id?.toString() || v.remision_id === remision.id
            );

            if (!viewItem) {
              return null;
            }

            const salesReportType = remision.tipo_remision || 'CONCRETO';
            const viewType = viewItem.tipo_remision || 'CONCRETO';

            if (salesReportType !== viewType) {
              console.warn(
                `Type mismatch for remisión ${remision.id}: Sales Report=${salesReportType}, View=${viewType}`
              );
              return null;
            }

            let salesReportPrice = 0;
            let salesReportAmount = 0;
            let pricingMethod = '';

            const remisionMasterRecipeId =
              (remision as any).master_recipe_id || remision.recipe?.master_recipe_id;
            if (remision.tipo_remision === 'VACÍO DE OLLA' || remision.isVirtualVacioDeOlla) {
              salesReportPrice = findProductPrice(
                'SER001',
                remision.order_id,
                undefined,
                orderItems,
                pricingMap,
                remision.id,
                remisionMasterRecipeId
              );
              pricingMethod = 'SER001';
            } else if (remision.tipo_remision === 'BOMBEO') {
              salesReportPrice = findProductPrice(
                'SER002',
                remision.order_id,
                undefined,
                orderItems,
                pricingMap,
                remision.id,
                remisionMasterRecipeId
              );
              pricingMethod = 'SER002';
            } else {
              const recipeCode = remision.recipe?.recipe_code;
              const recipeId = remision.recipe?.id;
              salesReportPrice = findProductPrice(
                recipeCode,
                remision.order_id,
                recipeId,
                orderItems,
                pricingMap,
                remision.id,
                remisionMasterRecipeId
              );
              pricingMethod = 'CONCRETE';
            }

            salesReportAmount = salesReportPrice * (remision.volumen_fabricado || 0);

            return {
              remision_id: remision.id,
              remision_number: remision.remision_number || 'N/A',
              fecha: remision.fecha,
              unidad: remision.unidad,
              tipo_remision: remision.tipo_remision,
              volumen_fabricado: remision.volumen_fabricado || 0,
              recipe_code: remision.recipe?.recipe_code || 'N/A',
              order_id: remision.order_id,
              sales_report_price: salesReportPrice,
              sales_report_amount: salesReportAmount,
              sales_report_pricing_method: pricingMethod,
              view_price: viewItem?.unit_price_resolved || 0,
              view_amount: viewItem?.subtotal_amount || 0,
              view_pricing_method: viewItem?.pricing_method || 'N/A',
              price_difference: Math.abs(
                salesReportPrice - (viewItem?.unit_price_resolved || 0)
              ),
              amount_difference: Math.abs(
                salesReportAmount - (viewItem?.subtotal_amount || 0)
              ),
              order_has_pump_service: viewItem?.order_has_pump_service || false,
              is_virtual: remision.isVirtualVacioDeOlla || false,
              requires_invoice: remision.order?.requires_invoice || false,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row != null);

        setDebugData(comparisonData);
      } catch (error) {
        console.error('Debug comparison error:', error);
      } finally {
        setDebugLoading(false);
      }
    },
    []
  );

  return {
    showDebugTool,
    setShowDebugTool,
    debugData,
    debugLoading,
    runDebugComparison,
  };
}
