import { useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { SalesDataProcessor } from '@/utils/salesDataProcessor';

export interface VentasPerPlantRow {
  plantId: string;
  plantCode: string;
  plantName: string;
  concreteVolume: number;
  pumpVolume: number;
  emptyTruckVolume: number;
  weightedResistance: number;
  weightedGuaranteeAge: number;
  concreteVentas: number;
  pumpVentas: number;
  emptyTruckVentas: number;
  totalVentas: number;
}

type Plant = { id: string; name?: string; code?: string };

export function useVentasPerPlantRows(
  filteredRemisionesWithVacioDeOlla: any[],
  availablePlants: Plant[],
  salesData: any[],
  clientFilter: string[],
  orderItems: any[] | undefined,
  pricingMap: Map<string, { subtotal_amount: number; volumen_fabricado: number }>
) {
  const plantIdsInData = useMemo(() => {
    const ids = new Set<string>();
    filteredRemisionesWithVacioDeOlla.forEach((r: any) => {
      const pid = r?.plant_id != null ? String(r.plant_id) : undefined;
      if (pid) ids.add(pid);
    });
    return Array.from(ids);
  }, [filteredRemisionesWithVacioDeOlla]);

  const avgGuaranteeByPlantComputed = useMemo(() => {
    const accum: Record<string, { sum: number; vol: number }> = {};
    filteredRemisionesWithVacioDeOlla.forEach((r: any) => {
      if (r.tipo_remision === 'BOMBEO' || r.tipo_remision === 'VACÍO DE OLLA') return;
      const pid = r?.plant_id != null ? String(r.plant_id) : undefined;
      if (!pid) return;
      const volume = Number(r?.volumen_fabricado) || 0;
      if (volume <= 0) return;
      const rawDays = r?.recipe?.age_days;
      const rawHours = r?.recipe?.age_hours;
      const daysNum = rawDays !== undefined && rawDays !== null ? Number(rawDays) : NaN;
      const hoursNum = rawHours !== undefined && rawHours !== null ? Number(rawHours) : NaN;
      const days =
        Number.isFinite(daysNum) && daysNum > 0
          ? daysNum
          : Number.isFinite(hoursNum) && hoursNum > 0
            ? hoursNum / 24
            : 0;
      if (days > 0) {
        const a = accum[pid] || { sum: 0, vol: 0 };
        a.sum += days * volume;
        a.vol += volume;
        accum[pid] = a;
      }
    });
    const map: Record<string, number> = {};
    Object.entries(accum).forEach(([pid, a]) => {
      map[pid] = a.vol > 0 ? a.sum / a.vol : 0;
    });
    return map;
  }, [filteredRemisionesWithVacioDeOlla]);

  const perPlantRows = useMemo((): VentasPerPlantRow[] => {
    return plantIdsInData
      .map((plantId) => {
        const plantInfo = availablePlants.find((p) => String(p.id) === String(plantId));
        const rems = filteredRemisionesWithVacioDeOlla.filter(
          (r: any) => String(r.plant_id) === String(plantId)
        );
        const orderIds = Array.from(new Set(rems.map((r: any) => r.order_id).filter(Boolean)));
        const orders = salesData.filter((o: any) => orderIds.includes(o.id));
        const metrics = SalesDataProcessor.calculateSummaryMetrics(
          rems as any,
          orders as any,
          clientFilter,
          orderItems || [],
          pricingMap
        );
        const concreteVolume = metrics.concreteVolume || 0;
        const pumpVolume = metrics.pumpVolume || 0;
        const emptyTruckVolume = metrics.emptyTruckVolume || 0;
        const weightedResistance = metrics.weightedResistance || 0;
        const concreteVentas = metrics.concreteAmount || 0;
        const pumpVentas = metrics.pumpAmount || 0;
        const emptyTruckVentas = metrics.emptyTruckAmount || 0;
        const totalVentas = concreteVentas + pumpVentas + emptyTruckVentas + (metrics.additionalAmount || 0);
        const avgGuarantee = avgGuaranteeByPlantComputed[plantId] ?? 0;

        return {
          plantId,
          plantCode: plantInfo?.code || 'N/A',
          plantName: plantInfo?.name || 'Sin nombre',
          concreteVolume,
          pumpVolume,
          emptyTruckVolume,
          weightedResistance,
          weightedGuaranteeAge: avgGuarantee,
          concreteVentas,
          pumpVentas,
          emptyTruckVentas,
          totalVentas,
        };
      })
      .sort((a, b) => b.totalVentas - a.totalVentas);
  }, [
    plantIdsInData,
    filteredRemisionesWithVacioDeOlla,
    availablePlants,
    salesData,
    clientFilter,
    orderItems,
    pricingMap,
    avgGuaranteeByPlantComputed,
  ]);

  const exportPlantsTable = useCallback(
    (startDate: Date | undefined, endDate: Date | undefined, includeVAT: boolean) => {
      const data = perPlantRows.map((row) => ({
        Planta: `${row.plantCode} - ${row.plantName}`,
        'Vol. Concreto (m³)': Number(row.concreteVolume.toFixed(1)),
        'Vol. Bombeo (m³)': Number(row.pumpVolume.toFixed(1)),
        'Vol. Vacío de Olla (m³)': Number(row.emptyTruckVolume.toFixed(1)),
        'Resistencia Ponderada (kg/cm²)': Number(row.weightedResistance.toFixed(1)),
        'Edad Garantía (días)': Number(row.weightedGuaranteeAge.toFixed(1)),
        'Ventas Concreto': Number(row.concreteVentas.toFixed(2)),
        'Ventas Bombeo': Number(row.pumpVentas.toFixed(2)),
        'Ventas Vacío de Olla': Number(row.emptyTruckVentas.toFixed(2)),
        'Ventas Totales': Number(row.totalVentas.toFixed(2)),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [
        { wch: 28 },
        { wch: 18 },
        { wch: 18 },
        { wch: 22 },
        { wch: 26 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 22 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Comparativo_Plantas');
      const sd = startDate ? format(startDate, 'dd-MM-yyyy') : 'fecha';
      const ed = endDate ? format(endDate, 'dd-MM-yyyy') : 'fecha';
      const filename = `Comparativo_Plantas_${sd}_${ed}${includeVAT ? '_IVA' : ''}.xlsx`;
      XLSX.writeFile(wb, filename);
    },
    [perPlantRows]
  );

  return { perPlantRows, exportPlantsTable };
}
