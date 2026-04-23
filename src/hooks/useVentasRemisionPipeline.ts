import { useMemo, useState, useEffect } from 'react';
import { SalesDataProcessor } from '@/utils/salesDataProcessor';
import { fetchArkikReassignmentNotesByRemisionNumber } from '@/services/reportDataService';

export interface VentasRemisionFilterInput {
  remisionesData: any[];
  salesData: any[];
  clientFilter: string[];
  searchTerm: string;
  resistanceFilter: string;
  efectivoFiscalFilter: string;
  tipoFilter: string[];
  codigoProductoFilter: string[];
}

export function useVentasRemisionPipeline({
  remisionesData,
  salesData,
  clientFilter,
  searchTerm,
  resistanceFilter,
  efectivoFiscalFilter,
  tipoFilter,
  codigoProductoFilter,
}: VentasRemisionFilterInput) {
  const filteredRemisiones = useMemo(() => {
    let filtered = [...remisionesData];

    if (clientFilter && clientFilter.length > 0) {
      filtered = filtered.filter(
        (r) => r.order?.client_id && clientFilter.includes(r.order.client_id)
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.remision_number?.toLowerCase().includes(term) ||
          r.order?.order_number?.toLowerCase().includes(term) ||
          r.order?.clients?.business_name?.toLowerCase().includes(term) ||
          r.recipe?.recipe_code?.toLowerCase().includes(term)
      );
    }

    if (resistanceFilter && resistanceFilter !== 'all') {
      filtered = filtered.filter(
        (r) => r.recipe?.strength_fc?.toString() === resistanceFilter
      );
    }
    if (efectivoFiscalFilter && efectivoFiscalFilter !== 'all') {
      const requiresInvoice = efectivoFiscalFilter === 'fiscal';
      filtered = filtered.filter((r) => {
        const order = salesData.find((o) => o.id === r.order_id);
        return order?.requires_invoice === requiresInvoice;
      });
    }
    if (tipoFilter && tipoFilter.length > 0) {
      filtered = filtered.filter(
        (r) => r.tipo_remision && tipoFilter.includes(r.tipo_remision)
      );
    }
    if (codigoProductoFilter && codigoProductoFilter.length > 0) {
      filtered = filtered.filter(
        (r) =>
          r.recipe?.recipe_code && codigoProductoFilter.includes(r.recipe.recipe_code)
      );
    }

    return filtered;
  }, [
    remisionesData,
    clientFilter,
    searchTerm,
    resistanceFilter,
    efectivoFiscalFilter,
    tipoFilter,
    codigoProductoFilter,
    salesData,
  ]);

  const virtualVacioDeOllaRemisiones = useMemo(() => {
    const shouldIncludeVacioDeOlla =
      tipoFilter.length === 0 || tipoFilter.includes('VACÍO DE OLLA');

    if (!shouldIncludeVacioDeOlla) return [];

    if (codigoProductoFilter.length > 0 && !codigoProductoFilter.includes('SER001')) {
      return [];
    }

    return SalesDataProcessor.createVirtualVacioDeOllaRemisiones(
      salesData,
      remisionesData,
      clientFilter,
      searchTerm,
      tipoFilter,
      efectivoFiscalFilter
    );
  }, [
    salesData,
    remisionesData,
    clientFilter,
    searchTerm,
    tipoFilter,
    efectivoFiscalFilter,
    codigoProductoFilter,
  ]);

  const filteredRemisionesWithVacioDeOlla = useMemo(
    () => [...filteredRemisiones, ...virtualVacioDeOllaRemisiones],
    [filteredRemisiones, virtualVacioDeOllaRemisiones]
  );

  const remisionesMissingOrderCount = useMemo(() => {
    return filteredRemisionesWithVacioDeOlla.filter((r: any) => {
      const vol = Number(r?.volumen_fabricado) || 0;
      if (vol <= 0) return false;
      return !salesData.some((o) => String(o.id) === String(r.order_id));
    }).length;
  }, [filteredRemisionesWithVacioDeOlla, salesData]);

  const filteredWeightedGuaranteeAge = useMemo(() => {
    const relevant = filteredRemisionesWithVacioDeOlla.filter(
      (r) => r.tipo_remision !== 'BOMBEO' && r.tipo_remision !== 'VACÍO DE OLLA'
    );
    let sum = 0;
    let vol = 0;
    for (const r of relevant) {
      const volume = Number(r?.volumen_fabricado) || 0;
      if (volume <= 0) continue;
      const rawDays = (r as any)?.recipe?.age_days;
      const rawHours = (r as any)?.recipe?.age_hours;
      const daysNum = rawDays !== undefined && rawDays !== null ? Number(rawDays) : NaN;
      const hoursNum = rawHours !== undefined && rawHours !== null ? Number(rawHours) : NaN;
      const days =
        Number.isFinite(daysNum) && daysNum > 0
          ? daysNum
          : Number.isFinite(hoursNum) && hoursNum > 0
            ? hoursNum / 24
            : 0;
      if (days > 0) {
        sum += days * volume;
        vol += volume;
      }
    }
    return vol > 0 ? sum / vol : 0;
  }, [filteredRemisionesWithVacioDeOlla]);

  const [reassignmentByRemision, setReassignmentByRemision] = useState<Map<string, string>>(
    () => new Map()
  );

  useEffect(() => {
    let cancelled = false;
    const nums = Array.from(
      new Set(
        filteredRemisionesWithVacioDeOlla
          .map((r) => String(r.remision_number ?? '').trim())
          .filter(Boolean)
      )
    );
    if (nums.length === 0) {
      setReassignmentByRemision(new Map());
      return;
    }
    fetchArkikReassignmentNotesByRemisionNumber(nums).then((map) => {
      if (!cancelled) setReassignmentByRemision(map);
    });
    return () => {
      cancelled = true;
    };
  }, [filteredRemisionesWithVacioDeOlla]);

  return {
    filteredRemisiones,
    virtualVacioDeOllaRemisiones,
    filteredRemisionesWithVacioDeOlla,
    remisionesMissingOrderCount,
    filteredWeightedGuaranteeAge,
    reassignmentByRemision,
  };
}
