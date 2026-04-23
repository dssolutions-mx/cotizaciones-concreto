import { useState, useEffect } from 'react';
import {
  SalesDataProcessor,
  SummaryMetrics,
  ConcreteByRecipe,
} from '@/utils/salesDataProcessor';

export function useVentasSummaryMetrics(
  filteredRemisionesWithVacioDeOlla: any[],
  salesData: any[],
  clientFilter: string[],
  orderItems: any[] | undefined,
  pricingMap: Map<string, { subtotal_amount: number; volumen_fabricado: number }>
) {
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics | null>(null);
  const [concreteByRecipe, setConcreteByRecipe] = useState<ConcreteByRecipe>({});

  useEffect(() => {
    if (
      filteredRemisionesWithVacioDeOlla.length > 0 &&
      (!orderItems || orderItems.length === 0)
    ) {
      return;
    }

    const metrics = SalesDataProcessor.calculateSummaryMetrics(
      filteredRemisionesWithVacioDeOlla,
      salesData,
      clientFilter,
      orderItems || [],
      pricingMap
    );

    if (
      filteredRemisionesWithVacioDeOlla.length > 0 ||
      metrics.totalAmount > 0 ||
      metrics.totalVolume > 0
    ) {
      setSummaryMetrics(metrics);
    }
  }, [
    filteredRemisionesWithVacioDeOlla,
    salesData,
    clientFilter,
    orderItems,
    pricingMap,
  ]);

  useEffect(() => {
    const concreteRemisiones = filteredRemisionesWithVacioDeOlla.filter(
      (r) =>
        r.tipo_remision === 'CONCRETO' ||
        (r.isVirtualVacioDeOlla && r.tipo_remision === 'VACÍO DE OLLA')
    );
    setConcreteByRecipe(SalesDataProcessor.calculateConcreteByRecipe(concreteRemisiones));
  }, [filteredRemisionesWithVacioDeOlla]);

  return { summaryMetrics, concreteByRecipe };
}
